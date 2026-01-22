from apps.common.pagination import DealPageNumberPagination
from apps.common.permissions import EditProtectedMixin
from django.conf import settings
from django.db.models import (
    BooleanField,
    DecimalField,
    Exists,
    F,
    OuterRef,
    Q,
    Sum,
    Value,
)
from django.db.models.functions import Coalesce
from django.shortcuts import get_object_or_404
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response

from .filters import DealFilterSet
from .models import Deal, DealPin, InsuranceCompany, InsuranceType, Quote, SalesChannel
from .permissions import can_merge_deals, can_modify_deal, is_admin_user, is_deal_seller
from .query_flags import parse_bool_flag
from .search import build_search_query
from .serializers import (
    DealSerializer,
    InsuranceCompanySerializer,
    InsuranceTypeSerializer,
    QuoteSerializer,
    SalesChannelSerializer,
)
from .view_mixins import (
    DealDriveMixin,
    DealHistoryMixin,
    DealMergeMixin,
    DealRestoreMixin,
)

CLOSED_STATUSES = {Deal.DealStatus.WON, Deal.DealStatus.LOST}


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
    search_fields = [
        "title",
        "description",
        "client__name",
        "client__phone",
        "client__email",
        "client__notes",
        "notes__body",
        "policies__number",
        "policies__vin",
        "policies__brand",
        "policies__model",
        "policies__counterparty",
        "policies__client__name",
        "policies__insured_client__name",
        "policies__insurance_company__name",
        "policies__insurance_type__name",
    ]
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

    def _annotate_queryset(self, queryset, user=None):
        queryset = queryset.annotate(
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
        if user and user.is_authenticated:
            pin_exists = DealPin.objects.filter(user=user, deal=OuterRef("pk"))
            return queryset.annotate(is_pinned=Exists(pin_exists))
        return queryset.annotate(is_pinned=Value(False, output_field=BooleanField()))

    def _can_merge(self, user, deal) -> bool:
        return can_merge_deals(user, deal)

    def _base_queryset(self, include_deleted=False, user=None):
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
        return self._annotate_queryset(queryset, user=user)

    def _include_deleted_flag(self):
        raw_value = self.request.query_params.get("show_deleted")
        return parse_bool_flag(raw_value)

    def _include_closed_flag(self):
        raw_value = self.request.query_params.get("show_closed")
        return parse_bool_flag(raw_value)

    def get_queryset(self):
        """
        Фильтровать сделки в зависимости от роли пользователя:
        - Admin: видит все сделки
        - Seller/Executor: видит только свои сделки (где user = seller или executor)
        Сортировка: по дате следующего контакта (ближайшие сверху), затем по дате следующего обзора, затем по дате создания.
        """
        user = self.request.user
        queryset = self._base_queryset(
            include_deleted=self._include_deleted_flag(),
            user=user,
        )

        if self.action in {"close", "reopen"}:
            return queryset

        include_closed = self._include_closed_flag()
        if not include_closed:
            queryset = queryset.exclude(status__in=CLOSED_STATUSES)

        search_term = self.request.query_params.get("search")
        if search_term and search_term.strip():
            search_q = build_search_query(search_term, self.search_fields)
            if search_q is not None:
                queryset = queryset.filter(search_q)
            queryset = queryset.distinct()

        # Если пользователь не аутентифицирован, возвращаем все записи (AllowAny режим)
        if not user.is_authenticated:
            return queryset

        is_admin = is_admin_user(user)

        if is_admin:
            return queryset

        access_filter = Q(seller=user) | Q(executor=user) | Q(tasks__assignee=user)
        return queryset.filter(access_filter).distinct()

    def _pinned_ids(self, user):
        if not user or not user.is_authenticated:
            return []
        return list(DealPin.objects.filter(user=user).values_list("deal_id", flat=True))

    def _pinned_queryset(self, user, pinned_ids):
        if not pinned_ids:
            return Deal.objects.none()
        queryset = self._base_queryset(
            include_deleted=True,
            user=user,
        ).filter(id__in=pinned_ids)
        ordering_param = self.request.query_params.get("ordering")
        if ordering_param:
            ordering = [
                item.strip() for item in ordering_param.split(",") if item.strip()
            ]
            if ordering:
                queryset = queryset.order_by(*ordering)
        return queryset

    def list(self, request, *args, **kwargs):
        queryset = self.filter_queryset(self.get_queryset())
        pinned_ids = self._pinned_ids(request.user)
        if pinned_ids:
            queryset = queryset.exclude(id__in=pinned_ids)

        page = self.paginate_queryset(queryset)
        if page is not None:
            pinned_queryset = (
                self._pinned_queryset(request.user, pinned_ids)
                if str(request.query_params.get("page") or "1") in {"1", ""}
                else Deal.objects.none()
            )
            pinned_data = self.get_serializer(pinned_queryset, many=True).data
            page_data = self.get_serializer(page, many=True).data
            paginator = self.paginator
            page_obj = getattr(paginator, "page", None)
            base_count = (
                page_obj.paginator.count if page_obj is not None else len(page_data)
            )
            return Response(
                {
                    "count": base_count + len(pinned_ids),
                    "next": paginator.get_next_link(),
                    "previous": paginator.get_previous_link(),
                    "results": pinned_data + page_data,
                }
            )

        serializer = self.get_serializer(queryset, many=True)
        return Response(serializer.data)

    @action(detail=True, methods=["post"], url_path="pin")
    def pin(self, request, pk=None):
        deal = get_object_or_404(Deal.objects.with_deleted(), pk=pk)
        if not can_modify_deal(request.user, deal):
            return Response(
                {
                    "detail": "Закреплять сделку может только продавец или администратор."
                },
                status=status.HTTP_403_FORBIDDEN,
            )
        pin, created = DealPin.objects.get_or_create(user=request.user, deal=deal)
        if created:
            pins_count = DealPin.objects.filter(user=request.user).count()
            if pins_count > settings.DEAL_PIN_LIMIT:
                pin.delete()
                return Response(
                    {
                        "detail": (
                            "Нельзя закрепить "
                            f"больше {settings.DEAL_PIN_LIMIT} "
                            "сделок."
                        )
                    },
                    status=status.HTTP_400_BAD_REQUEST,
                )
        serializer = self.get_serializer(deal)
        return Response(serializer.data)

    @action(detail=True, methods=["post"], url_path="unpin")
    def unpin(self, request, pk=None):
        deal = get_object_or_404(Deal.objects.with_deleted(), pk=pk)
        if not can_modify_deal(request.user, deal):
            return Response(
                {
                    "detail": "Откреплять сделку может только продавец или администратор."
                },
                status=status.HTTP_403_FORBIDDEN,
            )
        DealPin.objects.filter(user=request.user, deal=deal).delete()
        serializer = self.get_serializer(deal)
        return Response(serializer.data)

    def _reject_when_no_seller(self, user, deal):
        if not deal:
            return None
        if deal.seller_id is None and not is_admin_user(user):
            return Response(
                {"detail": "У сделки нет продавца! Обратитесь к администратору."},
                status=status.HTTP_403_FORBIDDEN,
            )
        return None

    def perform_create(self, serializer):
        if self.request.user and self.request.user.is_authenticated:
            serializer.save(seller=self.request.user)
        else:
            serializer.save()

    def update(self, request, *args, **kwargs):
        instance = self.get_object()
        response = self._reject_when_no_seller(request.user, instance)
        if response:
            return response
        return super().update(request, *args, **kwargs)

    def partial_update(self, request, *args, **kwargs):
        instance = self.get_object()
        response = self._reject_when_no_seller(request.user, instance)
        if response:
            return response
        return super().partial_update(request, *args, **kwargs)

    def destroy(self, request, *args, **kwargs):
        instance = self.get_object()
        response = self._reject_when_no_seller(request.user, instance)
        if response:
            return response
        return super().destroy(request, *args, **kwargs)

    @action(detail=True, methods=["post"], url_path="close")
    def close(self, request, pk=None):
        queryset = self.get_queryset()
        deal = get_object_or_404(queryset, pk=pk)
        response = self._reject_when_no_seller(request.user, deal)
        if response:
            return response
        if not is_deal_seller(request.user, deal):
            return Response(
                {"detail": "Only the assigned seller can close this deal."},
                status=status.HTTP_403_FORBIDDEN,
            )
        if deal.status in CLOSED_STATUSES:
            return Response(
                {"detail": "Deal is already closed."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        status_value = str(request.data.get("status") or Deal.DealStatus.WON).lower()
        if status_value not in CLOSED_STATUSES:
            return Response(
                {"status": "Status must be either 'won' or 'lost'."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        reason = request.data.get("reason")
        if reason is None:
            reason = ""
        if not isinstance(reason, str):
            reason = str(reason)
        closing_reason = reason.strip()
        if not closing_reason:
            return Response(
                {"reason": "Reason is required when closing a deal."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        deal.status = status_value
        deal.closing_reason = closing_reason
        deal.save(update_fields=["status", "closing_reason"])
        serializer = self.get_serializer(deal)
        return Response(serializer.data)

    @action(detail=True, methods=["post"], url_path="reopen")
    def reopen(self, request, pk=None):
        queryset = self.get_queryset()
        deal = get_object_or_404(queryset, pk=pk)
        response = self._reject_when_no_seller(request.user, deal)
        if response:
            return response
        if deal.status not in CLOSED_STATUSES:
            return Response(
                {"detail": "Only closed deals can be reopened."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        if not can_modify_deal(request.user, deal):
            return Response(
                {"detail": "Only administrators or the deal owner can reopen a deal."},
                status=status.HTTP_403_FORBIDDEN,
            )
        deal.status = Deal.DealStatus.OPEN
        deal.closing_reason = ""
        deal.save(update_fields=["status", "closing_reason"])
        serializer = self.get_serializer(deal)
        return Response(serializer.data)


class QuoteViewSet(viewsets.ModelViewSet):
    serializer_class = QuoteSerializer

    def _include_deleted_flag(self) -> bool:
        raw_value = self.request.query_params.get("show_deleted")
        if raw_value is None:
            return False
        return str(raw_value).lower() in ("1", "true", "yes", "on")

    def get_queryset(self):
        user = self.request.user
        manager = (
            Quote.objects.with_deleted()
            if self._include_deleted_flag()
            else Quote.objects
        )
        queryset = (
            manager.select_related(
                "deal",
                "deal__client",
                "insurance_company",
                "insurance_type",
            )
            .all()
            .order_by("-created_at")
        )

        if self.action == "destroy":
            return queryset

        is_admin = is_admin_user(user)
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

    def _can_delete(self, user, quote: Quote) -> bool:
        if is_admin_user(user):
            return True
        if not user or not user.is_authenticated:
            return False
        if quote.seller_id == getattr(user, "id", None):
            return True
        deal = getattr(quote, "deal", None)
        return bool(deal and deal.seller_id == getattr(user, "id", None))

    def destroy(self, request, *args, **kwargs):
        quote = self.get_object()
        if not self._can_delete(request.user, quote):
            return Response(
                {
                    "detail": "Удалять расчет может только его автор, продавец сделки или администратор."
                },
                status=status.HTTP_403_FORBIDDEN,
            )
        return super().destroy(request, *args, **kwargs)


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
