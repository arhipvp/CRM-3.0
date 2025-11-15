from apps.common.permissions import EditProtectedMixin
from apps.users.models import UserRole
from django.db.models import Q
from rest_framework import permissions, viewsets
from rest_framework.permissions import AllowAny

from .filters import PolicyFilterSet
from .models import Policy
from .serializers import PolicySerializer


class PolicyViewSet(EditProtectedMixin, viewsets.ModelViewSet):
    serializer_class = PolicySerializer
    filterset_class = PolicyFilterSet
    search_fields = ["number", "insurance_company__name", "insurance_type__name"]
    ordering_fields = ["created_at", "updated_at", "start_date", "end_date", "brand", "model"]
    ordering = ["-created_at"]

    def get_queryset(self):
        user = self.request.user
        queryset = Policy.objects.alive().order_by("-created_at")

        # Если пользователь не аутентифицирован, возвращаем все записи (AllowAny режим)
        if not user.is_authenticated:
            return queryset

        # Администраторы видят все полисы
        is_admin = UserRole.objects.filter(user=user, role__name="Admin").exists()

        if not is_admin:
            # Остальные видят только полисы для своих сделок (где user = seller или executor)
            queryset = queryset.filter(Q(deal__seller=user) | Q(deal__executor=user))

        return queryset
