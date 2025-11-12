from rest_framework import permissions, viewsets
from django.db.models import Q

from .models import Client
from .serializers import ClientSerializer
from apps.common.permissions import IsAuthenticated as IsAuthenticatedPermission
from apps.users.models import UserRole


class ClientViewSet(viewsets.ModelViewSet):
    serializer_class = ClientSerializer
    permission_classes = [IsAuthenticatedPermission]

    def get_queryset(self):
        user = self.request.user
        queryset = Client.objects.alive().order_by('-created_at')

        # Администраторы видят всех клиентов
        is_admin = UserRole.objects.filter(
            user=user,
            role__name='Admin'
        ).exists()

        if not is_admin:
            # Остальные видят только клиентов, у которых есть сделки, где user = seller или executor
            queryset = queryset.filter(
                Q(deals__seller=user) | Q(deals__executor=user)
            ).distinct()

        return queryset
