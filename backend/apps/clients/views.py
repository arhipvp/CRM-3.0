from apps.clients.services import ClientMergeService
from apps.common.drive import (
    DriveError,
    ensure_client_folder,
)
from apps.common.permissions import EditProtectedMixin
from apps.common.services import manage_drive_files
from apps.users.models import AuditLog, UserRole
from django.contrib.auth.models import AnonymousUser
from django.db.models import Q
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import PermissionDenied, ValidationError
from rest_framework.parsers import FormParser, MultiPartParser
from rest_framework.response import Response

from .filters import ClientFilterSet
from .models import Client
from .serializers import ClientMergeSerializer, ClientSerializer


class ClientViewSet(EditProtectedMixin, viewsets.ModelViewSet):
    serializer_class = ClientSerializer
    filterset_class = ClientFilterSet
    search_fields = ["name", "phone"]
    ordering_fields = ["created_at", "updated_at", "name"]
    ordering = ["-created_at"]
    owner_field = "created_by"

    def _resolve_user(self):
        request = getattr(self, "request", None)
        if request is None:
            return AnonymousUser()

        user = getattr(request, "user", None)
        if user is None:
            user = getattr(request, "_force_auth_user", None)
            if user is not None:
                request.user = user

        return user or AnonymousUser()

    def perform_create(self, serializer):
        serializer.save(created_by=self._resolve_user())

    def get_queryset(self):
        user = self._resolve_user()
        queryset = Client.objects.alive().order_by("-created_at")

        # Если пользователь не аутентифицирован, возвращаем все записи (AllowAny режим)
        if not user.is_authenticated:
            return queryset

        # Администраторы видят всех клиентов
        is_admin = UserRole.objects.filter(user=user, role__name="Admin").exists()

        if not is_admin:
            queryset = queryset.filter(
                Q(created_by=user) | Q(deals__seller=user) | Q(deals__executor=user)
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
        uploaded_file = request.FILES.get("file") if request.method == "POST" else None

        if request.method == "POST" and not uploaded_file:
            return Response(
                {"detail": "Файл не передан"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            result = manage_drive_files(
                instance=client,
                ensure_folder_func=ensure_client_folder,
                uploaded_file=uploaded_file,
            )
            return Response(result)
        except DriveError as exc:
            return Response(
                {"detail": str(exc)},
                status=status.HTTP_503_SERVICE_UNAVAILABLE,
            )

    @action(detail=False, methods=["post"], url_path="merge")
    def merge(self, request):
        serializer = ClientMergeSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        target_id = str(serializer.validated_data["target_client_id"])
        source_ids = [
            str(value) for value in serializer.validated_data["source_client_ids"]
        ]
        combined_ids = {target_id, *source_ids}
        clients_qs = Client.objects.with_deleted().filter(id__in=combined_ids)
        clients = list(clients_qs)
        if len(clients) != len(combined_ids):
            found_ids = {str(client.id) for client in clients}
            missing = sorted(combined_ids - found_ids)
            raise ValidationError(
                {"detail": f"Клиенты не найдены: {', '.join(missing)}"}
            )

        clients_by_id = {str(client.id): client for client in clients}
        target_client = clients_by_id[target_id]
        if target_client.deleted_at is not None:
            raise ValidationError({"target_client_id": "Целевой клиент удалён."})

        source_clients = []
        for source_id in source_ids:
            source_client = clients_by_id.get(source_id)
            if not source_client:
                continue
            if source_client.deleted_at is not None:
                raise ValidationError(
                    {"source_client_ids": "Исходные клиенты не должны быть удалены."}
                )
            source_clients.append(source_client)

        for client in (target_client, *source_clients):
            if not self._can_modify(request.user, client):
                raise PermissionDenied(
                    "Только администратор или владелец может объединять клиентов."
                )

        actor = request.user if request.user and request.user.is_authenticated else None
        merge_result = ClientMergeService(
            target_client=target_client,
            source_clients=source_clients,
            actor=actor,
        ).merge()

        source_names = sorted({client.name for client in source_clients if client.name})
        AuditLog.objects.create(
            actor=actor,
            object_type="client",
            object_id=str(target_client.id),
            object_name=target_client.name,
            action="merge",
            description=(
                f"Объединены клиенты ({', '.join(source_names)}) в '{target_client.name}'"
                if source_names
                else f"Объединены клиенты в '{target_client.name}'"
            ),
            new_value={
                "merged_clients": merge_result["merged_client_ids"],
                "moved_counts": merge_result["moved_counts"],
            },
        )

        refreshed_target = Client.objects.filter(pk=target_client.pk).first()
        response_target = refreshed_target or target_client
        return Response(
            {
                "target_client": ClientSerializer(response_target).data,
                "merged_client_ids": merge_result["merged_client_ids"],
                "moved_counts": merge_result["moved_counts"],
            }
        )
