from rest_framework import permissions, viewsets
from django.db.models import Q

from .models import ActivityLog, Deal, Quote
from .serializers import ActivityLogSerializer, DealSerializer, QuoteSerializer
from apps.users.models import UserRole


class DealViewSet(viewsets.ModelViewSet):
    serializer_class = DealSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        """
        Фильтровать сделки в зависимости от роли пользователя:
        - Администратор: видит все сделки
        - Менеджер/Наблюдатель: видит только свои сделки (где user = seller или executor)
        """
        user = self.request.user

        # Администраторы видят все
        is_admin = UserRole.objects.filter(
            user=user,
            role__name='Администратор'
        ).exists()

        if is_admin:
            return Deal.objects.select_related("client").prefetch_related("quotes").all().order_by("next_review_date", "-created_at")

        # Остальные видят только свои сделки (как seller или executor)
        return Deal.objects.filter(
            Q(seller=user) | Q(executor=user)
        ).select_related("client").prefetch_related("quotes").all().order_by("next_review_date", "-created_at")


class QuoteViewSet(viewsets.ModelViewSet):
    serializer_class = QuoteSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        queryset = Quote.objects.select_related("deal", "deal__client").all().order_by("-created_at")
        deal_id = self.request.query_params.get("deal")
        if deal_id:
            queryset = queryset.filter(deal_id=deal_id)
        return queryset

    def perform_create(self, serializer):
        serializer.save()


class ActivityLogViewSet(viewsets.ReadOnlyModelViewSet):
    serializer_class = ActivityLogSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        queryset = ActivityLog.objects.select_related("deal", "user").all().order_by("-created_at")
        deal_id = self.request.query_params.get("deal")
        if deal_id:
            queryset = queryset.filter(deal_id=deal_id)
        return queryset
