from apps.common.permissions import EditProtectedMixin
from apps.users.models import UserRole
from django.db.models import Q
from django.utils import timezone
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
    owner_field = "created_by"

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
        deal = serializer.validated_data.get("deal")
        assignee_provided = "assignee" in serializer.validated_data
        completion_kwargs = {}
        status = serializer.validated_data.get("status")
        if status == Task.TaskStatus.DONE:
            completion_kwargs["completed_by"] = user
            completion_kwargs["completed_at"] = timezone.now()
        if not assignee_provided and deal and deal.executor:
            serializer.save(created_by=user, assignee=deal.executor, **completion_kwargs)
            return
        serializer.save(created_by=user, **completion_kwargs)

    def perform_update(self, serializer):
        user = self.request.user if self.request.user.is_authenticated else None
        old_status = serializer.instance.status
        new_status = serializer.validated_data.get("status", old_status)
        completion_kwargs = {}
        if new_status == Task.TaskStatus.DONE and old_status != Task.TaskStatus.DONE:
            completion_kwargs["completed_by"] = user
            completion_kwargs["completed_at"] = timezone.now()
        elif new_status != Task.TaskStatus.DONE and old_status == Task.TaskStatus.DONE:
            completion_kwargs["completed_by"] = None
            completion_kwargs["completed_at"] = None
        serializer.save(**completion_kwargs)

    def _is_deal_seller(self, user, instance):
        """Позволяет продавцу управлять задачами сделки."""
        if not user or not user.is_authenticated or not instance:
            return False
        deal = getattr(instance, "deal", None)
        return bool(deal and deal.seller_id == user.id)

    def _can_modify(self, user, instance):
        if super()._can_modify(user, instance):
            return True
        return self._is_deal_seller(user, instance)
