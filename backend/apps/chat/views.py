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

        # Если пользователь не аутентифицирован, возвращаем все сообщения (AllowAny режим)
        if not user.is_authenticated:
            return queryset

        # Администраторы видят все сообщения чата
        is_admin = UserRole.objects.filter(user=user, role__name="Admin").exists()

        if not is_admin:
            # Остальные видят только сообщения для своих сделок (где user = seller или executor)
            queryset = queryset.filter(Q(deal__seller=user) | Q(deal__executor=user))

        return queryset

    def perform_create(self, serializer):
        # Если пользователь авторизован, сохранить его как author
        user = self.request.user
        if not user or not user.is_authenticated:
            raise PermissionDenied("Только авторизованные пользователи могут отправлять сообщения.")

        full_name = (user.get_full_name() or "").strip()
        author_name = full_name or user.username
        serializer.save(author=user, author_name=author_name)
