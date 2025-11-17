from apps.common.permissions import EditProtectedMixin
from apps.users.models import UserRole
from django.db.models import Q
from rest_framework import permissions, viewsets
from rest_framework.permissions import AllowAny

from .filters import ClientFilterSet
from .models import Client
from .serializers import ClientSerializer


class ClientViewSet(EditProtectedMixin, viewsets.ModelViewSet):
    serializer_class = ClientSerializer
    filterset_class = ClientFilterSet
    search_fields = ["name", "phone"]
    ordering_fields = ["created_at", "updated_at", "name"]
    ordering = ["-created_at"]
    owner_field = "created_by"

    def perform_create(self, serializer):
        serializer.save(created_by=self.request.user)

    def get_queryset(self):
        user = self.request.user
        queryset = Client.objects.alive().order_by("-created_at")

        # Если пользователь не аутентифицирован, возвращаем все записи (AllowAny режим)
        if not user.is_authenticated:
            return queryset

        # Администраторы видят всех клиентов
        is_admin = UserRole.objects.filter(user=user, role__name="Admin").exists()

        if not is_admin:
            queryset = queryset.filter(
                Q(created_by=user)
                | Q(deals__seller=user)
                | Q(deals__executor=user)
            ).distinct()

        return queryset
