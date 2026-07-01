from apps.clients.services import (
    ClientMergeService,
    ClientMergeSessionService,
    ClientSimilarityService,
    normalize_client_name,
)
from apps.common.drive import DriveError, ensure_client_folder
from apps.common.permissions import EditProtectedMixin
from apps.common.services import manage_drive_files
from apps.deals.models import Deal
from apps.users.models import AuditLog
from django.contrib.auth.models import AnonymousUser
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import PermissionDenied, ValidationError
from rest_framework.parsers import FormParser, MultiPartParser
from rest_framework.response import Response

from .filters import ClientFilterSet
from .models import Client, ClientMergeSession, ClientSimilarityExclusion
from .serializers import (
    ClientDuplicateHintsSerializer,
    ClientMergePreviewSerializer,
    ClientMergeSerializer,
    ClientSerializer,
    ClientSimilarityExclusionSerializer,
    ClientSimilarSerializer,
)

CLIENT_MERGE_PERMISSION_MESSAGE = (
    "Только авторизованный пользователь может объединять клиентов."
)


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
        queryset = Client.objects.alive().order_by("-created_at")
        return queryset

    def partial_update(self, request, *args, **kwargs):
        client = self.get_object()
        if self._can_modify(request.user, client):
            return super().partial_update(request, *args, **kwargs)
        if self._can_update_counterparty_flag(request.user, client, request.data):
            return viewsets.ModelViewSet.update(
                self, request, *args, partial=True, **kwargs
            )
        return Response(
            {"detail": "Только администратор или владелец может редактировать данные"},
            status=status.HTTP_403_FORBIDDEN,
        )

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

        target_client, source_clients = self._resolve_merge_clients(
            serializer.validated_data
        )

        for client in (target_client, *source_clients):
            if not self._can_merge_client(request.user, client):
                raise PermissionDenied(CLIENT_MERGE_PERMISSION_MESSAGE)

        actor = request.user if request.user and request.user.is_authenticated else None
        include_deleted = serializer.validated_data.get("include_deleted", True)
        field_overrides = serializer.validated_data.get("field_overrides") or {}
        preview_snapshot_id = serializer.validated_data.get("preview_snapshot_id", "")
        try:
            merge_result = ClientMergeService(
                target_client=target_client,
                source_clients=source_clients,
                actor=actor,
                include_deleted=include_deleted,
                field_overrides=field_overrides,
            ).merge()
        except ValueError as exc:
            raise ValidationError({"field_overrides": str(exc)}) from exc
        except DriveError as exc:
            return Response(
                {
                    "detail": str(exc),
                    "warning": (
                        "Ошибка Google Drive: часть папок могла быть не перенесена."
                    ),
                },
                status=status.HTTP_503_SERVICE_UNAVAILABLE,
            )

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
                "preview_snapshot_id": preview_snapshot_id or None,
                "field_overrides": field_overrides,
                "include_deleted": include_deleted,
            },
        )

        refreshed_target = Client.objects.filter(pk=target_client.pk).first()
        response_target = refreshed_target or target_client
        return Response(
            {
                "target_client": ClientSerializer(response_target).data,
                "merged_client_ids": merge_result["merged_client_ids"],
                "moved_counts": merge_result["moved_counts"],
                "warnings": merge_result.get("warnings", []),
                "details": merge_result.get("details", {}),
            }
        )

    @action(detail=False, methods=["post"], url_path="merge/start")
    def merge_start(self, request):
        serializer = ClientMergeSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        target_client, source_clients = self._resolve_merge_clients(
            serializer.validated_data
        )
        for client in (target_client, *source_clients):
            if not self._can_merge_client(request.user, client):
                raise PermissionDenied(CLIENT_MERGE_PERMISSION_MESSAGE)

        actor = request.user if request.user and request.user.is_authenticated else None
        try:
            session = ClientMergeSessionService.start(
                target_client=target_client,
                source_clients=source_clients,
                actor=actor,
                include_deleted=serializer.validated_data.get("include_deleted", True),
                field_overrides=serializer.validated_data.get("field_overrides") or {},
                preview_snapshot_id=serializer.validated_data.get(
                    "preview_snapshot_id", ""
                ),
            )
        except ValueError as exc:
            raise ValidationError({"field_overrides": str(exc)}) from exc
        except DriveError as exc:
            return Response(
                {
                    "detail": str(exc),
                    "warning": (
                        "Ошибка Google Drive: не удалось подготовить пошаговое "
                        "объединение."
                    ),
                },
                status=status.HTTP_503_SERVICE_UNAVAILABLE,
            )
        return Response(
            ClientMergeSessionService(session).serialize(),
            status=status.HTTP_201_CREATED,
        )

    @action(
        detail=False,
        methods=["get"],
        url_path=r"merge/(?P<session_id>[0-9a-f-]{36})",
    )
    def merge_session(self, request, session_id=None):
        session = self._get_merge_session(request.user, session_id)
        return Response(ClientMergeSessionService(session).serialize())

    @action(
        detail=False,
        methods=["post"],
        url_path=r"merge/(?P<session_id>[0-9a-f-]{36})/step",
    )
    def merge_step(self, request, session_id=None):
        session = self._get_merge_session(request.user, session_id)
        session = ClientMergeSessionService(session).step()
        return Response(ClientMergeSessionService(session).serialize())

    @action(
        detail=False,
        methods=["post"],
        url_path=r"merge/(?P<session_id>[0-9a-f-]{36})/retry",
    )
    def merge_retry(self, request, session_id=None):
        session = self._get_merge_session(request.user, session_id)
        session = ClientMergeSessionService(session).retry()
        return Response(ClientMergeSessionService(session).serialize())

    @action(
        detail=False,
        methods=["post"],
        url_path=r"merge/(?P<session_id>[0-9a-f-]{36})/finalize",
    )
    def merge_finalize(self, request, session_id=None):
        session = self._get_merge_session(request.user, session_id)
        target_client, source_clients = self._resolve_merge_clients(
            {
                "target_client_id": session.target_client_id,
                "source_client_ids": session.source_client_ids,
            }
        )
        for client in (target_client, *source_clients):
            if not self._can_merge_client(request.user, client):
                raise PermissionDenied(CLIENT_MERGE_PERMISSION_MESSAGE)

        actor = request.user if request.user and request.user.is_authenticated else None
        try:
            merge_result = ClientMergeSessionService(session).finalize(
                target_client=target_client,
                source_clients=source_clients,
                actor=actor,
            )
        except ValueError as exc:
            raise ValidationError({"detail": str(exc)}) from exc

        self._write_merge_audit(
            actor=actor,
            target_client=target_client,
            source_clients=source_clients,
            merge_result=merge_result,
            preview_snapshot_id=session.preview_snapshot_id,
            field_overrides=session.field_overrides or {},
            include_deleted=session.include_deleted,
        )
        return Response(self._merge_response_payload(target_client, merge_result))

    @action(detail=False, methods=["post"], url_path="merge/preview")
    def merge_preview(self, request):
        serializer = ClientMergePreviewSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        target_client, source_clients = self._resolve_merge_clients(
            serializer.validated_data
        )

        for client in (target_client, *source_clients):
            if not self._can_merge_client(request.user, client):
                raise PermissionDenied(CLIENT_MERGE_PERMISSION_MESSAGE)

        include_deleted = serializer.validated_data.get("include_deleted", True)
        preview = ClientMergeService(
            target_client=target_client,
            source_clients=source_clients,
            include_deleted=include_deleted,
        ).build_preview()
        return Response(preview)

    @action(detail=False, methods=["post"], url_path="similar")
    def similar(self, request):
        serializer = ClientSimilarSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        target_client_id = serializer.validated_data["target_client_id"]
        limit = serializer.validated_data.get("limit", 50)
        include_self = serializer.validated_data.get("include_self", False)

        queryset = self.get_queryset()
        target_client = queryset.filter(id=target_client_id).first()
        if not target_client:
            raise ValidationError(
                {"target_client_id": "Клиент не найден или недоступен."}
            )

        result = ClientSimilarityService().find_similar(
            target_client=target_client,
            queryset=queryset,
            limit=limit,
            include_self=include_self,
        )

        candidates_payload = []
        for item in result["candidates"]:
            candidate = item["client"]
            candidates_payload.append(
                {
                    "client": ClientSerializer(candidate).data,
                    "score": item["score"],
                    "confidence": item["confidence"],
                    "reasons": item["reasons"],
                    "matched_fields": item["matched_fields"],
                    "relation_counts": self._client_relation_counts(candidate),
                }
            )

        return Response(
            {
                "target_client": ClientSerializer(target_client).data,
                "candidates": candidates_payload,
                "meta": result["meta"],
            }
        )

    @action(detail=False, methods=["post"], url_path="duplicate-hints")
    def duplicate_hints(self, request):
        serializer = ClientDuplicateHintsSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        client_ids = [str(value) for value in serializer.validated_data["client_ids"]]
        queryset = self.get_queryset()
        clients = list(queryset.filter(id__in=client_ids))
        clients_by_id = {str(client.id): client for client in clients}
        missing = [
            client_id for client_id in client_ids if client_id not in clients_by_id
        ]
        if missing:
            raise ValidationError(
                {"client_ids": f"Клиенты не найдены: {', '.join(missing)}"}
            )

        hints = ClientSimilarityService().build_duplicate_hints(
            clients=[clients_by_id[client_id] for client_id in client_ids],
            queryset=queryset,
        )
        return Response({"results": hints})

    @action(detail=False, methods=["post"], url_path="similarity-exclusions")
    def similarity_exclusions(self, request):
        serializer = ClientSimilarityExclusionSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        target_client_id = str(serializer.validated_data["target_client_id"])
        candidate_client_id = str(serializer.validated_data["candidate_client_id"])

        queryset = self.get_queryset()
        clients = list(queryset.filter(id__in=[target_client_id, candidate_client_id]))
        clients_by_id = {str(client.id): client for client in clients}
        missing = [
            client_id
            for client_id in [target_client_id, candidate_client_id]
            if client_id not in clients_by_id
        ]
        if missing:
            raise ValidationError(
                {"detail": f"Клиенты не найдены: {', '.join(missing)}"}
            )

        for client in clients_by_id.values():
            if not self._can_merge_client(request.user, client):
                raise PermissionDenied(CLIENT_MERGE_PERMISSION_MESSAGE)

        first_client_id, second_client_id = ClientSimilarityExclusion.ordered_pair(
            target_client_id,
            candidate_client_id,
        )
        exclusion, _ = ClientSimilarityExclusion.objects.get_or_create(
            first_client_id=first_client_id,
            second_client_id=second_client_id,
            defaults={
                "created_by": (
                    request.user
                    if request.user and request.user.is_authenticated
                    else None
                )
            },
        )

        return Response(
            {
                "id": str(exclusion.id),
                "first_client_id": str(exclusion.first_client_id),
                "second_client_id": str(exclusion.second_client_id),
                "created_at": exclusion.created_at.isoformat(),
            },
            status=status.HTTP_200_OK,
        )

    @action(detail=True, methods=["post"], url_path="normalize-name")
    def normalize_name(self, request, pk=None):
        client = self.get_object()
        if not self._can_modify(request.user, client):
            raise PermissionDenied(
                "Только администратор или владелец может нормализовать имя клиента."
            )
        normalized_name = normalize_client_name(client.name)
        if not normalized_name:
            raise ValidationError(
                {"name": "Итоговое имя клиента не может быть пустым."}
            )

        old_name = client.name
        if old_name != normalized_name:
            actor = (
                request.user if request.user and request.user.is_authenticated else None
            )
            client._audit_actor = actor
            client.name = normalized_name
            client.save(update_fields=["name", "updated_at"])

        return Response(ClientSerializer(client).data)

    def _get_merge_session(self, user, session_id) -> ClientMergeSession:
        session = ClientMergeSession.objects.filter(id=session_id).first()
        if not session:
            raise ValidationError({"detail": "Сессия объединения не найдена."})
        if self._is_admin(user):
            return session
        if (
            user
            and user.is_authenticated
            and session.requested_by_id
            and session.requested_by_id == user.id
        ):
            return session
        raise PermissionDenied("Сессия объединения недоступна.")

    def _write_merge_audit(
        self,
        *,
        actor,
        target_client: Client,
        source_clients: list[Client],
        merge_result: dict,
        preview_snapshot_id: str,
        field_overrides: dict,
        include_deleted: bool,
    ) -> None:
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
                "preview_snapshot_id": preview_snapshot_id or None,
                "field_overrides": field_overrides,
                "include_deleted": include_deleted,
            },
        )

    def _merge_response_payload(
        self, target_client: Client, merge_result: dict
    ) -> dict:
        refreshed_target = Client.objects.filter(pk=target_client.pk).first()
        response_target = refreshed_target or target_client
        return {
            "target_client": ClientSerializer(response_target).data,
            "merged_client_ids": merge_result["merged_client_ids"],
            "moved_counts": merge_result["moved_counts"],
            "warnings": merge_result.get("warnings", []),
            "details": merge_result.get("details", {}),
        }

    def _client_relation_counts(self, client: Client) -> dict:
        return {
            "deals": client.deals.count(),
            "policies": client.policies.count(),
            "insured_policies": client.insured_policies.count(),
        }

    def _can_merge_client(self, user, client: Client) -> bool:
        return bool(user and user.is_authenticated)

    def _can_update_counterparty_flag(self, user, client: Client, data) -> bool:
        if not user or not user.is_authenticated:
            return False
        if "is_counterparty" not in data:
            return False
        if not Deal.objects.alive().filter(client=client, seller_id=user.id).exists():
            return False

        unchanged_fields = {
            "name": client.name,
            "phone": client.phone,
            "email": client.email,
            "birth_date": client.birth_date.isoformat() if client.birth_date else None,
            "notes": client.notes,
        }
        for field, current_value in unchanged_fields.items():
            if field in data and data.get(field) != current_value:
                return False
        return True

    def _resolve_merge_clients(self, data):
        target_id = str(data["target_client_id"])
        source_ids = [str(value) for value in data["source_client_ids"]]
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

        return target_client, source_clients
