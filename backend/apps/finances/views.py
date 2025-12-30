from apps.common.permissions import EditProtectedMixin
from apps.users.models import UserRole
from django.db.models import Q, Sum
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import PermissionDenied, ValidationError
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


class FinancialRecordViewSet(EditProtectedMixin, viewsets.ModelViewSet):
    """ViewSet для финансовых записей (доход/расход)"""

    serializer_class = FinancialRecordSerializer
    ordering_fields = ["created_at", "updated_at", "date"]
    ordering = ["-created_at"]

    def get_queryset(self):
        user = self.request.user
        queryset = (
            FinancialRecord.objects.select_related("payment")
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
