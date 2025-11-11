from rest_framework import permissions, viewsets

from .models import Deal, Quote
from .serializers import DealSerializer, QuoteSerializer


class DealViewSet(viewsets.ModelViewSet):
    queryset = Deal.objects.select_related("client").prefetch_related("quotes").all().order_by("next_review_date", "-created_at")
    serializer_class = DealSerializer
    permission_classes = [permissions.AllowAny]


class QuoteViewSet(viewsets.ModelViewSet):
    serializer_class = QuoteSerializer
    permission_classes = [permissions.AllowAny]

    def get_queryset(self):
        queryset = Quote.objects.select_related("deal", "deal__client").all().order_by("-created_at")
        deal_id = self.request.query_params.get("deal")
        if deal_id:
            queryset = queryset.filter(deal_id=deal_id)
        return queryset

    def perform_create(self, serializer):
        serializer.save()
