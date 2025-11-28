import json

from apps.common.drive import (
    DriveError,
    ensure_deal_folder,
)
from apps.common.permissions import EditProtectedMixin
from apps.common.services import manage_drive_files
from apps.documents.models import Document
from apps.finances.models import FinancialRecord, Payment
from apps.notes.models import Note
from apps.policies.models import Policy
from apps.tasks.models import Task
from apps.users.models import AuditLog, UserRole
from django.db.models import DecimalField, F, Prefetch, Q, Sum, Value
from django.db.models.functions import Coalesce
from django.shortcuts import get_object_or_404
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import PermissionDenied, ValidationError
from rest_framework.parsers import FormParser, MultiPartParser
from rest_framework.response import Response

from .filters import DealFilterSet
from .models import Deal, InsuranceCompany, InsuranceType, Quote, SalesChannel
from .serializers import (
    DealMergeSerializer,
    DealSerializer,
    InsuranceCompanySerializer,
    InsuranceTypeSerializer,
    QuoteSerializer,
    SalesChannelSerializer,
)
from .services import DealMergeService


def _is_admin_user(user) -> bool:
    if not user or not user.is_authenticated:
        return False
    if not hasattr(user, "_cached_is_admin"):
        user._cached_is_admin = UserRole.objects.filter(
            user=user, role__name="Admin"
        ).exists()
    return user._cached_is_admin


HISTORY_PREFETCHES = [
    Prefetch(
        "tasks",
        queryset=Task.objects.with_deleted().only("id"),
        to_attr="_history_tasks",
    ),
    Prefetch(
        "documents",
        queryset=Document.objects.with_deleted().only("id"),
        to_attr="_history_documents",
    ),
    Prefetch(
        "notes",
        queryset=Note.objects.with_deleted().only("id"),
        to_attr="_history_notes",
    ),
    Prefetch(
        "policies",
        queryset=Policy.objects.with_deleted().only("id"),
        to_attr="_history_policies",
    ),
    Prefetch(
        "quotes",
        queryset=Quote.objects.with_deleted().only("id"),
        to_attr="_history_quotes",
    ),
    Prefetch(
        "payments",
        queryset=Payment.objects.with_deleted()
        .only("id")
        .prefetch_related(
            Prefetch(
                "financial_records",
                queryset=FinancialRecord.objects.with_deleted().only("id"),
                to_attr="_history_financial_records",
            )
        ),
        to_attr="_history_payments",
    ),
]


class DealViewSet(EditProtectedMixin, viewsets.ModelViewSet):
    serializer_class = DealSerializer
    filterset_class = DealFilterSet
    search_fields = ["title", "description"]
    ordering_fields = [
        "created_at",
        "updated_at",
        "title",
        "expected_close",
        "next_contact_date",
    ]
    ordering = ["next_contact_date", "-created_at"]
    owner_field = "seller"
    decimal_field = DecimalField(max_digits=12, decimal_places=2)

    def _base_queryset(self, include_deleted=False):
        manager = Deal.objects.with_deleted() if include_deleted else Deal.objects
        queryset = (
            manager.select_related("client")
            .prefetch_related("quotes")
            .all()
            .order_by(
                F("next_contact_date").asc(nulls_last=True),
                F("next_review_date").desc(nulls_last=True),
                "-created_at",
            )
        )
        return queryset.annotate(
            payments_total=Coalesce(
                Sum("payments__amount"),
                Value(0),
                output_field=self.decimal_field,
            ),
            payments_paid=Coalesce(
                Sum("payments__amount", filter=Q(payments__actual_date__isnull=False)),
                Value(0),
                output_field=self.decimal_field,
            ),
        )

    def _include_deleted_flag(self):
        raw_value = self.request.query_params.get("show_deleted")
        if raw_value is None:
            return False
        return str(raw_value).lower() in ("1", "true", "yes", "on")

    def get_queryset(self):
        """
        Фильтровать сделки в зависимости от роли пользователя:
        - Admin: видит все сделки
        - Seller/Executor: видит только свои сделки (где user = seller или executor)
        Сортировка: по дате следующего контакта (ближайшие сверху), затем по дате следующего обзора, затем по дате создания.
        """
        user = self.request.user
        queryset = self._base_queryset(include_deleted=self._include_deleted_flag())

        # Если пользователь не аутентифицирован, возвращаем все записи (AllowAny режим)
        if not user.is_authenticated:
            return queryset

        # Администраторы видят все
        is_admin = _is_admin_user(user)

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
        queryset = self.filter_queryset(self.get_queryset())
        deal = get_object_or_404(queryset, pk=pk)
        uploaded_file = request.FILES.get("file") if request.method == "POST" else None

        if request.method == "POST" and not uploaded_file:
            return Response(
                {"detail": "Файл не передан"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            result = manage_drive_files(
                instance=deal,
                ensure_folder_func=ensure_deal_folder,
                uploaded_file=uploaded_file,
            )
            return Response(result)
        except DriveError as exc:
            return Response(
                {"detail": str(exc)},
                status=status.HTTP_503_SERVICE_UNAVAILABLE,
            )

    @action(detail=True, methods=["get"], url_path="history")
    def history(self, request, pk=None):
        queryset = self.get_queryset().prefetch_related(*HISTORY_PREFETCHES)
        deal = get_object_or_404(queryset, pk=pk)
        audit_logs = self._get_related_audit_logs(deal)
        audit_data = [self._map_audit_log_entry(log, deal.id) for log in audit_logs]
        timeline = sorted(
            audit_data,
            key=lambda entry: entry["created_at"],
            reverse=True,
        )
        return Response(timeline)

    @action(detail=True, methods=["post"], url_path="restore")
    def restore(self, request, pk=None):
        queryset = self._base_queryset(include_deleted=True)
        deal = get_object_or_404(queryset, pk=pk)
        if not self._can_modify(request.user, deal):
            return Response(
                {"detail": "Недостаточно прав для восстановления сделки."},
                status=status.HTTP_403_FORBIDDEN,
            )
        deal.restore()
        serializer = self.get_serializer(deal)
        return Response(serializer.data)

    def _collect_related_ids(self, deal: Deal) -> dict:
        def _prefetched_ids(attr: str, fallback):
            items = getattr(deal, attr, None)
            if items is None:
                return [str(pk) for pk in fallback]
            return [str(obj.id) for obj in items]

        def _financial_record_ids():
            payments = getattr(deal, "_history_payments", None)
            if payments is not None:
                ids = []
                for payment in payments:
                    records = getattr(payment, "_history_financial_records", None)
                    if records is None:
                        records = (
                            FinancialRecord.objects.with_deleted()
                            .filter(payment=payment)
                            .values_list("id", flat=True)
                        )
                    ids.extend(str(pk) for pk in records)
                return list(set(ids))
            return [
                str(pk)
                for pk in FinancialRecord.objects.with_deleted()
                .filter(payment__deal=deal)
                .values_list("id", flat=True)
            ]

        return {
            "task": _prefetched_ids(
                "_history_tasks",
                Task.objects.with_deleted()
                .filter(deal=deal)
                .values_list("id", flat=True),
            ),
            "document": _prefetched_ids(
                "_history_documents",
                Document.objects.with_deleted()
                .filter(deal=deal)
                .values_list("id", flat=True),
            ),
            "payment": _prefetched_ids(
                "_history_payments",
                Payment.objects.with_deleted()
                .filter(deal=deal)
                .values_list("id", flat=True),
            ),
            "financial_record": _financial_record_ids(),
            "note": _prefetched_ids(
                "_history_notes",
                Note.objects.with_deleted()
                .filter(deal=deal)
                .values_list("id", flat=True),
            ),
            "policy": _prefetched_ids(
                "_history_policies",
                Policy.objects.with_deleted()
                .filter(deal=deal)
                .values_list("id", flat=True),
            ),
            "quote": _prefetched_ids(
                "_history_quotes",
                Quote.objects.with_deleted()
                .filter(deal=deal)
                .values_list("id", flat=True),
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

    def perform_create(self, serializer):
        if self.request.user and self.request.user.is_authenticated:
            serializer.save(seller=self.request.user)
        else:
            serializer.save()

    @action(detail=False, methods=["post"], url_path="merge")
    def merge(self, request):
        serializer = DealMergeSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        target_id = str(serializer.validated_data["target_deal_id"])
        source_ids = [
            str(value) for value in serializer.validated_data["source_deal_ids"]
        ]
        combined_ids = {target_id, *source_ids}

        deals = (
            Deal.objects.with_deleted()
            .select_related("client")
            .filter(id__in=combined_ids)
        )
        if deals.count() != len(combined_ids):
            found_ids = {str(deal.id) for deal in deals}
            missing = sorted(combined_ids - found_ids)
            raise ValidationError(
                {"detail": f"Сделки не найдены: {', '.join(missing)}"}
            )

        deals_by_id = {str(deal.id): deal for deal in deals}
        target_deal = deals_by_id.get(target_id)
        if not target_deal:
            raise ValidationError({"target_deal_id": "Целевая сделка не найдена."})
        if target_deal.deleted_at is not None:
            raise ValidationError({"target_deal_id": "Целевая сделка удалена."})

        source_deals = [deals_by_id[source_id] for source_id in source_ids]
        client_id = target_deal.client_id
        for deal in source_deals:
            if deal.client_id != client_id:
                raise ValidationError("Все сделки должны принадлежать одному клиенту.")
            if deal.deleted_at is not None:
                raise ValidationError(
                    {"source_deal_ids": "Исходная сделка уже удалена."}
                )

        for deal in (target_deal, *source_deals):
            if not self._can_modify(request.user, deal):
                raise PermissionDenied("Недостаточно прав для объединения сделки.")

        actor = request.user if request.user and request.user.is_authenticated else None
        merge_result = DealMergeService(
            target_deal=target_deal,
            source_deals=source_deals,
            actor=actor,
        ).merge()

        source_titles = sorted({deal.title for deal in source_deals})
        AuditLog.objects.create(
            actor=actor,
            object_type="deal",
            object_id=str(target_deal.id),
            object_name=target_deal.title,
            action="merge",
            description=(
                f"Слияние сделок ({', '.join(source_titles)}) в '{target_deal.title}'"
            ),
            new_value={
                "merged_deals": merge_result["merged_deal_ids"],
                "moved_counts": merge_result["moved_counts"],
            },
        )

        refreshed_target = self._base_queryset().filter(pk=target_deal.pk).first()
        target_instance = refreshed_target or target_deal
        return Response(
            {
                "target_deal": self.get_serializer(target_instance).data,
                "merged_deal_ids": merge_result["merged_deal_ids"],
                "moved_counts": merge_result["moved_counts"],
            }
        )


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
        is_admin = _is_admin_user(user)

        if not is_admin:
            # Остальные видят только котировки для своих сделок (где user = seller или executor)
            queryset = queryset.filter(Q(deal__seller=user) | Q(deal__executor=user))

        deal_id = self.request.query_params.get("deal")
        if deal_id:
            queryset = queryset.filter(deal_id=deal_id)
        return queryset

    def perform_create(self, serializer):
        defaults: dict[str, object] = {}
        if (
            self.request.user.is_authenticated
            and "seller" not in serializer.validated_data
        ):
            defaults["seller"] = self.request.user
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
