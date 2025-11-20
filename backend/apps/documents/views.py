from apps.common.drive import (
    DriveConfigurationError,
    DriveError,
    get_document_library_folder_id,
    upload_file_to_drive,
)
from apps.common.permissions import EditProtectedMixin
from apps.notes.models import Note
from apps.users.models import UserRole
from django.db.models import Q
from rest_framework import permissions, status, viewsets
from rest_framework.parsers import FormParser, MultiPartParser
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import Document, KnowledgeDocument
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


class KnowledgeDocumentPermission(permissions.BasePermission):
    def _is_admin(self, request):
        if not request.user or not request.user.is_authenticated:
            return False
        return UserRole.objects.filter(user=request.user, role__name="Admin").exists()

    def has_permission(self, request, view):
        if request.method in permissions.SAFE_METHODS or request.method == "POST":
            return True
        return self._is_admin(request)

    def has_object_permission(self, request, view, obj):
        if request.method in permissions.SAFE_METHODS:
            return True
        return self._is_admin(request)


class KnowledgeDocumentViewSet(viewsets.ModelViewSet):
    queryset = KnowledgeDocument.objects.all()
    serializer_class = KnowledgeDocumentSerializer
    permission_classes = [KnowledgeDocumentPermission]
    parser_classes = (MultiPartParser, FormParser)

    def create(self, request, *args, **kwargs):
        file_obj = request.FILES.get("file")
        if not file_obj:
            return Response(
                {"detail": "Поле file обязательно."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        title = request.data.get("title") or file_obj.name
        description = request.data.get("description", "")
        try:
            folder_id = get_document_library_folder_id()
            upload_info = upload_file_to_drive(
                folder_id,
                file_obj,
                file_obj.name,
                file_obj.content_type,
            )
        except DriveConfigurationError as exc:
            return Response(
                {"detail": str(exc)},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )
        except DriveError as exc:
            return Response(
                {"detail": str(exc)},
                status=status.HTTP_502_BAD_GATEWAY,
            )

        serializer = self.get_serializer(
            data={"title": title, "description": description}
        )
        serializer.is_valid(raise_exception=True)
        serializer.save(
            owner=request.user
            if request.user and request.user.is_authenticated
            else None,
            file_name=file_obj.name,
            drive_file_id=upload_info["id"],
            web_view_link=upload_info["web_view_link"] or "",
            mime_type=upload_info["mime_type"] or file_obj.content_type or "",
            file_size=upload_info["size"] or file_obj.size,
        )
        headers = self.get_success_headers(serializer.data)
        return Response(serializer.data, status=status.HTTP_201_CREATED, headers=headers)


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
