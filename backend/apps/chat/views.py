from apps.common.permissions import EditProtectedMixin
from apps.deals.models import Deal
from apps.users.models import UserRole
from apps.users.services import user_has_permission
from django.db.models import Q
from rest_framework import viewsets
from rest_framework.exceptions import PermissionDenied
from rest_framework.pagination import PageNumberPagination

from .models import ChatMessage
from .serializers import ChatMessageSerializer


class ChatMessagePagination(PageNumberPagination):
    page_size = 20
    page_size_query_param = "limit"
    max_page_size = 100


class ChatMessageViewSet(EditProtectedMixin, viewsets.ModelViewSet):
    """
    Сообщения могут менять только админы, авторы и участники сделки (seller/executor).
    EditProtectedMixin проверяет автора, а дополнительная проверка дает доступ участникам сделки.
    """

    owner_field = "author"
    serializer_class = ChatMessageSerializer
    pagination_class = ChatMessagePagination

    def get_queryset(self):
        user = self.request.user
        if not user or not user.is_authenticated:
            raise PermissionDenied(
                "Требуется авторизация для доступа к сообщениям чата."
            )

        queryset = (
            ChatMessage.objects.alive()
            .select_related("author", "deal")
            .order_by("created_at")
        )

        deal_id = self.request.query_params.get("deal")
        if deal_id:
            if not self._user_has_deal_access_by_id(user, deal_id):
                raise PermissionDenied("Нет доступа к выбранной сделке.")
            return queryset.filter(deal_id=deal_id)

        if self._is_admin(user) or user_has_permission(user, "deal", "view"):
            return queryset

        allowed_deal_ids = (
            Deal.objects.with_deleted()
            .filter(Q(seller=user) | Q(executor=user) | Q(visible_users=user))
            .values_list("id", flat=True)
        )
        return queryset.filter(deal_id__in=allowed_deal_ids)

    def perform_create(self, serializer):
        user = self.request.user
        if not user or not user.is_authenticated:
            raise PermissionDenied(
                "Только авторизованные пользователи могут создавать сообщения."
            )

        deal = serializer.validated_data.get("deal")
        if not deal:
            raise PermissionDenied("Сделка не указана.")
        if deal.is_deleted():
            raise PermissionDenied("Сделка удалена, чат недоступен")
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
        if user_has_permission(user, "deal", "view"):
            return True
        return (
            deal.seller_id == user.id
            or deal.executor_id == user.id
            or deal.visible_users.filter(id=user.id).exists()
        )

    def _user_has_deal_access_by_id(self, user, deal_id: str | int) -> bool:
        if self._is_admin(user):
            return True
        if user_has_permission(user, "deal", "view"):
            return True
        return (
            Deal.objects.with_deleted()
            .filter(id=deal_id)
            .filter(Q(seller=user) | Q(executor=user) | Q(visible_users=user))
            .exists()
        )

    def _can_modify(self, user, instance):
        if super()._can_modify(user, instance):
            return True

        deal = getattr(instance, "deal", None)
        return self._user_has_deal_access(user, deal)
