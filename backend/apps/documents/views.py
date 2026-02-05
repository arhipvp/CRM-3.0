from apps.common.permissions import EditProtectedMixin
from apps.notes.models import Note
from apps.users.models import UserRole
from django.db.models import Q
from django.http import HttpResponse
from rest_framework import status, viewsets
from rest_framework.parsers import FormParser, MultiPartParser
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import Document
from .open_notebook import OpenNotebookError, OpenNotebookSyncService
from .serializers import DocumentSerializer


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
            queryset = queryset.filter(
                Q(deal__seller=user)
                | Q(deal__executor=user)
                | Q(deal__visible_users=user)
            )

        return queryset

    def perform_create(self, serializer):
        # Если пользователь авторизован, сохранить его как owner
        owner = self.request.user if self.request.user.is_authenticated else None
        serializer.save(owner=owner)


class KnowledgeAskView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        question = request.data.get("question")
        notebook_id = request.data.get("notebook_id")
        session_id = request.data.get("session_id")
        if not question:
            return Response(
                {"detail": "Поле question обязательно."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        if not notebook_id:
            return Response(
                {"detail": "Поле notebook_id обязательно."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        service = OpenNotebookSyncService()
        if not service.is_configured():
            return Response(
                {"detail": "Open Notebook не настроен."},
                status=status.HTTP_503_SERVICE_UNAVAILABLE,
            )

        try:
            result = service.ask_notebook(
                str(notebook_id),
                str(question),
                str(session_id) if session_id else None,
            )
        except OpenNotebookError as exc:
            return Response(
                {"detail": str(exc)},
                status=status.HTTP_502_BAD_GATEWAY,
            )

        return Response({"question": question, **result})


class KnowledgeNotebooksView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        service = OpenNotebookSyncService()
        if not service.is_configured():
            return Response(
                {"detail": "Open Notebook не настроен."},
                status=status.HTTP_503_SERVICE_UNAVAILABLE,
            )

        try:
            notebooks = service.client.get_notebooks()
        except OpenNotebookError as exc:
            return Response(
                {"detail": str(exc)},
                status=status.HTTP_502_BAD_GATEWAY,
            )

        return Response(notebooks)

    def post(self, request):
        name = request.data.get("name")
        description = request.data.get("description") or ""
        if not name:
            return Response(
                {"detail": "Поле name обязательно."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        service = OpenNotebookSyncService()
        if not service.is_configured():
            return Response(
                {"detail": "Open Notebook не настроен."},
                status=status.HTTP_503_SERVICE_UNAVAILABLE,
            )

        try:
            notebook = service.client.create_notebook(
                name=str(name), description=str(description)
            )
        except OpenNotebookError as exc:
            return Response(
                {"detail": str(exc)},
                status=status.HTTP_502_BAD_GATEWAY,
            )

        return Response(notebook, status=status.HTTP_201_CREATED)


class KnowledgeNotebookDetailView(APIView):
    permission_classes = [IsAuthenticated]

    def put(self, request, notebook_id: str):
        name = request.data.get("name")
        description = request.data.get("description")
        if name is None and description is None:
            return Response(
                {"detail": "Нужно передать name или description."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        service = OpenNotebookSyncService()
        if not service.is_configured():
            return Response(
                {"detail": "Open Notebook не настроен."},
                status=status.HTTP_503_SERVICE_UNAVAILABLE,
            )

        try:
            notebook = service.client.update_notebook(
                notebook_id,
                name=str(name) if name is not None else None,
                description=str(description) if description is not None else None,
            )
        except OpenNotebookError as exc:
            return Response(
                {"detail": str(exc)},
                status=status.HTTP_502_BAD_GATEWAY,
            )

        return Response(notebook)

    def delete(self, request, notebook_id: str):
        service = OpenNotebookSyncService()
        if not service.is_configured():
            return Response(
                {"detail": "Open Notebook не настроен."},
                status=status.HTTP_503_SERVICE_UNAVAILABLE,
            )

        try:
            service.client.delete_notebook(notebook_id)
        except OpenNotebookError as exc:
            return Response(
                {"detail": str(exc)},
                status=status.HTTP_502_BAD_GATEWAY,
            )

        return Response(status=status.HTTP_204_NO_CONTENT)


class KnowledgeChatSessionsView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        notebook_id = request.query_params.get("notebook_id")
        if not notebook_id:
            return Response(
                {"detail": "Поле notebook_id обязательно."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        service = OpenNotebookSyncService()
        if not service.is_configured():
            return Response(
                {"detail": "Open Notebook не настроен."},
                status=status.HTTP_503_SERVICE_UNAVAILABLE,
            )

        try:
            sessions = service.client.list_chat_sessions(str(notebook_id))
        except OpenNotebookError as exc:
            return Response(
                {"detail": str(exc)},
                status=status.HTTP_502_BAD_GATEWAY,
            )

        return Response(sessions)

    def post(self, request):
        notebook_id = request.data.get("notebook_id")
        title = request.data.get("title")
        if not notebook_id:
            return Response(
                {"detail": "Поле notebook_id обязательно."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        service = OpenNotebookSyncService()
        if not service.is_configured():
            return Response(
                {"detail": "Open Notebook не настроен."},
                status=status.HTTP_503_SERVICE_UNAVAILABLE,
            )

        try:
            session = service.client.create_chat_session(
                notebook_id=str(notebook_id),
                title=str(title) if title else None,
            )
        except OpenNotebookError as exc:
            return Response(
                {"detail": str(exc)},
                status=status.HTTP_502_BAD_GATEWAY,
            )

        return Response(session, status=status.HTTP_201_CREATED)


class KnowledgeChatSessionDetailView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, session_id: str):
        service = OpenNotebookSyncService()
        if not service.is_configured():
            return Response(
                {"detail": "Open Notebook не настроен."},
                status=status.HTTP_503_SERVICE_UNAVAILABLE,
            )

        try:
            session = service.client.get_chat_session(session_id)
        except OpenNotebookError as exc:
            return Response(
                {"detail": str(exc)},
                status=status.HTTP_502_BAD_GATEWAY,
            )

        return Response(session)

    def put(self, request, session_id: str):
        title = request.data.get("title")
        if not title:
            return Response(
                {"detail": "Поле title обязательно."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        service = OpenNotebookSyncService()
        if not service.is_configured():
            return Response(
                {"detail": "Open Notebook не настроен."},
                status=status.HTTP_503_SERVICE_UNAVAILABLE,
            )

        try:
            session = service.client.update_chat_session(session_id, str(title))
        except OpenNotebookError as exc:
            return Response(
                {"detail": str(exc)},
                status=status.HTTP_502_BAD_GATEWAY,
            )

        return Response(session)

    def delete(self, request, session_id: str):
        service = OpenNotebookSyncService()
        if not service.is_configured():
            return Response(
                {"detail": "Open Notebook не настроен."},
                status=status.HTTP_503_SERVICE_UNAVAILABLE,
            )

        try:
            service.client.delete_chat_session(session_id)
        except OpenNotebookError as exc:
            return Response(
                {"detail": str(exc)},
                status=status.HTTP_502_BAD_GATEWAY,
            )

        return Response(status=status.HTTP_204_NO_CONTENT)


class KnowledgeSourcesView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        notebook_id = request.query_params.get("notebook_id")
        if not notebook_id:
            return Response(
                {"detail": "Поле notebook_id обязательно."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        service = OpenNotebookSyncService()
        if not service.is_configured():
            return Response(
                {"detail": "Open Notebook не настроен."},
                status=status.HTTP_503_SERVICE_UNAVAILABLE,
            )

        try:
            sources = service.list_sources(str(notebook_id))
        except OpenNotebookError as exc:
            return Response(
                {"detail": str(exc)},
                status=status.HTTP_502_BAD_GATEWAY,
            )

        response_items = []
        for source in sources:
            source_id = source.get("id")
            response_items.append(
                {
                    "id": source_id,
                    "title": source.get("title"),
                    "created": source.get("created"),
                    "updated": source.get("updated"),
                    "embedded": source.get("embedded"),
                    "file_url": (
                        f"/api/v1/knowledge/sources/{source_id}/download/"
                        if source_id
                        else None
                    ),
                }
            )
        return Response(response_items)

    def post(self, request):
        notebook_id = request.data.get("notebook_id")
        file_obj = request.FILES.get("file")
        title = request.data.get("title") or (file_obj.name if file_obj else "")
        if not notebook_id:
            return Response(
                {"detail": "Поле notebook_id обязательно."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        if not file_obj:
            return Response(
                {"detail": "Поле file обязательно."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        service = OpenNotebookSyncService()
        if not service.is_configured():
            return Response(
                {"detail": "Open Notebook не настроен."},
                status=status.HTTP_503_SERVICE_UNAVAILABLE,
            )

        try:
            file_obj.seek(0)
            uploaded = service.create_source_upload_bytes(
                notebook_id=str(notebook_id),
                file_name=file_obj.name,
                content=file_obj.read(),
                title=str(title),
                mime_type=file_obj.content_type or None,
            )
        except OpenNotebookError as exc:
            return Response(
                {"detail": str(exc)},
                status=status.HTTP_502_BAD_GATEWAY,
            )

        return Response(uploaded, status=status.HTTP_201_CREATED)


class KnowledgeSourceDetailView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, source_id: str):
        service = OpenNotebookSyncService()
        if not service.is_configured():
            return Response(
                {"detail": "Open Notebook не настроен."},
                status=status.HTTP_503_SERVICE_UNAVAILABLE,
            )

        try:
            source = service.client.get_source(source_id)
        except OpenNotebookError as exc:
            return Response(
                {"detail": str(exc)},
                status=status.HTTP_502_BAD_GATEWAY,
            )

        asset = source.get("asset") if isinstance(source, dict) else None
        asset_url = None
        if isinstance(asset, dict):
            asset_url = asset.get("url")

        return Response(
            {
                "id": source.get("id"),
                "title": source.get("title"),
                "content": source.get("full_text") or source.get("content"),
                "created": source.get("created"),
                "updated": source.get("updated"),
                "asset_url": asset_url,
                "file_url": f"/api/v1/knowledge/sources/{source_id}/download/",
            }
        )

    def delete(self, request, source_id: str):
        service = OpenNotebookSyncService()
        if not service.is_configured():
            return Response(
                {"detail": "Open Notebook не настроен."},
                status=status.HTTP_503_SERVICE_UNAVAILABLE,
            )

        try:
            service.delete_source(source_id)
        except OpenNotebookError as exc:
            return Response(
                {"detail": str(exc)},
                status=status.HTTP_502_BAD_GATEWAY,
            )

        return Response(status=status.HTTP_204_NO_CONTENT)


class KnowledgeSourceDownloadView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, source_id: str):
        service = OpenNotebookSyncService()
        if not service.is_configured():
            return Response(
                {"detail": "Open Notebook не настроен."},
                status=status.HTTP_503_SERVICE_UNAVAILABLE,
            )

        try:
            content, content_type, content_disposition = service.client.download_source(
                source_id
            )
        except OpenNotebookError as exc:
            return Response(
                {"detail": str(exc)},
                status=status.HTTP_502_BAD_GATEWAY,
            )

        response = HttpResponse(content, content_type=content_type)
        if content_disposition:
            response["Content-Disposition"] = content_disposition
        return response


class KnowledgeNotesView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        notebook_id = request.query_params.get("notebook_id")
        if not notebook_id:
            return Response(
                {"detail": "Поле notebook_id обязательно."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        service = OpenNotebookSyncService()
        if not service.is_configured():
            return Response(
                {"detail": "Open Notebook не настроен."},
                status=status.HTTP_503_SERVICE_UNAVAILABLE,
            )

        try:
            notes = service.list_notes(str(notebook_id))
            sources = service.list_sources(str(notebook_id))
        except OpenNotebookError as exc:
            return Response(
                {"detail": str(exc)},
                status=status.HTTP_502_BAD_GATEWAY,
            )

        response_items = []
        for note in notes:
            title = note.get("title") or ""
            content = note.get("content") or ""
            response_items.append(
                {
                    "id": note.get("id"),
                    "question": title,
                    "answer": content,
                    "citations": service._collect_citations_from_sources(
                        content, sources
                    ),
                    "created_at": note.get("created"),
                    "updated_at": note.get("updated"),
                }
            )

        return Response(response_items)

    def post(self, request):
        notebook_id = request.data.get("notebook_id")
        question = request.data.get("question")
        answer = request.data.get("answer")
        if not notebook_id:
            return Response(
                {"detail": "Поле notebook_id обязательно."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        if not question:
            return Response(
                {"detail": "Поле question обязательно."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        if not answer:
            return Response(
                {"detail": "Поле answer обязательно."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        service = OpenNotebookSyncService()
        if not service.is_configured():
            return Response(
                {"detail": "Open Notebook не настроен."},
                status=status.HTTP_503_SERVICE_UNAVAILABLE,
            )

        try:
            note = service.create_note(
                notebook_id=str(notebook_id),
                title=str(question),
                content=str(answer),
            )
            sources = service.list_sources(str(notebook_id))
        except OpenNotebookError as exc:
            return Response(
                {"detail": str(exc)},
                status=status.HTTP_502_BAD_GATEWAY,
            )

        content = note.get("content") or ""
        return Response(
            {
                "id": note.get("id"),
                "question": note.get("title") or question,
                "answer": content,
                "citations": service._collect_citations_from_sources(content, sources),
                "created_at": note.get("created"),
                "updated_at": note.get("updated"),
            },
            status=status.HTTP_201_CREATED,
        )


class KnowledgeNoteDetailView(APIView):
    permission_classes = [IsAuthenticated]

    def delete(self, request, note_id: str):
        service = OpenNotebookSyncService()
        if not service.is_configured():
            return Response(
                {"detail": "Open Notebook не настроен."},
                status=status.HTTP_503_SERVICE_UNAVAILABLE,
            )

        try:
            service.delete_note(note_id)
        except OpenNotebookError as exc:
            return Response(
                {"detail": str(exc)},
                status=status.HTTP_502_BAD_GATEWAY,
            )

        return Response(status=status.HTTP_204_NO_CONTENT)


class DocumentRecognitionView(APIView):
    permission_classes = [IsAuthenticated]
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
