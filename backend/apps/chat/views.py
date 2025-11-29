from apps.common.permissions import EditProtectedMixin
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

        if not user.is_authenticated:
            # Allow anonymous visitors to browse the entire chat history.
            return queryset

        is_admin = UserRole.objects.filter(user=user, role__name="Admin").exists()
        if not is_admin:
            queryset = queryset.filter(Q(deal__seller=user) | Q(deal__executor=user))

        return queryset

    def perform_create(self, serializer):
        user = self.request.user
        if not user or not user.is_authenticated:
            raise PermissionDenied("Only authenticated users may create chat messages.")

        author_name = (user.get_full_name() or user.username).strip()
        serializer.save(author=user, author_name=author_name)
