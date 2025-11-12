from rest_framework import permissions, viewsets

from .models import Notification
from .serializers import NotificationSerializer
from apps.common.permissions import IsAuthenticated as IsAuthenticatedPermission


class NotificationViewSet(viewsets.ModelViewSet):
    serializer_class = NotificationSerializer
    permission_classes = [IsAuthenticatedPermission]

    def get_queryset(self):
        return Notification.objects.filter(user=self.request.user)

    def perform_create(self, serializer):
        serializer.save(user=self.request.user)
