from __future__ import annotations

from django.conf import settings
from django.http import StreamingHttpResponse
from rest_framework import status
from rest_framework.parsers import FormParser, MultiPartParser
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from .service import (
    AssistantService,
    AssistantServiceError,
    AssistantServiceNotFound,
)


def _can_manage_library(user) -> bool:
    return bool(
        user.is_superuser
        or user.is_staff
        or user.username.casefold()
        == settings.INSURANCE_ASSISTANT_LIBRARY_MANAGER.casefold()
    )


class AssistantProxyView(APIView):
    permission_classes = [IsAuthenticated]

    def service(self, request) -> AssistantService:
        return AssistantService(request.user.id)

    def call(self, request, method: str, path: str, **kwargs) -> Response:
        try:
            return Response(self.service(request).request(method, path, **kwargs))
        except AssistantServiceError as exc:
            return Response({"detail": str(exc)}, status=exc.status_code)


class ProvidersView(AssistantProxyView):
    def get(self, request):
        return self.call(request, "GET", "/api/providers")


class UsageView(AssistantProxyView):
    def get(self, request):
        return self.call(request, "GET", "/api/usage")


class CatalogView(AssistantProxyView):
    def get(self, request):
        return self.call(request, "GET", "/api/catalog")


class ConversationsView(AssistantProxyView):
    def get(self, request):
        return self.call(request, "GET", "/api/conversations")

    def post(self, request):
        return self.call(request, "POST", "/api/conversations", json=request.data)


class ConversationDetailView(AssistantProxyView):
    def patch(self, request, conversation_id: str):
        return self.call(
            request,
            "PATCH",
            f"/api/conversations/{conversation_id}",
            json=request.data,
        )

    def delete(self, request, conversation_id: str):
        return self.call(request, "DELETE", f"/api/conversations/{conversation_id}")


class ConversationMessagesView(AssistantProxyView):
    def get(self, request, conversation_id: str):
        return self.call(
            request, "GET", f"/api/conversations/{conversation_id}/messages"
        )

    def post(self, request, conversation_id: str):
        try:
            response = StreamingHttpResponse(
                self.service(request).stream(
                    f"/api/conversations/{conversation_id}/messages", dict(request.data)
                ),
                content_type="text/event-stream",
            )
        except AssistantServiceError as exc:
            return Response({"detail": str(exc)}, status=exc.status_code)
        response["Cache-Control"] = "no-cache"
        response["X-Accel-Buffering"] = "no"
        return response


class DocumentsView(AssistantProxyView):
    parser_classes = (MultiPartParser, FormParser)

    def get(self, request):
        return self.call(request, "GET", "/api/documents")

    def post(self, request):
        if not _can_manage_library(request.user):
            return Response(
                {"detail": "Недостаточно прав для загрузки источников."}, status=403
            )
        files = request.FILES.getlist("files")
        if not files:
            return Response({"detail": "Не переданы файлы."}, status=400)
        upload_files = [
            ("files", (item.name, item.read(), item.content_type)) for item in files
        ]
        metadata = {
            key: request.data.get(key, "")
            for key in (
                "insurer",
                "insurance_kind",
                "product",
                "document_type",
                "effective_from",
                "effective_to",
            )
        }
        return self.call(
            request, "POST", "/api/documents", files=upload_files, data=metadata
        )


class DocumentDetailView(AssistantProxyView):
    def delete(self, request, document_id: str):
        if not _can_manage_library(request.user):
            return Response(
                {"detail": "Недостаточно прав для удаления источников."}, status=403
            )
        return self.call(request, "DELETE", f"/api/documents/{document_id}")


class DocumentClassificationView(AssistantProxyView):
    def patch(self, request):
        if not _can_manage_library(request.user):
            return Response(
                {"detail": "Недостаточно прав для классификации источников."},
                status=403,
            )
        return self.call(
            request, "PATCH", "/api/documents/classification", json=request.data
        )


class DocumentContentView(AssistantProxyView):
    def get(self, request, document_id: str):
        try:
            headers, content = self.service(request).download(
                f"/api/documents/{document_id}/content"
            )
        except AssistantServiceNotFound as exc:
            return Response({"detail": str(exc)}, status=status.HTTP_404_NOT_FOUND)
        except AssistantServiceError as exc:
            return Response({"detail": str(exc)}, status=exc.status_code)
        response = StreamingHttpResponse(content, content_type=headers["Content-Type"])
        response["Content-Disposition"] = headers["Content-Disposition"]
        response["X-Content-Type-Options"] = "nosniff"
        return response
