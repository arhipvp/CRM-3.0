import copy
import json
import threading
import uuid
from concurrent.futures import ThreadPoolExecutor
from unittest import skipUnless
from unittest.mock import patch

from apps.common.drive import DriveOperationError
from apps.deals.models import InsuranceCompany, InsuranceType
from apps.finances.models import FinancialRecord, Payment
from apps.notes.models import Note
from apps.policies.models import Policy
from django.db import connection, connections
from django.test import TransactionTestCase

from ..files import _drive_file_id
from ..models import McpAccessGrant, McpMutation
from ..mutations import CONTINUATION_KEY
from ..tools import get_registry
from .test_tools import McpFixture


class PolicyImportFilesMixin:
    def setUp(self):
        super().setUp()
        self.company = InsuranceCompany.objects.create(name="Страховщик")
        self.kind = InsuranceType.objects.create(name="Дом")
        self.deal.drive_folder_id = "deal-root"
        self.deal.save()
        self.metadata = {}
        self.add_file("source-a")
        self.moves = []
        self.fail_before = self.fail_after = None
        self.lists = self.mock("list_drive_folder_contents", self.list_folder)
        self.mock(
            "get_drive_file_metadata", lambda key: copy.deepcopy(self.metadata[key])
        )
        self.ensure = self.mock("ensure_policy_folder", self.ensure_folder)
        self.move = self.mock("move_drive_item_between_folders", self.move_file)
        self.download = self.mock("download_drive_file", AssertionError("No download"))
        self.upload = self.mock("upload_file_to_drive", AssertionError("No copy"))

    def mock(self, name, effect):
        patcher = patch(
            "apps.mcp_connector.policy_import.drive." + name, side_effect=effect
        )
        mocked = patcher.start()
        self.addCleanup(patcher.stop)
        return mocked

    def add_file(self, key, parent="deal-root", *, folder=False, name=None):
        self.metadata[key] = {
            "id": key,
            "name": name or key + ".pdf",
            "size": None if folder else 120,
            "mime_type": (
                "application/vnd.google-apps.folder" if folder else "application/pdf"
            ),
            "is_folder": folder,
            "parents": [parent],
            "trashed": False,
            "modified_at": "2026-10-25T10:00:00Z",
            "version": "1",
            "checksum": None if folder else "checksum-" + key,
        }

    def list_folder(self, key):
        return [
            dict(copy.deepcopy(item), parent_id=key)
            for item in self.metadata.values()
            if item["parents"] == [key]
        ]

    def ensure_folder(self, policy):
        # This checkpoint must exist before the very first external write.
        record = McpMutation.objects.get(tool_name="crm_create_policy_draft")
        self.assertEqual(record.status, "files_pending")
        self.assertEqual(record.result[CONTINUATION_KEY]["policy_id"], str(policy.pk))
        self.assertTrue(Payment.objects.filter(policy=policy).exists())
        self.assertTrue(FinancialRecord.objects.filter(payment__policy=policy).exists())
        self.add_file("policy-root", folder=True, name=policy.number)
        policy.drive_folder_id = "policy-root"
        Policy.objects.filter(pk=policy.pk).update(drive_folder_id="policy-root")
        return "policy-root"

    def move_file(self, key, source, target, *, expected_metadata=None):
        self.moves.append(key)
        if key == self.fail_before:
            raise DriveOperationError("Unavailable")
        self.assertEqual(self.metadata[key]["parents"], [source])
        self.metadata[key]["parents"] = [target]
        self.metadata[key]["version"] = "2"
        self.metadata[key]["modified_at"] = "2026-10-25T11:00:00Z"
        if key == self.fail_after:
            raise DriveOperationError("Response lost after move")

    def arguments(self, files=None):
        return {
            "data": {
                "deal": str(self.deal.pk),
                "number": "IMPORT-FILE",
                "insurance_company": str(self.company.pk),
                "insurance_type": str(self.kind.pk),
                "source_file_ids": (
                    files if files is not None else [_drive_file_id("source-a")]
                ),
                "payments": [{"amount": "51500.00", "actual_date": "2026-10-25"}],
            }
        }

    def preview(self, args):
        return self.call(
            "crm_preview_change",
            {
                "tool_name": "crm_create_policy_draft",
                "arguments": args,
            },
        )

    def apply(self, preview, args, key):
        return self.call(
            "crm_apply_change",
            {
                "tool_name": "crm_create_policy_draft",
                "arguments": args,
                "preview_token": preview["preview_token"],
                "confirmed": True,
                "request_id": str(key),
            },
        )

    def note(self):
        return Note.objects.create(
            deal=self.deal,
            author=self.user,
            body="Документы",
            attachments=[
                {"id": "source-a", "name": "Полис.pdf"},
                {"id": "source-b", "name": "Условия.pdf"},
            ],
        )


class PolicyImportFileTests(PolicyImportFilesMixin, McpFixture):
    def test_schema_opens_sources_only_for_specialized_create(self):
        registry = get_registry()
        for name in (
            "crm_create_policies",
            "crm_update_policies",
            "crm_update_policy_draft",
        ):
            self.assertNotIn(
                "source_file_ids",
                registry[name].input_schema["properties"]["data"]["properties"],
            )
        self.assertIn(
            "source_file_ids",
            registry["crm_create_policy_draft"].input_schema["properties"]["data"][
                "properties"
            ],
        )

    def test_preview_is_pure_and_displays_defaults_and_move(self):
        args = self.arguments()
        before = (
            Policy.objects.count(),
            Payment.objects.count(),
            McpMutation.objects.count(),
        )
        result = self.preview(args)
        self.assertNotIn("error", result, result)
        self.assertEqual(
            result["changes"]["requested"]["payments"][0]["incomes"][0]["amount"],
            "1.00",
        )
        self.assertEqual(
            result["changes"]["file_moves"][0]["file_id"], _drive_file_id("source-a")
        )
        self.assertEqual(
            before,
            (
                Policy.objects.count(),
                Payment.objects.count(),
                McpMutation.objects.count(),
            ),
        )
        self.ensure.assert_not_called()
        self.move.assert_not_called()

    def test_moves_same_original_and_detaches_note_after_success(self):
        note = self.note()
        args = self.arguments(["source-a", _drive_file_id("source-a")])
        result = self.apply(self.preview(args), args, uuid.uuid4())
        self.assertNotIn("error", result, result)
        self.assertEqual(result["data"]["file_transfer"]["status"], "completed")
        self.assertNotIn(CONTINUATION_KEY, result)
        self.assertNotIn("expected", result["data"]["file_transfer"]["files"][0])
        self.assertEqual(self.moves, ["source-a"])
        self.assertEqual(self.metadata["source-a"]["parents"], ["policy-root"])
        note.refresh_from_db()
        self.assertEqual([item["id"] for item in note.attachments], ["source-b"])
        self.download.assert_not_called()
        self.upload.assert_not_called()

    def test_partial_failure_keeps_links_and_exact_retry_only_moves_remainder(self):
        self.add_file("source-b")
        note = self.note()
        self.fail_before = "source-b"
        args, key = self.arguments(["source-a", "source-b"]), uuid.uuid4()
        preview = self.preview(args)
        first = self.apply(preview, args, key)
        self.assertEqual(
            first["data"]["file_transfer"]["status"], "files_pending", first
        )
        self.assertEqual(
            [item["status"] for item in first["data"]["file_transfer"]["files"]],
            ["moved", "pending"],
        )
        note.refresh_from_db()
        self.assertEqual([item["id"] for item in note.attachments], ["source-b"])
        counts = (
            Policy.objects.count(),
            Payment.objects.count(),
            FinancialRecord.objects.count(),
        )
        self.fail_before = None
        second = self.apply(preview, args, key)
        self.assertTrue(second["replayed"])
        self.assertEqual(second["data"]["file_transfer"]["status"], "completed")
        self.assertEqual(
            counts,
            (
                Policy.objects.count(),
                Payment.objects.count(),
                FinancialRecord.objects.count(),
            ),
        )
        self.assertEqual(self.moves, ["source-a", "source-b", "source-b"])
        note.refresh_from_db()
        self.assertEqual(note.attachments, [])

    def test_lost_drive_response_recovers_same_file_already_at_destination(self):
        note = self.note()
        self.fail_after = "source-a"
        args, key = self.arguments(), uuid.uuid4()
        preview = self.preview(args)
        first = self.apply(preview, args, key)
        self.assertEqual(first["data"]["file_transfer"]["status"], "files_pending")
        note.refresh_from_db()
        self.assertEqual(len(note.attachments), 2)
        self.fail_after = None
        second = self.apply(preview, args, key)
        self.assertEqual(second["data"]["file_transfer"]["status"], "completed")
        self.assertEqual(self.moves, ["source-a"])
        note.refresh_from_db()
        self.assertEqual([item["id"] for item in note.attachments], ["source-b"])

    def test_process_loss_after_crm_commit_can_resume_without_recreating(self):
        args, key = self.arguments(), uuid.uuid4()
        preview = self.preview(args)
        with patch(
            "apps.mcp_connector.mutations._finish",
            side_effect=RuntimeError("Process lost"),
        ):
            with self.assertRaises(RuntimeError):
                self.apply(preview, args, key)
        record = McpMutation.objects.get(request_id=key)
        self.assertEqual(record.status, "files_pending")
        self.assertTrue(
            Policy.objects.filter(
                pk=record.result[CONTINUATION_KEY]["policy_id"]
            ).exists()
        )
        self.ensure.assert_not_called()
        second = self.apply(preview, args, key)
        self.assertEqual(second["data"]["file_transfer"]["status"], "completed")
        self.assertEqual(Policy.objects.count(), 1)
        self.assertEqual(Payment.objects.count(), 1)

    def test_foreign_file_is_rejected_without_external_write(self):
        args = self.arguments(["foreign-file"])
        preview = self.preview(args)
        self.assertEqual(preview["error"]["status"], 403, preview)
        self.ensure.assert_not_called()
        self.assertFalse(Policy.objects.exists())

    def test_trash_and_other_policy_subtrees_are_not_import_sources(self):
        self.add_file("trash", folder=True, name="Корзина")
        self.add_file("trashed-document", parent="trash")
        self.add_file("other-policy", folder=True)
        self.add_file("other-document", parent="other-policy")
        Policy.objects.create(
            number="OTHER",
            deal=self.deal,
            insurance_company=self.company,
            insurance_type=self.kind,
            drive_folder_id="other-policy",
        )
        for key in ("trashed-document", "other-document"):
            with self.subTest(key=key):
                preview = self.preview(self.arguments([key]))
                self.assertEqual(preview["error"]["status"], 403, preview)
        self.assertNotIn("trash", [call.args[0] for call in self.lists.call_args_list])
        self.assertNotIn(
            "other-policy", [call.args[0] for call in self.lists.call_args_list]
        )
        self.ensure.assert_not_called()

    def test_changed_file_invalidates_preview_without_saving_policy(self):
        args = self.arguments()
        preview = self.preview(args)
        self.metadata["source-a"]["checksum"] = "different-content"
        result = self.apply(preview, args, uuid.uuid4())
        self.assertEqual(result["error"]["code"], "sources_changed", result)
        self.assertFalse(Policy.objects.exists())
        self.assertFalse(McpMutation.objects.exists())
        self.ensure.assert_not_called()

    def test_missing_files_scope_and_revoked_access_block_resume(self):
        args, key = self.arguments(), uuid.uuid4()
        preview = self.preview(args)
        self.grant.scopes = ["crm.read", "crm.write", "crm.destructive"]
        self.grant.save()
        result = self.apply(preview, args, key)
        self.assertEqual(result["error"]["status"], 403)
        self.assertFalse(Policy.objects.exists())
        self.grant.scopes = list(self.principal.scopes)
        self.grant.save()
        self.fail_before = "source-a"
        self.assertEqual(
            self.apply(preview, args, key)["data"]["file_transfer"]["status"],
            "files_pending",
        )
        self.deal.seller = self.other
        self.deal.executor = self.other
        self.deal.save()
        before = len(self.moves)
        result = self.apply(preview, args, key)
        self.assertIn(result["error"]["status"], (403, 404), result)
        self.assertEqual(len(self.moves), before)

    def test_pending_retry_stops_if_remaining_file_was_reparented(self):
        self.add_file("source-b")
        self.fail_before = "source-b"
        args, key = self.arguments(["source-a", "source-b"]), uuid.uuid4()
        preview = self.preview(args)
        self.apply(preview, args, key)
        self.metadata["source-b"]["parents"] = ["foreign-folder"]
        before = len(self.moves)
        result = self.apply(preview, args, key)
        self.assertEqual(
            result["data"]["file_transfer"]["error"]["code"], "sources_changed"
        )
        self.assertEqual(len(self.moves), before)

    def test_reused_key_with_changed_body_is_rejected(self):
        args, key = self.arguments(), uuid.uuid4()
        preview = self.preview(args)
        self.apply(preview, args, key)
        changed = copy.deepcopy(args)
        changed["data"]["number"] = "NEW-NUMBER"
        result = self.apply(preview, changed, key)
        self.assertEqual(result["error"]["code"], "idempotency_conflict", result)

    def test_sources_without_content_checksum_are_rejected(self):
        self.metadata["source-a"]["checksum"] = None
        result = self.preview(self.arguments())
        self.assertEqual(result["error"]["status"], 400, result)
        self.ensure.assert_not_called()

    def test_new_client_signal_does_not_run_drive_before_checkpoint(self):
        args = self.arguments()
        args["data"]["client_name"] = "Новый страхователь"
        with patch("apps.clients.signals.ensure_client_folder") as client_folder, patch(
            "apps.policies.signals.ensure_policy_folder"
        ) as policy_folder:
            result = self.apply(self.preview(args), args, uuid.uuid4())
        self.assertNotIn("error", result, result)
        client_folder.assert_not_called()
        policy_folder.assert_not_called()

    def test_resume_rechecks_policy_relation_after_taking_the_lock(self):
        from ..policy_import import _lock

        args, key = self.arguments(), uuid.uuid4()
        preview = self.preview(args)
        self.fail_before = "source-a"
        self.apply(preview, args, key)
        before = len(self.moves)

        def moved_before_lock(obj):
            if isinstance(obj, Policy):
                Policy.objects.filter(pk=obj.pk).update(deal=self.foreign)
            return _lock(obj)

        with patch(
            "apps.mcp_connector.policy_import._lock", side_effect=moved_before_lock
        ):
            result = self.apply(preview, args, key)
        self.assertEqual(result["error"]["code"], "sources_changed", result)
        self.assertEqual(len(self.moves), before)

    def test_legacy_completed_import_replay_does_not_initialize_finances_or_files(self):
        from ..bridge import digest

        args, key = self.arguments([]), uuid.uuid4()
        args["data"].pop("source_file_ids")
        policy = Policy.objects.create(
            number=args["data"]["number"],
            deal=self.deal,
            insurance_company=self.company,
            insurance_type=self.kind,
        )
        payment = Payment.objects.create(
            policy=policy, deal=self.deal, amount="51500.00"
        )
        saved = {
            "status": 200,
            "data": {
                "policy": {
                    "id": str(policy.pk),
                    "number": policy.number,
                    "deal": str(self.deal.pk),
                },
                "payments": [{"id": str(payment.pk), "financial_records": []}],
            },
        }
        McpMutation.objects.create(
            user=self.user,
            client_id=self.principal.client_id,
            request_id=key,
            tool_name="crm_create_policy_draft",
            status="completed",
            result=saved,
            body_hash=digest({"tool": "crm_create_policy_draft", "arguments": args}),
        )
        result = self.apply({"preview_token": "legacy-expired"}, args, key)
        self.assertEqual(result, {**saved, "replayed": True})
        self.assertFalse(FinancialRecord.objects.exists())
        self.ensure.assert_not_called()
        self.move.assert_not_called()


class McpTransactionFixture(TransactionTestCase):
    call = McpFixture.call

    def setUp(self):
        from apps.clients.models import Client
        from apps.deals.models import Deal
        from django.contrib.auth import get_user_model

        from ..contracts import SCOPES, Principal

        super().setUp()
        for target in (
            "apps.clients.signals.ensure_client_folder",
            "apps.deals.signals.ensure_deal_folder",
            "apps.policies.signals.ensure_policy_folder",
        ):
            patcher = patch(target, return_value=None)
            patcher.start()
            self.addCleanup(patcher.stop)
        self.user = get_user_model().objects.create_user(username="import-transaction")
        self.grant = McpAccessGrant.objects.create(user=self.user)
        self.principal = Principal(self.user, "transaction-client", frozenset(SCOPES))
        customer = Client.objects.create(name="Клиент")
        self.deal = Deal.objects.create(
            title="Импорт", client=customer, seller=self.user
        )


class PolicyImportCommitTests(PolicyImportFilesMixin, McpTransactionFixture):
    def assert_destination_committed(self):
        # Another connection must already see the destination when Drive moves.
        record = McpMutation.objects.get(tool_name="crm_create_policy_draft")
        other = connection.copy(alias="import-visibility")
        try:
            with other.cursor() as cursor:
                cursor.execute(
                    "SELECT result FROM mcp_connector_mcpmutation WHERE id = %s",
                    [record.pk],
                )
                saved = cursor.fetchone()[0]
            saved = json.loads(saved) if isinstance(saved, str) else saved
            self.assertEqual(saved[CONTINUATION_KEY]["target_folder_id"], "policy-root")
        finally:
            other.close()

    def test_crash_after_actual_move_preserves_destination_and_recovers(self):
        class ProcessLost(BaseException):
            pass

        original_move = self.move_file

        def crash_after_move(*args, **kwargs):
            self.assert_destination_committed()
            original_move(*args, **kwargs)
            raise ProcessLost()

        args, key = self.arguments(), uuid.uuid4()
        preview = self.preview(args)
        self.move.side_effect = crash_after_move
        with self.assertRaises(ProcessLost):
            self.apply(preview, args, key)
        record = McpMutation.objects.get(request_id=key)
        self.assertEqual(record.status, "files_pending")
        self.assertEqual(
            record.result[CONTINUATION_KEY]["target_folder_id"], "policy-root"
        )
        self.assertEqual(Policy.objects.get().drive_folder_id, "policy-root")
        self.move.side_effect = original_move
        result = self.apply(preview, args, key)
        self.assertEqual(result["data"]["file_transfer"]["status"], "completed")
        self.assertEqual(self.moves, ["source-a"])
        self.assertEqual(Policy.objects.count(), 1)
        self.assertEqual(Payment.objects.count(), 1)

    @skipUnless(connection.vendor == "postgresql", "Requires PostgreSQL row locks")
    def test_concurrent_exact_retries_move_the_original_once(self):
        entered, release, second_started = (
            threading.Event(),
            threading.Event(),
            threading.Event(),
        )
        original_move = self.move_file

        def blocked_move(*args, **kwargs):
            self.assert_destination_committed()
            entered.set()
            if not release.wait(10):
                raise AssertionError("Concurrent continuation timed out")
            original_move(*args, **kwargs)

        args, key = self.arguments(), uuid.uuid4()
        preview = self.preview(args)
        self.move.side_effect = blocked_move

        def call_apply(*, second=False):
            if second:
                second_started.set()
            try:
                return self.apply(preview, args, key)
            finally:
                connections.close_all()

        with ThreadPoolExecutor(max_workers=2) as pool:
            first = pool.submit(call_apply)
            try:
                self.assertTrue(entered.wait(10))
                second = pool.submit(call_apply, second=True)
                self.assertTrue(second_started.wait(5))
            finally:
                release.set()
            results = [first.result(timeout=15), second.result(timeout=15)]
        for result in results:
            self.assertNotIn("error", result, result)
            self.assertEqual(result["data"]["file_transfer"]["status"], "completed")
        self.assertEqual(self.moves, ["source-a"])
        self.assertEqual(Policy.objects.count(), 1)
