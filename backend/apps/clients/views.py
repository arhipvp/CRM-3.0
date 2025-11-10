from rest_framework import permissions, viewsets

from .models import Client, Contact
from .serializers import ClientSerializer, ContactSerializer


class ClientViewSet(viewsets.ModelViewSet):
    queryset = Client.objects.all().order_by('-created_at')
    serializer_class = ClientSerializer
    permission_classes = [permissions.AllowAny]


class ContactViewSet(viewsets.ModelViewSet):
    queryset = Contact.objects.select_related('client').all()
    serializer_class = ContactSerializer
    permission_classes = [permissions.AllowAny]
