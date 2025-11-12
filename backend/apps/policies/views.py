from rest_framework import permissions, viewsets
from django.db.models import Q

from .models import Policy
from .serializers import PolicySerializer
from .filters import PolicyFilterSet
from apps.common.permissions import IsAuthenticated as IsAuthenticatedPermission, EditProtectedMixin
from apps.users.models import UserRole


class PolicyViewSet(EditProtectedMixin, viewsets.ModelViewSet):
    serializer_class = PolicySerializer
    permission_classes = [IsAuthenticatedPermission]
    filterset_class = PolicyFilterSet
    search_fields = ['number', 'insurance_company', 'insurance_type']
    ordering_fields = ['created_at', 'updated_at', 'start_date', 'end_date', 'amount']
    ordering = ['-created_at']

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
