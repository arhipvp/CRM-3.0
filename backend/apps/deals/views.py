from datetime import datetime
from datetime import timezone as dt_timezone

from apps.common.pagination import DealPageNumberPagination
from apps.common.permissions import EditProtectedMixin
from apps.mailboxes.mailcow_client import MailcowClient, MailcowError
from apps.mailboxes.models import Mailbox
from apps.mailboxes.services import (
    build_mailbox_local_part,
    ensure_mailcow_domain,
    extract_quota_left,
    generate_mailbox_password,
    process_mailbox_messages,
)
from apps.users.models import AuditLog
from django.conf import settings
from django.db import IntegrityError
from django.db.models import (
    BooleanField,
    Count,
    DecimalField,
    Exists,
    F,
    IntegerField,
    OuterRef,
    Q,
    Subquery,
    Sum,
    Value,
)
from django.db.models.functions import Coalesce
from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import PermissionDenied
from rest_framework.response import Response

from .filters import DealFilterSet
from .lifecycle_service import close_deal, reopen_deal
from .models import (
    Deal,
    DealPin,
    DealTimeTick,
    InsuranceCompany,
    InsuranceType,
    Quote,
    SalesChannel,
)
from .permissions import (
    can_manage_deal_mailbox,
    can_merge_deals,
    can_modify_deal,
    is_admin_user,
    is_deal_seller,
)
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
    DealDocumentRecognitionMixin,
    DealDriveMixin,
    DealHistoryMixin,
    DealMergeMixin,
    DealRestoreMixin,
    DealSimilarityMixin,
)

CLOSED_STATUSES = {Deal.DealStatus.WON, Deal.DealStatus.LOST}


class DealViewSet(
    DealDocumentRecognitionMixin,
    DealHistoryMixin,
    DealDriveMixin,
    DealSimilarityMixin,
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

    @staticmethod
    def _time_tracking_tick_seconds() -> int:
        return max(5, int(getattr(settings, "DEAL_TIME_TRACKING_TICK_SECONDS", 10)))

    @classmethod
    def _time_tracking_confirm_interval_seconds(cls) -> int:
        return max(
            cls._time_tracking_tick_seconds(),
            int(
                getattr(
                    settings,
                    "DEAL_TIME_TRACKING_CONFIRM_INTERVAL_SECONDS",
                    600,
                )
            ),
        )

    @staticmethod
    def _time_tracking_enabled() -> bool:
        return bool(getattr(settings, "DEAL_TIME_TRACKING_ENABLED", True))

    @classmethod
    def _bucket_start(cls, now):
        tick_seconds = cls._time_tracking_tick_seconds()
        current = int(now.timestamp())
        floored = current - (current % tick_seconds)
        return datetime.fromtimestamp(floored, tz=dt_timezone.utc)

    @staticmethod
    def _format_hms(total_seconds: int) -> str:
        total = max(int(total_seconds), 0)
        hours, remainder = divmod(total, 3600)
        minutes, seconds = divmod(remainder, 60)
        return f"{hours:02d}:{minutes:02d}:{seconds:02d}"

    @staticmethod
    def _my_total_seconds(user, deal) -> int:
        total = (
            DealTimeTick.objects.filter(user=user, deal=deal).aggregate(
                total=Coalesce(Sum("seconds"), Value(0), output_field=IntegerField())
            )["total"]
            or 0
        )
        return int(total)

    def _annotate_queryset(self, queryset, user=None):
        queryset = queryset.annotate(
            client_active_deals_count=Coalesce(
                Subquery(self._active_deals_count_subquery(user)),
                Value(0),
                output_field=IntegerField(),
            )
        )
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

    def _active_deals_count_subquery(self, user):
        queryset = Deal.objects.filter(
            client_id=OuterRef("client_id"),
            deleted_at__isnull=True,
        ).exclude(status__in=CLOSED_STATUSES)

        if user and user.is_authenticated and not is_admin_user(user):
            access_filter = (
                Q(seller=user)
                | Q(executor=user)
                | Q(tasks__assignee=user)
                | Q(visible_users=user)
            )
            queryset = queryset.filter(access_filter)

        return (
            queryset.values("client_id")
            .annotate(active_count=Count("id", distinct=True))
            .values("active_count")
        )

    def _can_merge(self, user, deal) -> bool:
        return can_merge_deals(user, deal)

    def _base_queryset(self, include_deleted=False, user=None):
        manager = Deal.objects.with_deleted() if include_deleted else Deal.objects
        queryset = (
            manager.select_related("client", "seller", "executor", "mailbox")
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

        access_filter = (
            Q(seller=user)
            | Q(executor=user)
            | Q(tasks__assignee=user)
            | Q(visible_users=user)
        )
        return queryset.filter(access_filter).distinct()

    @action(detail=True, methods=["get"], url_path="time-track/summary")
    def time_track_summary(self, request, pk=None):
        deal = self.get_object()
        tick_seconds = self._time_tracking_tick_seconds()
        confirm_interval_seconds = self._time_tracking_confirm_interval_seconds()
        enabled = self._time_tracking_enabled()
        my_total_seconds = self._my_total_seconds(request.user, deal)
        return Response(
            {
                "enabled": enabled,
                "tick_seconds": tick_seconds,
                "confirm_interval_seconds": confirm_interval_seconds,
                "my_total_seconds": my_total_seconds,
                "my_total_human": self._format_hms(my_total_seconds),
            }
        )

    @action(detail=True, methods=["post"], url_path="time-track/tick")
    def time_track_tick(self, request, pk=None):
        deal = self.get_object()
        tick_seconds = self._time_tracking_tick_seconds()
        confirm_interval_seconds = self._time_tracking_confirm_interval_seconds()
        enabled = self._time_tracking_enabled()
        if not enabled:
            my_total_seconds = self._my_total_seconds(request.user, deal)
            return Response(
                {
                    "enabled": False,
                    "tick_seconds": tick_seconds,
                    "confirm_interval_seconds": confirm_interval_seconds,
                    "counted": False,
                    "bucket_start": None,
                    "my_total_seconds": my_total_seconds,
                    "reason": "disabled",
                }
            )

        now = timezone.now()
        bucket_start = self._bucket_start(now)

        try:
            tick, created = DealTimeTick.objects.get_or_create(
                user=request.user,
                bucket_start=bucket_start,
                defaults={
                    "deal": deal,
                    "seconds": tick_seconds,
                    "source": "deal_details_panel",
                },
            )
        except IntegrityError:
            tick = DealTimeTick.objects.filter(
                user=request.user,
                bucket_start=bucket_start,
            ).first()
            created = False

        if created:
            counted = True
            reason = None
        elif tick and tick.deal_id == deal.id:
            counted = False
            reason = "duplicate"
        else:
            counted = False
            reason = "bucket_taken_by_other_deal"

        my_total_seconds = self._my_total_seconds(request.user, deal)
        payload = {
            "enabled": True,
            "tick_seconds": tick_seconds,
            "confirm_interval_seconds": confirm_interval_seconds,
            "counted": counted,
            "bucket_start": bucket_start,
            "my_total_seconds": my_total_seconds,
        }
        if reason:
            payload["reason"] = reason
        return Response(payload)

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
        visible_before = set()
        if self.request.user and self.request.user.is_authenticated:
            deal = serializer.save(seller=self.request.user)
        else:
            deal = serializer.save()
        self._log_viewer_changes(deal, visible_before)

    def update(self, request, *args, **kwargs):
        instance = self.get_object()
        previous_ids = set(instance.visible_users.values_list("id", flat=True))
        self._reject_viewer_update(request, instance)
        response = self._reject_when_no_seller(request.user, instance)
        if response:
            return response
        response = super().update(request, *args, **kwargs)
        self._log_viewer_changes(instance, previous_ids)
        return response

    def partial_update(self, request, *args, **kwargs):
        instance = self.get_object()
        previous_ids = set(instance.visible_users.values_list("id", flat=True))
        self._reject_viewer_update(request, instance)
        response = self._reject_when_no_seller(request.user, instance)
        if response:
            return response
        response = super().partial_update(request, *args, **kwargs)
        self._log_viewer_changes(instance, previous_ids)
        return response

    def destroy(self, request, *args, **kwargs):
        instance = self.get_object()
        response = self._reject_when_no_seller(request.user, instance)
        if response:
            return response
        return super().destroy(request, *args, **kwargs)

    def get_serializer_context(self):
        context = super().get_serializer_context()
        context["include_policies"] = self.action == "retrieve"
        return context

    def _reject_viewer_update(self, request, instance):
        if "visible_users" not in request.data:
            return
        if can_modify_deal(request.user, instance):
            return
        raise PermissionDenied(
            "Изменять список наблюдателей может только продавец сделки или администратор."
        )

    def _log_viewer_changes(self, deal: Deal, previous_ids=None):
        if not deal:
            return
        previous_ids = set(previous_ids or [])
        current_ids = set(deal.visible_users.values_list("id", flat=True))
        added_ids = sorted(current_ids - previous_ids)
        removed_ids = sorted(previous_ids - current_ids)
        if not added_ids and not removed_ids:
            return

        actor = self.request.user if self.request else None
        actor = actor if actor and actor.is_authenticated else None
        if added_ids:
            AuditLog.objects.create(
                actor=actor,
                object_type="deal",
                object_id=str(deal.id),
                object_name=deal.title,
                action="assign",
                description="Добавлены наблюдатели сделки.",
                old_value=[],
                new_value=added_ids,
            )
        if removed_ids:
            AuditLog.objects.create(
                actor=actor,
                object_type="deal",
                object_id=str(deal.id),
                object_name=deal.title,
                action="revoke",
                description="Удалены наблюдатели сделки.",
                old_value=removed_ids,
                new_value=[],
            )

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
        close_error = close_deal(
            deal=deal,
            reason=request.data.get("reason"),
            status_value=request.data.get("status"),
        )
        if close_error:
            return close_error
        serializer = self.get_serializer(deal)
        return Response(serializer.data)

    @action(detail=True, methods=["post"], url_path="mailbox/create")
    def create_mailbox(self, request, pk=None):
        queryset = self.get_queryset()
        deal = get_object_or_404(queryset, pk=pk)
        if not can_manage_deal_mailbox(request.user, deal):
            return Response(
                {
                    "detail": "Создавать почтовый ящик могут только продавец или исполнитель сделки."
                },
                status=status.HTTP_403_FORBIDDEN,
            )

        if getattr(deal, "mailbox", None):
            return Response(
                {"detail": "Для этой сделки почтовый ящик уже создан."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        domain = getattr(settings, "MAILCOW_DOMAIN", "").strip()
        if not domain:
            return Response(
                {"detail": "MAILCOW_DOMAIN is not configured."},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )

        local_part = build_mailbox_local_part(getattr(deal.client, "name", ""), domain)
        display_name = deal.title
        email_address = f"{local_part}@{domain}".lower()

        client = MailcowClient()
        try:
            ensure_mailcow_domain(client, domain)
        except MailcowError as exc:
            return Response({"detail": str(exc)}, status=status.HTTP_502_BAD_GATEWAY)

        password = generate_mailbox_password()
        requested_quota = int(getattr(settings, "MAILCOW_MAILBOX_QUOTA_MB", 3072))
        try:
            client.create_mailbox(
                domain,
                local_part,
                display_name,
                password,
                quota_mb=requested_quota,
            )
        except MailcowError as exc:
            exc_text = str(exc)
            quota_left = extract_quota_left(exc_text)
            if quota_left and quota_left < requested_quota:
                try:
                    client.create_mailbox(
                        domain,
                        local_part,
                        display_name,
                        password,
                        quota_mb=quota_left,
                    )
                except MailcowError as retry_exc:
                    return Response(
                        {"detail": str(retry_exc)}, status=status.HTTP_502_BAD_GATEWAY
                    )
            else:
                return Response(
                    {"detail": exc_text},
                    status=status.HTTP_502_BAD_GATEWAY,
                )

        mailbox = Mailbox.objects.create(
            user=request.user,
            deal=deal,
            email=email_address,
            local_part=local_part,
            domain=domain,
            display_name=display_name,
        )

        serializer = self.get_serializer(deal)
        payload = serializer.data
        payload["mailbox_initial_password"] = password
        payload["mailbox_email"] = mailbox.email
        return Response(payload, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=["post"], url_path="mailbox/check")
    def check_mailbox(self, request, pk=None):
        queryset = self.get_queryset()
        deal = get_object_or_404(queryset, pk=pk)
        if not can_manage_deal_mailbox(request.user, deal):
            return Response(
                {
                    "detail": "Проверять почту могут только продавец или исполнитель сделки."
                },
                status=status.HTTP_403_FORBIDDEN,
            )

        mailbox = getattr(deal, "mailbox", None)
        if not mailbox:
            return Response(
                {"detail": "Для этой сделки ещё не создан почтовый ящик."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            stats = process_mailbox_messages(mailbox)
        except MailcowError as exc:
            return Response({"detail": str(exc)}, status=status.HTTP_502_BAD_GATEWAY)

        serializer = self.get_serializer(deal)
        payload = serializer.data
        payload["mailbox_sync"] = stats
        return Response(payload)

    @action(detail=True, methods=["post"], url_path="reopen")
    def reopen(self, request, pk=None):
        queryset = self.get_queryset()
        deal = get_object_or_404(queryset, pk=pk)
        response = self._reject_when_no_seller(request.user, deal)
        if response:
            return response
        if not can_modify_deal(request.user, deal):
            return Response(
                {"detail": "Only administrators or the deal owner can reopen a deal."},
                status=status.HTTP_403_FORBIDDEN,
            )
        reopen_error = reopen_deal(deal=deal)
        if reopen_error:
            return reopen_error
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
