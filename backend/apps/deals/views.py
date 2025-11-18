import json

from apps.common.drive import (
    DriveError,
    ensure_deal_folder,
    list_drive_folder_contents,
    upload_file_to_drive,
)
from apps.common.permissions import EditProtectedMixin
from apps.documents.models import Document
from apps.finances.models import FinancialRecord, Payment
from apps.notes.models import Note
from apps.policies.models import Policy
from apps.tasks.models import Task
from apps.users.models import AuditLog, UserRole
from django.db.models import F, Q
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.parsers import FormParser, MultiPartParser
from rest_framework.response import Response

from .filters import DealFilterSet
from .models import Deal, InsuranceCompany, InsuranceType, Quote, SalesChannel
from .serializers import (
    DealSerializer,
    InsuranceCompanySerializer,
    InsuranceTypeSerializer,
    QuoteSerializer,
    SalesChannelSerializer,
)


class DealViewSet(EditProtectedMixin, viewsets.ModelViewSet):
    serializer_class = DealSerializer
    filterset_class = DealFilterSet
    search_fields = ["title", "description"]
    ordering_fields = ["created_at", "updated_at", "title", "expected_close", "next_contact_date"]
    ordering = ["next_contact_date", "-created_at"]

    def get_queryset(self):
        """
        Фильтровать сделки в зависимости от роли пользователя:
        - Admin: видит все сделки
        - Seller/Executor: видит только свои сделки (где user = seller или executor)
        Сортировка: по дате следующего контакта (ближайшие сверху), затем по дате следующего обзора, затем по дате создания.
        """
        user = self.request.user
        queryset = (
            Deal.objects.select_related("client")
            .prefetch_related("quotes")
            .all()
            .order_by(
                F("next_contact_date").asc(nulls_last=True),
                F("next_review_date").desc(nulls_last=True),
                "-created_at"
            )
        )

        # Если пользователь не аутентифицирован, возвращаем все записи (AllowAny режим)
        if not user.is_authenticated:
            return queryset

        # Администраторы видят все
        is_admin = UserRole.objects.filter(user=user, role__name="Admin").exists()

        if is_admin:
            return queryset

        # Остальные видят только свои сделки (как seller или executor)
        return queryset.filter(Q(seller=user) | Q(executor=user))

    @action(
        detail=True,
        methods=["get", "post"],
        url_path="drive-files",
        parser_classes=[MultiPartParser, FormParser],
    )
    def drive_files(self, request, pk=None):
        deal = self.get_object()
        try:
            folder_id = ensure_deal_folder(deal) or deal.drive_folder_id
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

    @action(detail=True, methods=["get"], url_path="history")
    def history(self, request, pk=None):
        deal = self.get_object()
        audit_logs = self._get_related_audit_logs(deal)
        audit_data = [self._map_audit_log_entry(log, deal.id) for log in audit_logs]
        timeline = sorted(
            audit_data,
            key=lambda entry: entry["created_at"],
            reverse=True,
        )
        return Response(timeline)

    def _collect_related_ids(self, deal: Deal) -> dict:
        def stringify(queryset):
            return [str(pk) for pk in set(queryset)]

        return {
            "task": stringify(
                Task.objects.with_deleted().filter(deal=deal).values_list("id", flat=True)
            ),
            "document": stringify(
                Document.objects.with_deleted()
                .filter(deal=deal)
                .values_list("id", flat=True)
            ),
            "payment": stringify(
                Payment.objects.with_deleted()
                .filter(deal=deal)
                .values_list("id", flat=True)
            ),
            "financial_record": stringify(
                FinancialRecord.objects.with_deleted()
                .filter(payment__deal=deal)
                .values_list("id", flat=True)
            ),
            "note": stringify(
                Note.objects.with_deleted().filter(deal=deal).values_list("id", flat=True)
            ),
            "policy": stringify(
                Policy.objects.with_deleted()
                .filter(deal=deal)
                .values_list("id", flat=True)
            ),
            "quote": stringify(
                Quote.objects.with_deleted()
                .filter(deal=deal)
                .values_list("id", flat=True)
            ),
        }

    @staticmethod
    def _format_value(value):
        if value is None:
            return None
        if isinstance(value, str):
            return value
        return json.dumps(value, ensure_ascii=False)

    def _get_related_audit_logs(self, deal: Deal):
        filters = Q(object_type="deal", object_id=str(deal.id))
        related_ids = self._collect_related_ids(deal)
        for object_type, ids in related_ids.items():
            if ids:
                filters |= Q(object_type=object_type, object_id__in=ids)
        return (
            AuditLog.objects.filter(filters)
            .select_related("actor")
            .order_by("-created_at")
        )

    def _map_audit_log_entry(self, audit_log: AuditLog, deal_id):
        action_display = audit_log.get_action_display()
        description = audit_log.description or audit_log.object_name or action_display
        return {
            "id": f"audit-{audit_log.id}",
            "deal": str(deal_id),
            "object_type": audit_log.object_type,
            "object_id": audit_log.object_id,
            "object_name": audit_log.object_name,
            "action_type": "custom",
            "action_type_display": action_display,
            "description": description,
            "user": audit_log.actor_id,
            "user_username": audit_log.actor.username if audit_log.actor else None,
            "old_value": self._format_value(audit_log.old_value),
            "new_value": self._format_value(audit_log.new_value),
            "created_at": audit_log.created_at.isoformat(),
        }


class QuoteViewSet(viewsets.ModelViewSet):
    serializer_class = QuoteSerializer

    def get_queryset(self):
        user = self.request.user
        queryset = (
            Quote.objects.select_related(
                "deal",
                "deal__client",
                "insurance_company",
                "insurance_type",
            )
            .all()
            .order_by("-created_at")
        )

        # Администраторы видят все котировки
        is_admin = UserRole.objects.filter(user=user, role__name="Admin").exists()

        if not is_admin:
            # Остальные видят только котировки для своих сделок (где user = seller или executor)
            queryset = queryset.filter(Q(deal__seller=user) | Q(deal__executor=user))

        deal_id = self.request.query_params.get("deal")
        if deal_id:
            queryset = queryset.filter(deal_id=deal_id)
        return queryset

    def perform_create(self, serializer):
        defaults: dict[str, object] = {}
        if self.request.user.is_authenticated and 'seller' not in serializer.validated_data:
            defaults['seller'] = self.request.user
        serializer.save(**defaults)


class InsuranceCompanyViewSet(viewsets.ReadOnlyModelViewSet):
    serializer_class = InsuranceCompanySerializer
    queryset = InsuranceCompany.objects.order_by("name")
    pagination_class = None


class InsuranceTypeViewSet(viewsets.ReadOnlyModelViewSet):
    serializer_class = InsuranceTypeSerializer
    queryset = InsuranceType.objects.order_by("name")
    pagination_class = None


class SalesChannelViewSet(viewsets.ReadOnlyModelViewSet):
    serializer_class = SalesChannelSerializer
    queryset = SalesChannel.objects.order_by("name")
    pagination_class = None
