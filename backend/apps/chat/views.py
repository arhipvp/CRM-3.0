from rest_framework import permissions, viewsets

from .models import ChatMessage
from .serializers import ChatMessageSerializer


class ChatMessageViewSet(viewsets.ModelViewSet):
    queryset = ChatMessage.objects.alive().order_by('created_at')
    serializer_class = ChatMessageSerializer
    permission_classes = [permissions.AllowAny]

    def perform_create(self, serializer):
        # Если пользователь авторизован, сохранить его как author
        author = self.request.user if self.request.user.is_authenticated else None
        serializer.save(author=author)
