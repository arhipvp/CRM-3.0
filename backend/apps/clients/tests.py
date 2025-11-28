from django.contrib.auth.models import User
from django.test import TestCase

from rest_framework.test import APIRequestFactory, force_authenticate

from apps.clients.models import Client
from apps.clients.serializers import ClientSerializer
from apps.clients.views import ClientViewSet
from apps.deals.models import Deal


class ClientOwnershipTests(TestCase):
    def setUp(self):
        self.factory = APIRequestFactory()
        self.user = User.objects.create_user(username="owner")
        self.other_user = User.objects.create_user(username="other")

    def test_owner_query_includes_created_clients(self):
        client_owned = Client.objects.create(name="Owned", created_by=self.user)
        client_for_deal = Client.objects.create(name="Deal client")
        Deal.objects.create(title="Deal", client=client_for_deal, seller=self.user)
        client_other = Client.objects.create(
            name="Other client", created_by=self.other_user
        )

        request = self.factory.get("/clients/")
        force_authenticate(request, user=self.user)
        viewset = ClientViewSet()
        viewset.request = request
        queryset = viewset.get_queryset()

        self.assertIn(client_owned, queryset)
        self.assertIn(client_for_deal, queryset)
        self.assertNotIn(client_other, queryset)

    def test_perform_create_sets_created_by(self):
        request = self.factory.post("/clients/", {"name": "New"})
        force_authenticate(request, user=self.user)
        serializer = ClientSerializer(data={"name": "New client"})
        serializer.is_valid(raise_exception=True)

        viewset = ClientViewSet()
        viewset.request = request
        viewset.perform_create(serializer)

        self.assertEqual(serializer.instance.created_by, self.user)

    def test_owner_can_modify(self):
        client = Client.objects.create(name="Owned", created_by=self.user)
        viewset = ClientViewSet()

        self.assertTrue(viewset._can_modify(self.user, client))
        self.assertFalse(viewset._can_modify(self.other_user, client))
