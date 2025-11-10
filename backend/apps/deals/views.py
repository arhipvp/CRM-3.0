from rest_framework import permissions, viewsets

from .models import Deal
from .serializers import DealSerializer


class DealViewSet(viewsets.ModelViewSet):
    queryset = Deal.objects.select_related('client').all().order_by('next_review_date', '-created_at')
    serializer_class = DealSerializer
    permission_classes = [permissions.AllowAny]
