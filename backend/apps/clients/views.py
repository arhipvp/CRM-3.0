from rest_framework import permissions, viewsets
from django.db.models import Q

from .models import Client
from .serializers import ClientSerializer
from .filters import ClientFilterSet
from apps.common.permissions import IsAuthenticated as IsAuthenticatedPermission, EditProtectedMixin
from apps.users.models import UserRole


class ClientViewSet(EditProtectedMixin, viewsets.ModelViewSet):
    serializer_class = ClientSerializer
    permission_classes = [IsAuthenticatedPermission]
    filterset_class = ClientFilterSet
    search_fields = ['name', 'phone']
    ordering_fields = ['created_at', 'updated_at', 'name']
    ordering = ['-created_at']

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
