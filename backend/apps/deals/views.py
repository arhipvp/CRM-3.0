from apps.common.permissions import EditProtectedMixin
from apps.common.pagination import DealPageNumberPagination
from apps.users.models import UserRole
from django.db.models import DecimalField, F, Q, Sum, Value
from django.db.models.functions import Coalesce
from rest_framework import viewsets

from .filters import DealFilterSet
from .models import Deal, InsuranceCompany, InsuranceType, Quote, SalesChannel
from .serializers import (
    DealSerializer,
    InsuranceCompanySerializer,
    InsuranceTypeSerializer,
    QuoteSerializer,
    SalesChannelSerializer,
)
from .view_mixins.drive import DealDriveMixin
from .view_mixins.history import DealHistoryMixin
from .view_mixins.merge import DealMergeMixin
from .view_mixins.restore import DealRestoreMixin


def _is_admin_user(user) -> bool:
    if not user or not user.is_authenticated:
        return False
    if user.is_superuser:
        return True
    if not hasattr(user, "_cached_is_admin"):
        user._cached_is_admin = UserRole.objects.filter(
            user=user, role__name="Admin"
        ).exists()
    return user._cached_is_admin


class DealViewSet(
    DealHistoryMixin,
    DealDriveMixin,
    DealMergeMixin,
    DealRestoreMixin,
    EditProtectedMixin,
    viewsets.ModelViewSet,
):
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
    pagination_class = DealPageNumberPagination
    decimal_field = DecimalField(max_digits=12, decimal_places=2)

    def _base_queryset(self, include_deleted=False):
        manager = Deal.objects.with_deleted() if include_deleted else Deal.objects
        queryset = (
            manager.select_related("client", "seller", "executor")
            .prefetch_related("quotes", "documents")
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

        is_admin = _is_admin_user(user)

        if is_admin:
            return queryset

        return queryset.filter(Q(seller=user) | Q(executor=user))

    def _can_modify(self, user, instance):
        if not user or not user.is_authenticated:
            return False
        if _is_admin_user(user):
            return True
        if not instance:
            return False
        owner_id = getattr(instance, "seller_id", None)
        return owner_id == user.id

    def _can_merge(self, user, deal):
        if not user or not user.is_authenticated:
            return False
        return _is_admin_user(user) or deal.seller_id == user.id

    def perform_create(self, serializer):
        if self.request.user and self.request.user.is_authenticated:
            serializer.save(seller=self.request.user)
        else:
            serializer.save()


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

        is_admin = _is_admin_user(user)
        if is_admin:
            return queryset

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
