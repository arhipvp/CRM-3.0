from apps.common.permissions import EditProtectedMixin
from apps.users.models import UserRole
from django.db.models import Q
from rest_framework import permissions, viewsets
from rest_framework.permissions import AllowAny

from .models import Note
from .serializers import NoteSerializer


class NoteViewSet(EditProtectedMixin, viewsets.ModelViewSet):
    serializer_class = NoteSerializer

    def get_queryset(self):
        user = self.request.user
        queryset = Note.objects.select_related("deal").all()

        # Если пользователь не аутентифицирован, возвращаем все записи (AllowAny режим)
        if not user.is_authenticated:
            deal_id = self.request.query_params.get("deal")
            if deal_id:
                queryset = queryset.filter(deal_id=deal_id)
            return queryset

        # Администраторы видят все заметки
        is_admin = UserRole.objects.filter(user=user, role__name="Admin").exists()

        if not is_admin:
            # Остальные видят только заметки для своих сделок (где user = seller или executor)
            queryset = queryset.filter(Q(deal__seller=user) | Q(deal__executor=user))

        deal_id = self.request.query_params.get("deal")
        if deal_id:
            queryset = queryset.filter(deal_id=deal_id)
        return queryset
