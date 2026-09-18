from unittest.mock import patch

from apps.clients.models import Client
from apps.clients.serializers import ClientSerializer
from apps.clients.services import ClientMergeService, ClientMergeSessionService
from apps.common.tests.auth_utils import AuthenticatedAPITestCase
from apps.deals.models import Deal
from django.contrib.auth.models import User
from django.test import TestCase


class ClientReferralAPITests(AuthenticatedAPITestCase):
    def setUp(self):
        super().setUp()
        self.owner = User.objects.create_user(username="referral-owner")
        self.seller = User.objects.create_user(username="referral-seller")
        self.customer = Client.objects.create(name="Customer", created_by=self.owner)
        self.referrer = Client.objects.create(name="Referrer")
        self.url = f"/api/v1/clients/{self.customer.pk}/"
        self.authenticate(self.owner)

    def test_create_replace_clear_and_read_referrer(self):
        response = self.api_client.post(
            "/api/v1/clients/",
            {"name": "New customer", "referred_by": str(self.referrer.pk)},
            format="json",
        )
        self.assertEqual(response.status_code, 201)
        self.assertEqual(response.data["referred_by_name"], "Referrer")
        self.assertFalse(response.data["referred_by_deleted"])
        for value in (
            str(self.referrer.pk),
            str(Client.objects.create(name="Other").pk),
            None,
        ):
            with self.subTest(value=value):
                response = self.api_client.patch(
                    self.url, {"referred_by": value}, format="json"
                )
                self.assertEqual(response.status_code, 200)
                self.customer.refresh_from_db()
                self.assertEqual(
                    str(self.customer.referred_by_id) if value else None, value
                )

    def test_reject_self_missing_and_new_deleted_referrer(self):
        self.referrer.delete()
        for value in (
            str(self.customer.pk),
            str(self.referrer.pk),
            "00000000-0000-0000-0000-000000000000",
        ):
            with self.subTest(value=value):
                response = self.api_client.patch(
                    self.url, {"referred_by": value}, format="json"
                )
                self.assertEqual(response.status_code, 400)

    def test_soft_deleted_referrer_is_retained_and_hard_delete_clears(self):
        self.customer.referred_by = self.referrer
        self.customer.save()
        self.referrer.delete()
        response = self.api_client.patch(
            self.url,
            {"referred_by": str(self.referrer.pk), "notes": "Updated"},
            format="json",
        )
        self.assertEqual(response.status_code, 200)
        self.assertTrue(response.data["referred_by_deleted"])
        self.assertEqual(response.data["referred_by_name"], "Referrer")
        self.referrer.hard_delete()
        self.customer.refresh_from_db()
        self.assertIsNone(self.customer.referred_by_id)
        self.assertFalse(ClientSerializer(self.customer).data["referred_by_deleted"])

    def test_seller_can_update_referral_but_no_other_writable_field(self):
        Deal.objects.create(title="Active", client=self.customer, seller=self.seller)
        self.authenticate(self.seller)
        response = self.api_client.patch(
            self.url, {"referred_by": str(self.referrer.pk)}, format="json"
        )
        self.assertEqual(response.status_code, 200)
        forbidden = {
            "name": "Changed",
            "phone": "123",
            "email": "changed@example.com",
            "birth_date": "2000-01-01",
            "notes": "Changed",
            "drive_folder_id": "stolen-folder",
        }
        for field, value in forbidden.items():
            with self.subTest(field=field):
                response = self.api_client.patch(
                    self.url, {"referred_by": None, field: value}, format="json"
                )
                self.assertEqual(response.status_code, 403)
        self.customer.refresh_from_db()
        self.assertEqual(self.customer.referred_by_id, self.referrer.pk)

    def test_unrelated_or_deleted_deal_seller_cannot_edit(self):
        self.authenticate(self.seller)
        for has_deleted_deal in (False, True):
            if has_deleted_deal:
                Deal.objects.create(
                    title="Deleted", client=self.customer, seller=self.seller
                ).delete()
            response = self.api_client.patch(
                self.url, {"referred_by": str(self.referrer.pk)}, format="json"
            )
            self.assertEqual(response.status_code, 403)


class ClientReferralMergeTests(TestCase):
    def setUp(self):
        self.target = Client.objects.create(name="Target")
        self.referrer = Client.objects.create(name="Referrer")
        self.source = Client.objects.create(name="Source", referred_by=self.referrer)

    def service(self):
        return ClientMergeService(
            target_client=self.target,
            source_clients=[self.source],
            include_deleted=False,
        )

    def test_inherit_referrer_and_retarget_even_deleted_incoming_clients(self):
        incoming = Client.objects.create(name="Incoming", referred_by=self.source)
        deleted = Client.objects.create(
            name="Deleted incoming", referred_by=self.source
        )
        deleted.delete()
        self.service().merge(sync_drive=False)
        self.target.refresh_from_db()
        incoming.refresh_from_db()
        deleted.refresh_from_db()
        self.assertEqual(self.target.referred_by_id, self.referrer.pk)
        self.assertEqual(incoming.referred_by_id, self.target.pk)
        self.assertEqual(deleted.referred_by_id, self.target.pk)

    @patch("apps.clients.services.ClientMergeService._prepare_drive_folders")
    @patch("apps.clients.services.ensure_client_folder")
    def test_conflict_blocks_direct_and_session_merge_before_drive(
        self, ensure_folder, prepare
    ):
        self.target.referred_by = Client.objects.create(name="Different referrer")
        self.target.save()
        with self.assertRaisesMessage(ValueError, "разные значения"):
            self.service().merge()
        with self.assertRaisesMessage(ValueError, "разные значения"):
            ClientMergeSessionService.start(
                target_client=self.target,
                source_clients=[self.source],
                actor=None,
                include_deleted=True,
                field_overrides={},
            )
        prepare.assert_not_called()
        ensure_folder.assert_not_called()

    @patch("apps.clients.services.is_drive_oauth_configured", return_value=False)
    def test_finalize_rechecks_changed_referrer(self, configured):
        session = ClientMergeSessionService.start(
            target_client=self.target,
            source_clients=[self.source],
            actor=None,
            include_deleted=True,
            field_overrides={},
        )
        Client.objects.filter(pk=self.target.pk).update(
            referred_by=Client.objects.create(name="Other")
        )
        with self.assertRaisesMessage(ValueError, "разные значения"):
            ClientMergeSessionService(session).finalize(
                target_client=self.target, source_clients=[self.source], actor=None
            )
        self.assertTrue(Client.objects.filter(pk=self.source.pk).exists())

    def test_merge_clears_referral_into_merged_group(self):
        self.source.referred_by = self.target
        self.source.save()
        self.service().merge(sync_drive=False)
        self.target.refresh_from_db()
        self.assertIsNone(self.target.referred_by_id)

    def test_same_referrer_does_not_conflict_or_follow_chain(self):
        self.target.referred_by = self.referrer
        self.target.save()
        self.referrer.referred_by = Client.objects.create(name="Indirect")
        self.referrer.save()
        self.service().merge(sync_drive=False)
        self.target.refresh_from_db()
        self.assertEqual(self.target.referred_by_id, self.referrer.pk)
