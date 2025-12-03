from apps.common.permissions import EditProtectedMixin
from apps.deals.models import Deal
from apps.users.models import UserRole
from django.db.models import Q
from rest_framework import viewsets
from rest_framework.exceptions import PermissionDenied

from .models import ChatMessage
from .serializers import ChatMessageSerializer


class ChatMessageViewSet(EditProtectedMixin, viewsets.ModelViewSet):
    serializer_class = ChatMessageSerializer

    def get_queryset(self):
        user = self.request.user
        queryset = ChatMessage.objects.alive().order_by("created_at")

        deal_id = self.request.query_params.get("deal")
        if deal_id:
            queryset = queryset.filter(deal_id=deal_id)

        if not user.is_authenticated:
            return queryset

        if self._is_admin(user):
            return queryset

        return queryset.filter(Q(deal__seller=user) | Q(deal__executor=user))

    def perform_create(self, serializer):
        user = self.request.user
        if not user or not user.is_authenticated:
            raise PermissionDenied(
                "Только авторизованные пользователи могут создавать сообщения."
            )

        deal = serializer.validated_data.get("deal")
        if not self._user_has_deal_access(user, deal):
            raise PermissionDenied("Нет доступа к выбранной сделке.")

        author_name = (user.get_full_name() or user.username).strip()
        serializer.save(author=user, author_name=author_name)

    def _is_admin(self, user):
        return UserRole.objects.filter(user=user, role__name="Admin").exists()

    def _user_has_deal_access(self, user, deal: Deal | None) -> bool:
        if not user or not user.is_authenticated or not deal:
            return False
        if self._is_admin(user):
            return True
        return deal.seller_id == user.id or deal.executor_id == user.id
