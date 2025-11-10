from rest_framework import permissions, viewsets

from .models import Deal
from .serializers import DealSerializer


class DealViewSet(viewsets.ModelViewSet):
    queryset = Deal.objects.select_related('client').all()
    serializer_class = DealSerializer
    permission_classes = [permissions.AllowAny]
