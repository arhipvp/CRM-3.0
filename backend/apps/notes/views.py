from rest_framework import permissions, viewsets

from .models import Note
from .serializers import NoteSerializer


class NoteViewSet(viewsets.ModelViewSet):
    serializer_class = NoteSerializer
    permission_classes = [permissions.AllowAny]

    def get_queryset(self):
        queryset = Note.objects.select_related('deal', 'client').all()
        deal_id = self.request.query_params.get('deal')
        client_id = self.request.query_params.get('client')
        if deal_id:
            queryset = queryset.filter(deal_id=deal_id)
        if client_id:
            queryset = queryset.filter(client_id=client_id)
        return queryset
