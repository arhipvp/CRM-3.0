from importlib import import_module
from types import SimpleNamespace
from unittest.mock import patch

from apps.clients.models import Client
from apps.common.audit import (
    AuditContextMiddleware,
    audit_context,
    audit_request_context,
    get_audit_actor,
)
from apps.common.tests.auth_utils import AuthenticatedAPITestCase
from apps.deals.history_utils import map_audit_log_entry
from apps.deals.models import Deal
from apps.notes.models import Note
from apps.users.models import AuditLog, Role, UserRole
from apps.users.serializers import AuditLogSerializer
from django.apps import apps
from django.contrib.auth.models import AnonymousUser, User
from django.db import connection
from django.http import HttpResponse
from django.test import RequestFactory, TestCase


class AuditIdentityTests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            username="audit-user", first_name="Иван", last_name="Иванов"
        )
        self.other = User.objects.create_user(username="other-user")

    def make_log(self, **kwargs):
        return AuditLog.objects.create(
            object_type="deal", object_id="test-deal", action="update", **kwargs
        )

    def test_snapshot_survives_user_rename_and_deletion(self):
        log = self.make_log(actor=self.user)
        self.user.username = "renamed"
        self.user.first_name = "Пётр"
        self.user.save()
        log.description = "Updated description"
        log.save()
        log.refresh_from_db()
        self.assertEqual(log.actor_name, "Иван Иванов")
        self.assertEqual(log.actor_username, "audit-user")
        self.user.delete()
        log.refresh_from_db()
        self.assertIsNone(log.actor_id)
        payload = AuditLogSerializer(log).data
        self.assertEqual(payload["actor_name"], "Иван Иванов")
        self.assertEqual(payload["actor_username"], "audit-user")
        history = map_audit_log_entry(log, "test-deal")
        self.assertEqual(history["user_display_name"], "Иван Иванов")
        self.assertEqual(history["user_username"], "audit-user")

    def test_legacy_identity_falls_back_without_inventing_missing_actor(self):
        log = self.make_log(actor=self.user)
        AuditLog.objects.filter(pk=log.pk).update(actor_name="", actor_username="")
        log.refresh_from_db()
        self.assertEqual(log.display_actor_name, "Иван Иванов")
        self.assertEqual(log.display_actor_username, "audit-user")
        unknown = self.make_log()
        self.assertIsNone(unknown.actor_id)
        self.assertEqual(unknown.display_actor_name, "")
        self.assertEqual(unknown.display_actor_username, "")

    def test_snapshot_accepts_maximum_user_full_name(self):
        self.user.first_name = "И" * 150
        self.user.last_name = "Ф" * 150
        self.user.save()
        log = self.make_log(actor=self.user)
        log.full_clean()
        self.assertEqual(log.actor_name, self.user.get_full_name())

    def test_backfill_only_snapshots_known_legacy_actors(self):
        legacy = self.make_log(actor=self.user)
        AuditLog.objects.filter(pk=legacy.pk).update(actor_name="", actor_username="")
        unknown = self.make_log()
        existing = self.make_log(actor=self.other)
        AuditLog.objects.filter(pk=existing.pk).update(
            actor_name="Historical name", actor_username="historical-login"
        )
        migration = import_module(
            "apps.users.migrations.0007_backfill_audit_actor_snapshot"
        )
        migration.backfill_actor_snapshots(apps, SimpleNamespace(connection=connection))
        legacy.refresh_from_db()
        unknown.refresh_from_db()
        existing.refresh_from_db()
        self.assertEqual(legacy.actor_name, "Иван Иванов")
        self.assertEqual(legacy.actor_username, "audit-user")
        self.assertIsNone(unknown.actor_id)
        self.assertEqual(unknown.actor_name, "")
        self.assertEqual(unknown.actor_username, "")
        self.assertEqual(existing.actor_name, "Historical name")
        self.assertEqual(existing.actor_username, "historical-login")

    def test_explicit_actor_takes_precedence_over_request_user(self):
        request = RequestFactory().post("/api/v1/deals/")
        request.user = self.user
        with audit_request_context(request):
            log = self.make_log(actor=self.other)
        self.assertEqual(log.actor_id, self.other.pk)
        self.assertEqual(log.actor_username, "other-user")
        self.assertIsNone(get_audit_actor())

    def test_scoped_context_restores_outer_actor_after_exception(self):
        with audit_context(self.user):
            with self.assertRaisesRegex(RuntimeError, "failed"):
                with audit_context(self.other):
                    self.assertEqual(get_audit_actor(), self.other)
                    raise RuntimeError("failed")
            self.assertEqual(get_audit_actor(), self.user)
        self.assertIsNone(get_audit_actor())

    def test_middleware_resolves_late_authentication_and_cleans_up(self):
        request = RequestFactory().post("/api/v1/deals/")
        request.user = AnonymousUser()

        def get_response(raw_request):
            self.assertIsNone(get_audit_actor())
            raw_request.user = self.user
            self.assertEqual(self.make_log().actor_id, self.user.pk)
            return HttpResponse()

        AuditContextMiddleware(get_response)(request)
        self.assertIsNone(get_audit_actor())
        self.assertIsNone(self.make_log().actor_id)

        def fail(raw_request):
            self.assertEqual(get_audit_actor(), self.user)
            raise RuntimeError("failed")

        with self.assertRaisesRegex(RuntimeError, "failed"):
            AuditContextMiddleware(fail)(request)
        self.assertIsNone(get_audit_actor())

    def test_mcp_context_preserves_actor_and_channel(self):
        from apps.mcp_connector.bridge import audit_context as mcp_audit_context

        with mcp_audit_context(self.user):
            log = self.make_log(description="Changed by integration")
        self.assertEqual(log.actor_id, self.user.pk)
        self.assertEqual(log.actor_name, "Иван Иванов")
        self.assertEqual(log.actor_username, "audit-user")
        self.assertIn("[ChatGPT]", log.description)
        self.assertIsNone(get_audit_actor())


class AuditHttpTests(AuthenticatedAPITestCase):
    def setUp(self):
        super().setUp()
        drive = patch("apps.deals.signals.ensure_deal_folder")
        drive.start()
        self.addCleanup(drive.stop)
        self.seller = User.objects.create_user(username="seller")
        self.executor = User.objects.create_user(username="executor")
        self.customer = Client.objects.create(name="Audit client")
        self.deal = Deal.objects.create(
            title="Audit deal",
            client=self.customer,
            seller=self.seller,
            executor=self.executor,
        )
        self.authenticate(self.seller)

    def latest_log(self, object_type, object_id):
        return AuditLog.objects.filter(
            object_type=object_type, object_id=str(object_id)
        ).latest("created_at", "id")

    def test_note_create_edit_delete_restore_use_actual_jwt_user(self):
        response = self.client.post(
            "/api/v1/notes/",
            {"deal": str(self.deal.pk), "body": "Created by seller"},
            format="json",
        )
        self.assertEqual(response.status_code, 201, response.data)
        note_id = response.data["id"]
        self.assertEqual(self.latest_log("note", note_id).actor_id, self.seller.pk)

        foreign_note = Note.objects.create(
            deal=self.deal, body="Executor note", author=self.executor
        )
        url = f"/api/v1/notes/{foreign_note.pk}/"
        response = self.client.patch(url, {"body": "Seller edit"}, format="json")
        self.assertEqual(response.status_code, 200, response.data)
        self.assertEqual(
            self.latest_log("note", foreign_note.pk).actor_id, self.seller.pk
        )
        response = self.client.delete(url)
        self.assertEqual(response.status_code, 204)
        log = self.latest_log("note", foreign_note.pk)
        self.assertEqual(log.action, "soft_delete")
        self.assertEqual(log.actor_id, self.seller.pk)
        response = self.client.post(f"{url}restore/", {}, format="json")
        self.assertEqual(response.status_code, 200, response.data)
        self.assertEqual(
            self.latest_log("note", foreign_note.pk).actor_id, self.seller.pk
        )
        self.assertIsNone(get_audit_actor())
        background_note = Note.objects.create(deal=self.deal, body="Background")
        self.assertIsNone(self.latest_log("note", background_note.pk).actor_id)

    def test_deal_crud_and_history_include_actual_actor(self):
        response = self.client.post(
            "/api/v1/deals/",
            {"title": "Created deal", "client": str(self.customer.pk)},
            format="json",
        )
        self.assertEqual(response.status_code, 201, response.data)
        deal_id = response.data["id"]
        self.assertEqual(self.latest_log("deal", deal_id).actor_id, self.seller.pk)
        url = f"/api/v1/deals/{deal_id}/"
        response = self.client.patch(url, {"title": "Edited deal"}, format="json")
        self.assertEqual(response.status_code, 200, response.data)
        self.assertEqual(self.latest_log("deal", deal_id).actor_id, self.seller.pk)
        response = self.client.get(f"{url}history/")
        self.assertEqual(response.status_code, 200, response.data)
        self.assertTrue(response.data)
        self.assertTrue(all(row["user_username"] == "seller" for row in response.data))
        response = self.client.delete(url)
        self.assertEqual(response.status_code, 204)
        self.assertEqual(self.latest_log("deal", deal_id).actor_id, self.seller.pk)
        response = self.client.post(f"{url}restore/", {}, format="json")
        self.assertEqual(response.status_code, 200, response.data)
        self.assertEqual(self.latest_log("deal", deal_id).actor_id, self.seller.pk)

    def test_admin_edit_and_delete_foreign_note_preserve_historical_identity(self):
        admin = User.objects.create_user(
            username="audit-admin", first_name="Анна", last_name="Петрова"
        )
        role, _ = Role.objects.get_or_create(name="Admin")
        UserRole.objects.create(user=admin, role=role)
        note = Note.objects.create(
            deal=self.deal, body="Seller note", author=self.seller
        )
        self.authenticate(admin)
        url = f"/api/v1/notes/{note.pk}/"
        response = self.client.patch(url, {"body": "Admin edit"}, format="json")
        self.assertEqual(response.status_code, 200, response.data)
        edit_log = self.latest_log("note", note.pk)
        self.assertEqual(edit_log.actor_id, admin.pk)
        self.assertEqual(edit_log.actor_name, "Анна Петрова")
        self.assertEqual(edit_log.actor_username, "audit-admin")

        response = self.client.delete(url)
        self.assertEqual(response.status_code, 204)
        delete_log = self.latest_log("note", note.pk)
        self.assertEqual(delete_log.action, "soft_delete")
        self.assertEqual(delete_log.actor_id, admin.pk)

        admin.first_name = "Мария"
        admin.username = "renamed-admin"
        admin.save(update_fields=["first_name", "username"])
        response = self.client.get(f"/api/v1/audit_logs/{edit_log.pk}/")
        self.assertEqual(response.status_code, 200, response.data)
        self.assertEqual(response.data["actor"], admin.pk)
        self.assertEqual(response.data["actor_name"], "Анна Петрова")
        self.assertEqual(response.data["actor_username"], "audit-admin")

    def test_audit_api_rejects_client_writes(self):
        log = AuditLog.objects.create(
            actor=self.seller,
            object_type="deal",
            object_id=str(self.deal.pk),
            action="update",
        )
        count = AuditLog.objects.count()
        payload = {"actor": self.executor.pk, "actor_name": "Forged"}
        for method, url in (
            (self.client.post, "/api/v1/audit_logs/"),
            (self.client.patch, f"/api/v1/audit_logs/{log.pk}/"),
            (self.client.put, f"/api/v1/audit_logs/{log.pk}/"),
        ):
            with self.subTest(method=method.__name__):
                response = method(url, payload, format="json")
                self.assertEqual(response.status_code, 403, response.data)
        response = self.client.delete(f"/api/v1/audit_logs/{log.pk}/")
        self.assertEqual(response.status_code, 403, response.data)
        self.assertEqual(AuditLog.objects.count(), count)
        log.refresh_from_db()
        self.assertEqual(log.actor_id, self.seller.pk)
        self.assertEqual(log.actor_username, "seller")
