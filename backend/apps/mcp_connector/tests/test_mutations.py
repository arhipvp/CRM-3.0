import uuid
from unittest.mock import patch

from apps.clients.models import Client
from apps.insurance_requests.models import ClientPassport
from apps.notes.models import Note
from django.core import signing

from ..contracts import Principal
from ..models import McpMutation
from ..mutations import PREVIEW_SALT
from .test_tools import McpFixture


class MutationTests(McpFixture):
    def preview(self, tool="crm_update_clients", arguments=None):
        return self.call(
            "crm_preview_change",
            {
                "tool_name": tool,
                "arguments": arguments
                or {"id": str(self.customer.pk), "data": {"phone": "79111111111"}},
            },
        )

    def apply(self, preview, arguments=None, principal=None, key=None):
        return self.call(
            "crm_apply_change",
            {
                "tool_name": preview["tool_name"],
                "arguments": arguments
                or {"id": str(self.customer.pk), "data": {"phone": "79111111111"}},
                "preview_token": preview["preview_token"],
                "confirmed": True,
                "request_id": str(key or uuid.uuid4()),
            },
            principal,
        )

    def test_replacement_requires_pure_preview_and_exact_confirmation(self):
        args = {"id": str(self.customer.pk), "data": {"phone": "79111111111"}}
        direct = self.write("crm_update_clients", args)
        self.assertEqual(direct["error"]["code"], "preview_required")
        counts = Client.objects.count(), McpMutation.objects.count()
        preview = self.preview()
        self.assertNotIn("error", preview, preview)
        self.assertFalse(preview["committed"])
        self.customer.refresh_from_db()
        self.assertEqual(self.customer.phone, "79000000000")
        self.assertEqual((Client.objects.count(), McpMutation.objects.count()), counts)
        applied = self.apply(preview)
        self.assertNotIn("error", applied, applied)
        self.customer.refresh_from_db()
        self.assertEqual(self.customer.phone, "79111111111")

    def test_stale_preview_rejected(self):
        preview = self.preview()
        self.customer.notes = "Параллельная правка"
        self.customer.save()
        result = self.apply(preview)
        self.assertEqual(result["error"]["code"], "sources_changed")
        self.customer.refresh_from_db()
        self.assertEqual(self.customer.phone, "79000000000")

    def test_payload_and_connection_binding(self):
        preview = self.preview()
        changed = self.apply(
            preview, {"id": str(self.customer.pk), "data": {"phone": "79222222222"}}
        )
        self.assertEqual(changed["error"]["code"], "preview_mismatch")
        other_connection = Principal(
            self.user, "another-chatgpt", self.principal.scopes
        )
        self.assertEqual(
            self.apply(preview, principal=other_connection)["error"]["code"],
            "preview_mismatch",
        )

    def test_expired_preview_and_confirmation(self):
        preview = self.preview()
        with patch("django.core.signing.time.time", return_value=0):
            payload = signing.loads(preview["preview_token"], salt=PREVIEW_SALT)
            expired = signing.dumps(payload, salt=PREVIEW_SALT, compress=True)
        preview["preview_token"] = expired
        self.assertEqual(self.apply(preview)["error"]["code"], "preview_expired")
        fresh = self.preview()
        result = self.call(
            "crm_apply_change",
            {
                "tool_name": fresh["tool_name"],
                "arguments": {
                    "id": str(self.customer.pk),
                    "data": {"phone": "79111111111"},
                },
                "preview_token": fresh["preview_token"],
                "confirmed": False,
                "request_id": str(uuid.uuid4()),
            },
        )
        self.assertEqual(result["error"]["code"], "confirmation_required")

    def test_apply_replays_without_duplicate_write(self):
        preview = self.preview()
        key = uuid.uuid4()
        first = self.apply(preview, key=key)
        second = self.apply(preview, key=key)
        self.assertNotIn("error", first, first)
        self.assertTrue(second["replayed"])

    def test_privilege_revoked_between_preview_and_apply(self):
        preview = self.preview()
        self.grant.scopes = ["crm.read", "crm.write"]
        self.grant.save()
        self.assertEqual(self.apply(preview)["error"]["status"], 403)

    def test_replay_does_not_disclose_result_after_ownership_change(self):
        key = uuid.uuid4()
        body = {"data": {"deal": str(self.deal.pk), "body": "Секретная заметка"}}
        first = self.write("crm_create_notes", body, key)
        self.assertNotIn("error", first, first)
        self.deal.seller = self.other
        self.deal.executor = self.other
        self.deal.save()
        self.assertEqual(
            self.write("crm_create_notes", body, key)["error"]["status"], 403
        )

    def test_invalid_preview_does_not_reserve_request_id(self):
        preview = self.preview()
        key = uuid.uuid4()
        original = preview["preview_token"]
        preview["preview_token"] = "invalid"
        self.assertEqual(
            self.apply(preview, key=key)["error"]["code"], "preview_expired"
        )
        self.assertFalse(McpMutation.objects.filter(request_id=key).exists())
        preview["preview_token"] = original
        self.assertNotIn("error", self.apply(preview, key=key))

    def test_create_preview_has_no_drive_or_other_side_effects(self):
        with patch("apps.clients.signals.ensure_client_folder") as drive:
            result = self.preview(
                "crm_create_clients", {"data": {"name": "Предпросмотр"}}
            )
        self.assertNotIn("error", result, result)
        drive.assert_not_called()
        self.assertFalse(Client.objects.filter(name="Предпросмотр").exists())

    def test_delete_preview_cannot_delete_or_move_note_attachments(self):
        note = Note.objects.create(
            deal=self.deal,
            body="Исходная заметка",
            author=self.user,
            attachments=[{"id": "drive-file", "name": "Файл.pdf"}],
        )
        with patch("apps.notes.views.move_drive_file_to_folder") as move, patch(
            "apps.mcp_connector.bridge._check_note_attachments"
        ):
            result = self.preview("crm_delete_notes", {"id": str(note.pk)})
        self.assertNotIn("error", result, result)
        move.assert_not_called()
        note.refresh_from_db()
        self.assertIsNone(note.deleted_at)

    def test_new_current_document_previews_deactivation_of_previous_document(self):
        old = ClientPassport.objects.create(client=self.customer, number="old")
        arguments = {"data": {"client": str(self.customer.pk), "number": "new"}}
        direct = self.write("crm_create_passports", arguments)
        self.assertEqual(direct["error"]["code"], "preview_required")
        preview = self.preview("crm_create_passports", arguments)
        self.assertNotIn("error", preview, preview)
        self.assertEqual(
            preview["changes"]["deactivated_records"][0]["id"], str(old.pk)
        )
        old.refresh_from_db()
        self.assertTrue(old.is_current)
        result = self.apply(preview, arguments)
        self.assertNotIn("error", result, result)
        old.refresh_from_db()
        self.assertFalse(old.is_current)

    def test_deal_deletion_can_be_replayed_without_a_second_delete(self):
        arguments = {"id": str(self.deal.pk)}
        preview = self.preview("crm_delete_deals", arguments)
        self.assertNotIn("error", preview, preview)
        key = uuid.uuid4()
        result = self.apply(preview, arguments, key=key)
        self.assertNotIn("error", result, result)
        replay = self.apply(preview, arguments, key=key)
        self.assertNotIn("error", replay, replay)
        self.assertTrue(replay["replayed"])

    def test_raw_note_file_ids_cannot_bypass_safe_file_tools(self):
        before = Note.objects.count()
        result = self.write(
            "crm_create_notes",
            {
                "data": {
                    "deal": str(self.deal.pk),
                    "body": "Attempt",
                    "attachments": [{"id": "foreign-drive-id", "name": "foreign.pdf"}],
                }
            },
        )
        self.assertEqual(result["error"]["code"], "invalid_arguments")
        self.assertEqual(Note.objects.count(), before)
