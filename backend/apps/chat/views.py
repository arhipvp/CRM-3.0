from rest_framework import permissions, viewsets
from django.db.models import Q

from .models import ChatMessage
from .serializers import ChatMessageSerializer
from apps.common.permissions import IsAuthenticated as IsAuthenticatedPermission
from apps.users.models import UserRole


class ChatMessageViewSet(viewsets.ModelViewSet):
    serializer_class = ChatMessageSerializer
    permission_classes = [IsAuthenticatedPermission]

    def get_queryset(self):
        user = self.request.user
        queryset = ChatMessage.objects.alive().order_by('created_at')

        # Администраторы видят все сообщения чата
        is_admin = UserRole.objects.filter(
            user=user,
            role__name='Admin'
        ).exists()

        if not is_admin:
            # Остальные видят только сообщения для своих сделок (где user = seller или executor)
            queryset = queryset.filter(
                Q(deal__seller=user) | Q(deal__executor=user)
            )

        return queryset

    def perform_create(self, serializer):
        # Если пользователь авторизован, сохранить его как author
        author = self.request.user if self.request.user.is_authenticated else None
        serializer.save(author=author)
