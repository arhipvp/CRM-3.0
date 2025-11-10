from rest_framework import permissions, viewsets

from .models import Deal, DealStage, Pipeline
from .serializers import DealSerializer, DealStageSerializer, PipelineSerializer


class PipelineViewSet(viewsets.ModelViewSet):
    queryset = Pipeline.objects.all()
    serializer_class = PipelineSerializer
    permission_classes = [permissions.IsAuthenticated]


class DealStageViewSet(viewsets.ModelViewSet):
    queryset = DealStage.objects.select_related('pipeline').all()
    serializer_class = DealStageSerializer
    permission_classes = [permissions.IsAuthenticated]


class DealViewSet(viewsets.ModelViewSet):
    queryset = Deal.objects.select_related('client', 'stage', 'pipeline').all()
    serializer_class = DealSerializer
    permission_classes = [permissions.IsAuthenticated]
