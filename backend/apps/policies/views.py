from rest_framework import permissions, viewsets

from .models import Policy
from .serializers import PolicySerializer


class PolicyViewSet(viewsets.ModelViewSet):
    queryset = Policy.objects.alive().order_by('-created_at')
    serializer_class = PolicySerializer
    permission_classes = [permissions.AllowAny]
