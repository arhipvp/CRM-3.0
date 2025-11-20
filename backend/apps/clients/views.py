from apps.common.permissions import EditProtectedMixin
from apps.users.models import UserRole
from django.db.models import Q
from rest_framework import permissions, viewsets
from rest_framework.permissions import AllowAny

from .filters import ClientFilterSet
from .models import Client
from apps.common.drive import (
    DriveError,
    ensure_client_folder,
    list_drive_folder_contents,
    upload_file_to_drive,
)
from .serializers import ClientSerializer
from rest_framework.parsers import FormParser, MultiPartParser
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework import status


class ClientViewSet(EditProtectedMixin, viewsets.ModelViewSet):
    serializer_class = ClientSerializer
    filterset_class = ClientFilterSet
    search_fields = ["name", "phone"]
    ordering_fields = ["created_at", "updated_at", "name"]
    ordering = ["-created_at"]
    owner_field = "created_by"

    def perform_create(self, serializer):
        serializer.save(created_by=self.request.user)

    def get_queryset(self):
        user = self.request.user
        queryset = Client.objects.alive().order_by("-created_at")

        # Если пользователь не аутентифицирован, возвращаем все записи (AllowAny режим)
        if not user.is_authenticated:
            return queryset

        # Администраторы видят всех клиентов
        is_admin = UserRole.objects.filter(user=user, role__name="Admin").exists()

        if not is_admin:
            queryset = queryset.filter(
                Q(created_by=user)
                | Q(deals__seller=user)
                | Q(deals__executor=user)
            ).distinct()

        return queryset

    @action(
        detail=True,
        methods=["get", "post"],
        url_path="drive-files",
        parser_classes=[MultiPartParser, FormParser],
    )
    def drive_files(self, request, pk=None):
        client = self.get_object()
        try:
            folder_id = ensure_client_folder(client) or client.drive_folder_id
        except DriveError as exc:
            return Response(
                {"detail": str(exc)},
                status=status.HTTP_503_SERVICE_UNAVAILABLE,
            )

        if not folder_id:
            return Response({"files": [], "folder_id": None})

        if request.method == "POST":
            uploaded_file = request.FILES.get("file")
            if not uploaded_file:
                return Response(
                    {"detail": "Файл не передан"},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            try:
                drive_file = upload_file_to_drive(
                    folder_id,
                    uploaded_file.file,
                    uploaded_file.name,
                    uploaded_file.content_type or "application/octet-stream",
                )
            except DriveError as exc:
                return Response(
                    {"detail": str(exc)},
                    status=status.HTTP_503_SERVICE_UNAVAILABLE,
                )
            return Response({"file": drive_file, "folder_id": folder_id})

        try:
            files = list_drive_folder_contents(folder_id)
        except DriveError as exc:
            return Response(
                {"detail": str(exc)},
                status=status.HTTP_503_SERVICE_UNAVAILABLE,
            )

        return Response({"files": files, "folder_id": folder_id})
