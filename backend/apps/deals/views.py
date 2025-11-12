from apps.common.permissions import EditProtectedMixin
from apps.users.models import UserRole
from django.db.models import Q
from rest_framework import permissions, viewsets
from rest_framework.permissions import AllowAny

from .filters import DealFilterSet
from .models import ActivityLog, Deal, Quote
from .serializers import ActivityLogSerializer, DealSerializer, QuoteSerializer


class DealViewSet(EditProtectedMixin, viewsets.ModelViewSet):
    serializer_class = DealSerializer
    filterset_class = DealFilterSet
    search_fields = ["title", "description"]
    ordering_fields = ["created_at", "updated_at", "title", "expected_close"]
    ordering = ["-created_at"]

    def get_queryset(self):
        """
        Фильтровать сделки в зависимости от роли пользователя:
        - Admin: видит все сделки
        - Seller/Executor: видит только свои сделки (где user = seller или executor)
        """
        user = self.request.user
        queryset = (
            Deal.objects.select_related("client")
            .prefetch_related("quotes")
            .all()
            .order_by("next_review_date", "-created_at")
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


class QuoteViewSet(viewsets.ModelViewSet):
    serializer_class = QuoteSerializer

    def get_queryset(self):
        user = self.request.user
        queryset = (
            Quote.objects.select_related("deal", "deal__client")
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
        serializer.save()


class ActivityLogViewSet(viewsets.ReadOnlyModelViewSet):
    serializer_class = ActivityLogSerializer

    def get_queryset(self):
        user = self.request.user
        queryset = (
            ActivityLog.objects.select_related("deal", "user")
            .all()
            .order_by("-created_at")
        )

        # Администраторы видят все логи активности
        is_admin = UserRole.objects.filter(user=user, role__name="Admin").exists()

        if not is_admin:
            # Остальные видят только логи для своих сделок (где user = seller или executor)
            queryset = queryset.filter(Q(deal__seller=user) | Q(deal__executor=user))

        deal_id = self.request.query_params.get("deal")
        if deal_id:
            queryset = queryset.filter(deal_id=deal_id)
        return queryset
