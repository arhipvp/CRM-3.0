from apps.common.permissions import EditProtectedMixin
from apps.notes.models import Note
from apps.users.models import UserRole
from django.db.models import Q
from rest_framework import permissions, status, viewsets
from rest_framework.decorators import action
from rest_framework.parsers import FormParser, MultiPartParser
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import Document, KnowledgeDocument
from .open_notebook import OpenNotebookError, OpenNotebookSyncService
from .serializers import DocumentSerializer, KnowledgeDocumentSerializer


class DocumentViewSet(EditProtectedMixin, viewsets.ModelViewSet):
    serializer_class = DocumentSerializer

    def get_queryset(self):
        user = self.request.user
        queryset = Document.objects.all()

        # Если пользователь не аутентифицирован, возвращаем все записи (AllowAny режим)
        if not user.is_authenticated:
            return queryset

        # Администраторы видят все документы
        is_admin = UserRole.objects.filter(user=user, role__name="Admin").exists()

        if not is_admin:
            # Остальные видят только документы для своих сделок (где user = seller или executor)
            queryset = queryset.filter(Q(deal__seller=user) | Q(deal__executor=user))

        return queryset

    def perform_create(self, serializer):
        # Если пользователь авторизован, сохранить его как owner
        owner = self.request.user if self.request.user.is_authenticated else None
        serializer.save(owner=owner)


class KnowledgeDocumentViewSet(viewsets.ModelViewSet):
    queryset = KnowledgeDocument.objects.select_related("insurance_type").all()
    serializer_class = KnowledgeDocumentSerializer
    permission_classes = [permissions.AllowAny]
    parser_classes = (MultiPartParser, FormParser)

    def get_queryset(self):
        queryset = super().get_queryset()
        insurance_type_id = self.request.query_params.get("insurance_type")
        if insurance_type_id:
            queryset = queryset.filter(insurance_type_id=insurance_type_id)
        return queryset

    def create(self, request, *args, **kwargs):
        file_obj = request.FILES.get("file")
        if not file_obj:
            return Response(
                {"detail": "Поле file обязательно."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        title = request.data.get("title") or file_obj.name
        description = request.data.get("description", "")
        insurance_type = request.data.get("insurance_type")

        serializer = self.get_serializer(
            data={
                "title": title,
                "description": description,
                "insurance_type": insurance_type,
                "file": file_obj,
            }
        )
        serializer.is_valid(raise_exception=True)
        document = serializer.save(
            owner=(
                request.user if request.user and request.user.is_authenticated else None
            ),
            file_name=file_obj.name,
            mime_type=file_obj.content_type or "",
            file_size=file_obj.size,
        )
        sync_service = OpenNotebookSyncService()
        try:
            sync_service.sync_document(document)
        except OpenNotebookError as exc:
            document.open_notebook_status = "error"
            document.open_notebook_error = str(exc)
            document.save(
                update_fields=[
                    "open_notebook_status",
                    "open_notebook_error",
                    "updated_at",
                ]
            )
        response_serializer = self.get_serializer(document)
        headers = self.get_success_headers(response_serializer.data)
        return Response(
            response_serializer.data,
            status=status.HTTP_201_CREATED,
            headers=headers,
        )

    def destroy(self, request, *args, **kwargs):
        document = self.get_object()
        sync_service = OpenNotebookSyncService()
        if sync_service.is_configured() and document.open_notebook_source_id:
            try:
                sync_service.delete_document(document)
            except OpenNotebookError as exc:
                return Response(
                    {"detail": str(exc)},
                    status=status.HTTP_502_BAD_GATEWAY,
                )

        if document.file:
            document.file.delete(save=False)
        document.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)

    @action(detail=True, methods=["post"], url_path="sync")
    def sync(self, request, pk=None):
        document = self.get_object()
        sync_service = OpenNotebookSyncService()
        if not sync_service.is_configured():
            return Response(
                {"detail": "Open Notebook не настроен."},
                status=status.HTTP_503_SERVICE_UNAVAILABLE,
            )

        if document.open_notebook_source_id:
            try:
                sync_service.delete_document(document)
            except OpenNotebookError as exc:
                return Response(
                    {"detail": str(exc)},
                    status=status.HTTP_502_BAD_GATEWAY,
                )

        try:
            sync_service.sync_document(document)
        except OpenNotebookError as exc:
            document.open_notebook_status = "error"
            document.open_notebook_error = str(exc)
            document.save(
                update_fields=[
                    "open_notebook_status",
                    "open_notebook_error",
                    "updated_at",
                ]
            )
            return Response(
                {"detail": str(exc)},
                status=status.HTTP_502_BAD_GATEWAY,
            )

        return Response(self.get_serializer(document).data)


class KnowledgeAskView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        question = request.data.get("question")
        insurance_type = request.data.get("insurance_type")
        if not question:
            return Response(
                {"detail": "Поле question обязательно."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        if not insurance_type:
            return Response(
                {"detail": "Поле insurance_type обязательно."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        service = OpenNotebookSyncService()
        if not service.is_configured():
            return Response(
                {"detail": "Open Notebook не настроен."},
                status=status.HTTP_503_SERVICE_UNAVAILABLE,
            )

        try:
            answer = service.ask(str(insurance_type), str(question))
        except OpenNotebookError as exc:
            return Response(
                {"detail": str(exc)},
                status=status.HTTP_502_BAD_GATEWAY,
            )

        return Response({"question": question, "answer": answer})


class DocumentRecognitionView(APIView):
    permission_classes = [AllowAny]
    parser_classes = (MultiPartParser, FormParser)

    def post(self, request):
        files = request.FILES.getlist("files")
        if not files:
            return Response(
                {"detail": "Не переданы файлы"}, status=status.HTTP_400_BAD_REQUEST
            )

        deal_id = request.data.get("deal_id")
        summaries = []
        for uploaded in files:
            uploaded.seek(0)
            preview = uploaded.read(200)
            try:
                snippet = (
                    preview.decode("utf-8", errors="ignore")
                    or "Файл содержит двоичные данные"
                )
            except Exception:
                snippet = "Файл содержит двоичные данные"
            summary = f"Файл {uploaded.name}: выделены ключевые данные. Фрагмент: {snippet[:120]}"
            summaries.append({"filename": uploaded.name, "summary": summary})
            uploaded.seek(0)

        if deal_id and summaries:
            Note.objects.create(
                deal_id=deal_id,
                body="\n".join(item["summary"] for item in summaries),
                author_name="AI Assistant",
            )

        return Response({"results": summaries})
