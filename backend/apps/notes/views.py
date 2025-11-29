from apps.common.permissions import EditProtectedMixin
from apps.users.models import UserRole
from django.db.models import Q
from django.shortcuts import get_object_or_404
from rest_framework import viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import PermissionDenied
from rest_framework.response import Response

from .models import Note
from .serializers import NoteSerializer


class NoteViewSet(EditProtectedMixin, viewsets.ModelViewSet):
    serializer_class = NoteSerializer

    def get_base_queryset(self):
        return Note.objects.with_deleted().select_related("deal")

    def _apply_deal_filter(self, queryset):
        deal_id = self.request.query_params.get("deal")
        if deal_id:
            return queryset.filter(deal_id=deal_id)
        return queryset

    def _apply_access_control(self, queryset):
        user = self.request.user
        if not user or not user.is_authenticated:
            return queryset

        is_admin = UserRole.objects.filter(user=user, role__name="Admin").exists()
        if is_admin:
            return queryset

        return queryset.filter(Q(deal__seller=user) | Q(deal__executor=user))

    def get_queryset(self):
        queryset = self.get_base_queryset()
        archived_flag = self.request.query_params.get("archived")
        if archived_flag == "true":
            queryset = queryset.dead()
        else:
            queryset = queryset.alive()

        queryset = self._apply_access_control(queryset)
        return self._apply_deal_filter(queryset)

    def perform_create(self, serializer):
        user = self.request.user
        author_name = serializer.validated_data.get("author_name")
        deal = serializer.validated_data.get("deal")
        self._ensure_user_is_deal_seller(deal)
        if not author_name and user and user.is_authenticated:
            full_name = (user.get_full_name() or "").strip()
            author_name = full_name or user.username
        serializer.save(author_name=author_name or "")

    def _is_deal_seller(self, user, instance):
        """Разрешить действия над заметкой только её продавцу."""
        if not user or not user.is_authenticated or not instance:
            return False
        deal = getattr(instance, "deal", None)
        return bool(deal and deal.seller_id == user.id)

    def _ensure_user_is_deal_seller(self, deal):
        user = self.request.user
        if not user or not user.is_authenticated or not deal:
            raise PermissionDenied(
                "Только владелец сделки (продавец) может создавать заметки."
            )

        if deal.seller_id != user.id:
            raise PermissionDenied(
                "Только владелец сделки (продавец) может создавать заметки."
            )

    def _can_modify(self, user, instance):
        if self._is_admin(user):
            return True
        return self._is_deal_seller(user, instance)

    @action(detail=True, methods=["post"])
    def restore(self, request, pk=None):
        queryset = self.get_base_queryset()
        queryset = self._apply_access_control(queryset)
        note = get_object_or_404(queryset, pk=pk)
        note.restore()
        serializer = self.get_serializer(note)
        return Response(serializer.data)
