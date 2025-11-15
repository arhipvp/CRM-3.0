from apps.common.permissions import EditProtectedMixin
from apps.users.models import UserRole
from django.db.models import Q
from rest_framework import permissions, viewsets
from rest_framework.permissions import AllowAny

from .filters import TaskFilterSet
from .models import Task
from .serializers import TaskSerializer


class TaskViewSet(EditProtectedMixin, viewsets.ModelViewSet):
    serializer_class = TaskSerializer
    filterset_class = TaskFilterSet
    search_fields = ["title", "description"]
    ordering_fields = ["created_at", "updated_at", "due_at"]
    ordering = ["-created_at"]

    def get_queryset(self):
        user = self.request.user
        queryset = Task.objects.all().order_by("-created_at")

        # Если пользователь не аутентифицирован, возвращаем все записи (AllowAny режим)
        if not user.is_authenticated:
            return queryset

        # Администраторы видят все задачи
        is_admin = UserRole.objects.filter(user=user, role__name="Admin").exists()

        if not is_admin:
            # Остальные видят только задачи для своих сделок (где user = seller или executor)
            queryset = queryset.filter(Q(deal__seller=user) | Q(deal__executor=user))

        return queryset

    def perform_create(self, serializer):
        user = self.request.user if self.request.user.is_authenticated else None
        deal = serializer.validated_data.get('deal')
        assignee_provided = 'assignee' in serializer.validated_data
        if not assignee_provided and deal and deal.executor:
            serializer.save(created_by=user, assignee=deal.executor)
            return
        serializer.save(created_by=user)
