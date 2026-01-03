from apps.common.drive import (
    DriveError,
    ensure_statement_folder,
    ensure_trash_folder,
    list_drive_folder_contents,
    move_drive_file_to_folder,
)
from apps.common.permissions import EditProtectedMixin
from apps.common.services import manage_drive_files
from apps.users.models import UserRole
from django.db.models import Q, Sum
from rest_framework import serializers, status, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import PermissionDenied, ValidationError
from rest_framework.parsers import FormParser, JSONParser, MultiPartParser
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView

from .filters import PaymentFilterSet
from .models import FinancialRecord, Payment, Statement
from .serializers import (
    FinancialRecordSerializer,
    PaymentSerializer,
    StatementSerializer,
)


def _is_admin_user(user):
    if not user or not user.is_authenticated:
        return False
    return UserRole.objects.filter(user=user, role__name="Admin").exists()


def _get_deal_from_payment(payment):
    if not payment:
        return None
    deal = getattr(payment, "deal", None)
    if deal:
        return deal
    policy = getattr(payment, "policy", None)
    if policy:
        return getattr(policy, "deal", None)
    return None


def _user_has_deal_access(user, deal, *, allow_executor=True):
    if not user or not user.is_authenticated:
        return False
    if _is_admin_user(user):
        return True
    if not deal:
        return False
    if allow_executor:
        return deal.seller_id == user.id or deal.executor_id == user.id
    return deal.seller_id == user.id


def _parse_bool(value):
    if value is None:
        return False
    return str(value).strip().lower() in {"1", "true", "yes", "y", "on"}


class StatementDriveTrashSerializer(serializers.Serializer):
    file_ids = serializers.ListField(
        child=serializers.CharField(),
        min_length=1,
        allow_empty=False,
        required=True,
    )


class FinancialRecordViewSet(EditProtectedMixin, viewsets.ModelViewSet):
    """ViewSet для финансовых записей (доход/расход)"""

    serializer_class = FinancialRecordSerializer
    ordering_fields = ["created_at", "updated_at", "date"]
    ordering = ["-created_at"]

    def get_queryset(self):
        user = self.request.user
        queryset = (
            FinancialRecord.objects.select_related(
                "payment",
                "payment__policy",
                "payment__policy__insurance_type",
                "payment__policy__sales_channel",
                "payment__deal",
                "payment__deal__client",
            )
            .all()
            .order_by("-date", "-created_at")
        )

        # Если пользователь не аутентифицирован, возвращаем все записи (AllowAny режим)
        if not user.is_authenticated:
            return queryset

        # Администраторы видят все финансовые записи
        is_admin = _is_admin_user(user)

        if not is_admin:
            # Остальные видят только записи для своих сделок (где user = seller или executor)
            queryset = queryset.filter(
                Q(payment__deal__seller=user) | Q(payment__deal__executor=user)
            )

        record_type = self.request.query_params.get("record_type")
        if record_type == Statement.TYPE_INCOME:
            queryset = queryset.filter(amount__gt=0)
        elif record_type == Statement.TYPE_EXPENSE:
            queryset = queryset.filter(amount__lt=0)

        if _parse_bool(self.request.query_params.get("unpaid_only")):
            queryset = queryset.filter(date__isnull=True)

        if _parse_bool(self.request.query_params.get("without_statement")):
            queryset = queryset.filter(statement__isnull=True)

        search_term = (self.request.query_params.get("search") or "").strip()
        if len(search_term) >= 5:
            queryset = queryset.filter(
                Q(payment__policy__number__icontains=search_term)
                | Q(payment__policy__insurance_type__name__icontains=search_term)
                | Q(payment__policy__sales_channel__name__icontains=search_term)
                | Q(payment__deal__title__icontains=search_term)
                | Q(payment__deal__client__name__icontains=search_term)
                | Q(payment__description__icontains=search_term)
                | Q(description__icontains=search_term)
                | Q(source__icontains=search_term)
                | Q(note__icontains=search_term)
            )

        return queryset

    def _can_modify(self, user, instance):
        payment = getattr(instance, "payment", None)
        deal = _get_deal_from_payment(payment)
        return _user_has_deal_access(user, deal, allow_executor=False)

    def perform_create(self, serializer):
        payment = serializer.validated_data.get("payment")
        deal = _get_deal_from_payment(payment)
        if not _user_has_deal_access(self.request.user, deal, allow_executor=False):
            raise PermissionDenied("Нет доступа к платежу или сделке.")
        serializer.save()

    def perform_update(self, serializer):
        instance = serializer.instance
        statement = getattr(instance, "statement", None)
        if statement and statement.status == Statement.STATUS_PAID:
            raise ValidationError("Нельзя изменять записи в выплаченной ведомости.")
        super().perform_update(serializer)

    def destroy(self, request, *args, **kwargs):
        instance = self.get_object()
        statement = getattr(instance, "statement", None)
        if statement and statement.status == Statement.STATUS_PAID:
            raise ValidationError("Нельзя удалять записи из выплаченной ведомости.")
        return super().destroy(request, *args, **kwargs)

    def get_object(self):
        from django.shortcuts import get_object_or_404

        kwargs = {self.lookup_field: self.kwargs.get(self.lookup_field)}
        lookup = FinancialRecord.objects.select_related("payment")
        return get_object_or_404(lookup, **kwargs)


class StatementViewSet(EditProtectedMixin, viewsets.ModelViewSet):
    serializer_class = StatementSerializer
    ordering_fields = [
        "created_at",
        "updated_at",
        "paid_at",
        "status",
        "statement_type",
    ]
    ordering = ["-created_at"]
    owner_field = "created_by"

    def get_queryset(self):
        user = self.request.user
        queryset = (
            Statement.objects.prefetch_related(
                "records", "records__payment", "records__payment__deal"
            )
            .all()
            .order_by("-created_at")
        )
        if not user.is_authenticated:
            return queryset.none()
        if _is_admin_user(user):
            return queryset
        return queryset.filter(
            Q(created_by=user)
            | Q(records__payment__deal__seller=user)
            | Q(records__payment__deal__executor=user)
        ).distinct()

    def perform_create(self, serializer):
        record_ids = serializer.validated_data.get("record_ids") or []
        self._validate_record_access(record_ids)
        serializer.save(created_by=self.request.user)

    def _validate_record_access(self, records):
        for record in records:
            deal = _get_deal_from_payment(getattr(record, "payment", None))
            if not _user_has_deal_access(self.request.user, deal, allow_executor=False):
                raise PermissionDenied("Нет доступа к финансовой записи для ведомости.")

    def perform_update(self, serializer):
        record_ids = serializer.validated_data.get("record_ids") or []
        if record_ids:
            self._validate_record_access(record_ids)
        serializer.save()

    def destroy(self, request, *args, **kwargs):
        instance = self.get_object()
        if instance.status == Statement.STATUS_PAID:
            raise ValidationError("Нельзя удалять выплаченную ведомость.")
        return super().destroy(request, *args, **kwargs)

    @action(detail=True, methods=["post"], url_path="remove-records")
    def remove_records(self, request, *args, **kwargs):
        statement = self.get_object()
        if statement.status == Statement.STATUS_PAID:
            raise ValidationError("Нельзя изменять выплаченную ведомость.")

        record_ids = request.data.get("record_ids") or []
        if not isinstance(record_ids, list):
            raise ValidationError({"record_ids": "Ожидается список идентификаторов."})

        records = FinancialRecord.objects.filter(
            id__in=record_ids, statement=statement, deleted_at__isnull=True
        )
        self._validate_record_access(records)
        records.update(statement=None)
        return Response({"removed": records.count()})

    @action(
        detail=True,
        methods=["get", "post", "delete"],
        url_path="drive-files",
        parser_classes=[MultiPartParser, FormParser, JSONParser],
    )
    def drive_files(self, request, *args, **kwargs):
        statement = self.get_object()
        uploaded_file = request.FILES.get("file") if request.method == "POST" else None

        if request.method == "DELETE":
            serializer = StatementDriveTrashSerializer(data=request.data)
            serializer.is_valid(raise_exception=True)
            file_ids = [
                file_id.strip()
                for file_id in serializer.validated_data["file_ids"]
                if isinstance(file_id, str) and file_id.strip()
            ]
            if not file_ids:
                raise ValidationError({"file_ids": "Нужно передать ID файлов."})

            try:
                folder_id = statement.drive_folder_id or ensure_statement_folder(
                    statement
                )
                if not folder_id:
                    return Response(
                        {"detail": "Папка Google Drive для ведомости не найдена."},
                        status=status.HTTP_400_BAD_REQUEST,
                    )

                drive_files = list_drive_folder_contents(folder_id)
                drive_file_map = {item["id"]: item for item in drive_files}
                missing_file_ids = [
                    file_id
                    for file_id in file_ids
                    if file_id not in drive_file_map
                    or drive_file_map[file_id]["is_folder"]
                ]
                if missing_file_ids:
                    return Response(
                        {
                            "detail": "Файлы не найдены или это папки.",
                            "missing_file_ids": missing_file_ids,
                        },
                        status=status.HTTP_400_BAD_REQUEST,
                    )

                trash_folder_id = ensure_trash_folder(folder_id)
                for file_id in file_ids:
                    move_drive_file_to_folder(file_id, trash_folder_id)

                return Response(
                    {
                        "moved_file_ids": file_ids,
                        "trash_folder_id": trash_folder_id,
                    }
                )
            except DriveError as exc:
                return Response(
                    {"detail": str(exc)},
                    status=status.HTTP_503_SERVICE_UNAVAILABLE,
                )

        if request.method == "POST" and not uploaded_file:
            return Response(
                {"detail": "No file provided for upload."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            result = manage_drive_files(
                instance=statement,
                ensure_folder_func=ensure_statement_folder,
                uploaded_file=uploaded_file,
            )
            return Response(result)
        except DriveError as exc:
            return Response(
                {"detail": str(exc)},
                status=status.HTTP_503_SERVICE_UNAVAILABLE,
            )


class PaymentViewSet(EditProtectedMixin, viewsets.ModelViewSet):
    """ViewSet для платежей с поддержкой проверки удаления"""

    serializer_class = PaymentSerializer
    filterset_class = PaymentFilterSet
    search_fields = ["description", "deal__title"]
    ordering_fields = [
        "created_at",
        "updated_at",
        "scheduled_date",
        "actual_date",
        "amount",
    ]
    ordering = ["-created_at"]

    def get_queryset(self):
        user = self.request.user
        queryset = (
            Payment.objects.select_related("policy", "deal")
            .prefetch_related("financial_records")
            .all()
            .order_by("-scheduled_date")
        )

        # Если пользователь не аутентифицирован, возвращаем все записи (AllowAny режим)
        if not user.is_authenticated:
            return queryset

        # Администраторы видят все платежи
        is_admin = _is_admin_user(user)

        if not is_admin:
            # Остальные видят только платежи для своих сделок (где user = seller или executor)
            queryset = queryset.filter(Q(deal__seller=user) | Q(deal__executor=user))

        return queryset

    def perform_create(self, serializer):
        deal = serializer.validated_data.get("deal")
        if not _user_has_deal_access(self.request.user, deal):
            raise PermissionDenied("Нет доступа к сделке.")
        serializer.save()

    def _can_modify(self, user, instance):
        deal = _get_deal_from_payment(instance)
        return _user_has_deal_access(user, deal)

    def destroy(self, request, *args, **kwargs):
        """Удаление платежа запрещено, если он уже оплачен."""
        instance = self.get_object()

        if not instance.can_delete():
            return Response(
                {"detail": "Нельзя удалить платёж, если он уже оплачен."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        return super().destroy(request, *args, **kwargs)


class FinanceSummaryView(APIView):
    """Endpoint для сводки по финансам"""

    permission_classes = [AllowAny]

    def get(self, request):
        user = request.user

        # Если пользователь не аутентифицирован, показываем общую сводку
        is_admin = _is_admin_user(user)

        # Базовый queryset для финансовых записей
        records_queryset = FinancialRecord.objects.filter(deleted_at__isnull=True)
        if not is_admin and user.is_authenticated:
            # Остальные видят только записи для своих сделок (где user = seller или executor)
            records_queryset = records_queryset.filter(
                Q(payment__deal__seller=user) | Q(payment__deal__executor=user)
            )

        # Считаем доходы (положительные суммы) и расходы (отрицательные суммы)
        incomes_total = (
            records_queryset.filter(amount__gt=0).aggregate(total=Sum("amount"))[
                "total"
            ]
            or 0
        )
        expenses_total = abs(
            records_queryset.filter(amount__lt=0).aggregate(total=Sum("amount"))[
                "total"
            ]
            or 0
        )
        net_total = incomes_total - expenses_total

        # Плановые платежи
        payments_queryset = Payment.objects.filter(
            actual_date__isnull=True, deleted_at__isnull=True
        )
        if not is_admin and user.is_authenticated:
            payments_queryset = payments_queryset.filter(
                Q(deal__seller=user) | Q(deal__executor=user)
            )

        planned_payments = payments_queryset.select_related("policy").order_by(
            "scheduled_date"
        )[:5]
        serializer = PaymentSerializer(planned_payments, many=True)

        return Response(
            {
                "incomes_total": float(incomes_total),
                "expenses_total": float(expenses_total),
                "net_total": float(net_total),
                "planned_payments": serializer.data,
            }
        )
