from rest_framework import permissions, viewsets
from django.db.models import Q

from .models import Task
from .serializers import TaskSerializer
from .filters import TaskFilterSet
from apps.common.permissions import IsAuthenticated as IsAuthenticatedPermission, EditProtectedMixin
from apps.users.models import UserRole


class TaskViewSet(EditProtectedMixin, viewsets.ModelViewSet):
    serializer_class = TaskSerializer
    permission_classes = [IsAuthenticatedPermission]
    filterset_class = TaskFilterSet
    search_fields = ['title', 'description']
    ordering_fields = ['created_at', 'updated_at', 'due_at']
    ordering = ['-created_at']

    def get_queryset(self):
        user = self.request.user
        queryset = Task.objects.all().order_by('-created_at')

        # Администраторы видят все задачи
        is_admin = UserRole.objects.filter(
            user=user,
            role__name='Admin'
        ).exists()

        if not is_admin:
            # Остальные видят только задачи для своих сделок (где user = seller или executor)
            queryset = queryset.filter(
                Q(deal__seller=user) | Q(deal__executor=user)
            )

        return queryset

    def perform_create(self, serializer):
        user = self.request.user if self.request.user.is_authenticated else None
        serializer.save(created_by=user)
