from rest_framework import permissions, viewsets
from django.db.models import Q

from .models import Policy
from .serializers import PolicySerializer
from apps.common.permissions import IsAuthenticated as IsAuthenticatedPermission
from apps.users.models import UserRole


class PolicyViewSet(viewsets.ModelViewSet):
    serializer_class = PolicySerializer
    permission_classes = [IsAuthenticatedPermission]

    def get_queryset(self):
        user = self.request.user
        queryset = Policy.objects.alive().order_by('-created_at')

        # Администраторы видят все полисы
        is_admin = UserRole.objects.filter(
            user=user,
            role__name='Admin'
        ).exists()

        if not is_admin:
            # Остальные видят только полисы для своих сделок (где user = seller или executor)
            queryset = queryset.filter(
                Q(deal__seller=user) | Q(deal__executor=user)
            )

        return queryset
