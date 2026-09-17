from concurrent.futures import ThreadPoolExecutor
from datetime import date
from threading import Barrier
from unittest import skipUnless
from unittest.mock import patch

from apps.clients.models import Client
from apps.common.tests.auth_utils import AuthenticatedAPITestCase
from apps.deals.models import Deal
from apps.users.models import AuditLog
from django.contrib.auth.models import User
from django.db import IntegrityError, close_old_connections, connection
from django.test import TransactionTestCase
from django.utils import timezone

from .models import FinancialRecord, Payment, Statement


class StatementRestoreTests(AuthenticatedAPITestCase):
    def setUp(self):
        super().setUp()
        self.owner = User.objects.create_user(username="owner")
        self.other = User.objects.create_user(username="other")
        self.admin = User.objects.create_user(username="admin", is_staff=True)
        self.client_obj = Client.objects.create(name="Клиент")
        self.deal = Deal.objects.create(
            title="Сделка", client=self.client_obj, seller=self.owner
        )
        self.payment = Payment.objects.create(deal=self.deal, amount="1000")
        self.statement = Statement.objects.create(
            name="Ведомость", statement_type="income", created_by=self.owner
        )
        self.record = FinancialRecord.objects.create(
            payment=self.payment,
            amount=50,
            description="Доход",
            statement=self.statement,
        )
        self.url = f"/api/v1/finance_statements/{self.statement.pk}/"
        self.authenticate(self.owner)

    def restore(self, data=None):
        return self.api_client.post(self.url + "restore/", data or {}, format="json")

    def test_snapshot_and_full_restore_preserve_current_values_and_audit(self):
        self.assertEqual(self.api_client.delete(self.url).status_code, 204)
        self.statement.refresh_from_db()
        entry = self.statement.deletion_snapshot["records"][0]
        self.assertEqual(entry["client"], "Клиент")
        self.assertEqual(entry["amount"], "50.00")
        FinancialRecord.objects.filter(pk=self.record.pk).update(
            amount="75", description="Изменено"
        )
        response = self.restore()
        self.assertEqual(response.status_code, 200, response.data)
        self.assertEqual(response.data["restored_record_ids"], [str(self.record.pk)])
        self.assertFalse(response.data["snapshot_missing"])
        self.assertEqual(response.data["statement"]["records_count"], 1)
        self.assertNotIn("deletion_snapshot", response.data["statement"])
        self.record.refresh_from_db()
        self.assertEqual(self.record.statement_id, self.statement.pk)
        self.assertEqual(self.record.amount, 75)
        self.assertEqual(self.record.description, "Изменено")
        self.assertIsNone(self.record.date)
        self.assertTrue(
            AuditLog.objects.filter(
                object_id=str(self.statement.pk), action="restore"
            ).exists()
        )

    def test_visibility_lookup_and_operations(self):
        self.statement.delete()
        response = self.api_client.get("/api/v1/finance_statements/")
        self.assertEqual(response.data["count"], 0)
        response = self.api_client.get(
            "/api/v1/finance_statements/?show_deleted=true&paid=false&page_size=1"
        )
        self.assertEqual(response.data["count"], 1)
        self.assertIsNotNone(response.data["results"][0]["deleted_at"])
        self.assertNotIn("deletion_snapshot", response.data["results"][0])
        self.assertEqual(
            self.api_client.get(
                "/api/v1/finance_statements/lookup/?show_deleted=true"
            ).data["results"],
            [],
        )
        self.assertEqual(
            self.api_client.patch(
                self.url + "?show_deleted=true", {"name": "Other"}
            ).status_code,
            404,
        )
        for action in (
            "mark-paid",
            "reopen",
            "export-xlsx",
            "attach-records",
            "remove-records",
            "apply-amount",
        ):
            with self.subTest(action=action):
                response = self.api_client.post(
                    self.url + action + "/?show_deleted=true",
                    {"record_ids": [str(self.record.pk)]},
                    format="json",
                )
                self.assertIn(response.status_code, (403, 404))
        self.authenticate(self.other)
        self.assertEqual(
            self.api_client.get("/api/v1/finance_statements/?show_deleted=true").data[
                "count"
            ],
            0,
        )
        self.assertEqual(self.restore().status_code, 403)
        self.authenticate(self.admin)
        self.assertEqual(
            self.api_client.get("/api/v1/finance_statements/?show_deleted=true").data[
                "count"
            ],
            1,
        )
        self.assertEqual(self.restore().status_code, 200)

    def test_legacy_missing_snapshot_and_repeated_restore(self):
        Statement.objects.filter(pk=self.statement.pk).update(deleted_at=timezone.now())
        response = self.restore()
        self.assertTrue(response.data["snapshot_missing"])
        self.assertEqual(response.data["restored_count"], 0)
        self.assertEqual(self.restore().status_code, 400)

    def test_name_conflict_and_rename(self):
        self.statement.delete()
        Statement.objects.create(
            name="  ВЕДОМОСТЬ  ", statement_type="income", created_by=self.owner
        )
        response = self.restore()
        self.assertEqual(response.status_code, 400)
        self.assertIn("name", response.data)
        self.statement.refresh_from_db()
        self.assertIsNotNone(self.statement.deleted_at)
        response = self.restore({"name": "Новое название"})
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["statement"]["name"], "Новое название")

    def test_partial_restore_and_all_skip_reasons(self):
        records = {
            reason: FinancialRecord.objects.create(
                payment=self.payment, amount=10, statement=self.statement
            )
            for reason in (
                "missing",
                "forbidden",
                "deleted",
                "related_deleted",
                "already_assigned",
                "posted",
                "wrong_type",
            )
        }
        self.statement.delete()
        missing_id = records["missing"].pk
        records["missing"].hard_delete()
        records["missing"].pk = missing_id
        private_deal = Deal.objects.create(
            title="Private", client=self.client_obj, seller=self.other
        )
        private_payment = Payment.objects.create(deal=private_deal, amount=10)
        FinancialRecord.objects.filter(pk=records["forbidden"].pk).update(
            payment=private_payment
        )
        records["deleted"].delete()
        dead_payment = Payment.objects.create(
            deal=self.deal, amount=10, deleted_at=timezone.now()
        )
        FinancialRecord.objects.filter(pk=records["related_deleted"].pk).update(
            payment=dead_payment
        )
        other_statement = Statement.objects.create(
            name="Другая", statement_type="income"
        )
        FinancialRecord.objects.filter(pk=records["already_assigned"].pk).update(
            statement=other_statement
        )
        FinancialRecord.objects.filter(pk=records["posted"].pk).update(
            date=date(2026, 9, 1)
        )
        FinancialRecord.objects.filter(pk=records["wrong_type"].pk).update(
            record_type="expense", amount=-10
        )
        response = self.restore()
        self.assertEqual(response.status_code, 200, response.data)
        self.assertEqual(response.data["restored_count"], 1)
        skipped = {entry["reason"]: entry for entry in response.data["skipped_records"]}
        self.assertEqual(set(skipped), set(records))
        for reason, record in records.items():
            self.assertEqual(skipped[reason]["id"], str(record.pk))
            self.assertTrue(skipped[reason]["message"])
            if reason in ("missing", "forbidden"):
                self.assertNotIn("client", skipped[reason])
            else:
                self.assertEqual(skipped[reason]["client"], "Клиент")
        records["already_assigned"].refresh_from_db()
        self.assertEqual(records["already_assigned"].statement_id, other_statement.pk)
        records["posted"].refresh_from_db()
        self.assertEqual(records["posted"].date, date(2026, 9, 1))

    def test_next_deletion_overwrites_snapshot(self):
        self.statement.delete()
        self.restore()
        self.record.refresh_from_db()
        self.record.statement = None
        self.record.save()
        replacement = FinancialRecord.objects.create(
            payment=self.payment, amount=20, statement=self.statement
        )
        self.statement.delete()
        self.statement.refresh_from_db()
        self.assertEqual(
            [entry["id"] for entry in self.statement.deletion_snapshot["records"]],
            [str(replacement.pk)],
        )
        self.assertEqual(
            self.restore().data["restored_record_ids"], [str(replacement.pk)]
        )

    def test_delete_rolls_back_detachment_when_save_fails(self):
        with patch.object(Statement, "save", side_effect=IntegrityError("failure")):
            with self.assertRaises(IntegrityError):
                self.statement.delete()
        self.record.refresh_from_db()
        self.statement.refresh_from_db()
        self.assertEqual(self.record.statement_id, self.statement.pk)
        self.assertIsNone(self.statement.deleted_at)

    def test_serializer_does_not_overwrite_record_attached_after_validation(self):
        from .serializers import StatementSerializer

        self.statement.delete()
        serializer = StatementSerializer(
            data={
                "name": "Concurrent",
                "statement_type": "income",
                "record_ids": [str(self.record.pk)],
            }
        )
        self.assertTrue(serializer.is_valid(), serializer.errors)
        self.restore()
        from rest_framework.exceptions import ValidationError

        with self.assertRaises(ValidationError):
            serializer.save(created_by=self.owner)
        self.record.refresh_from_db()
        self.assertEqual(self.record.statement_id, self.statement.pk)
        self.assertFalse(Statement.objects.filter(name="Concurrent").exists())

    def test_financial_record_update_does_not_erase_restored_statement(self):
        from .serializers import FinancialRecordSerializer

        self.statement.delete()
        self.record.refresh_from_db()
        serializer = FinancialRecordSerializer(
            self.record, data={"description": "Обновлённое описание"}, partial=True
        )
        self.assertTrue(serializer.is_valid(), serializer.errors)
        self.restore()
        serializer.save()
        self.record.refresh_from_db()
        self.assertEqual(self.record.statement_id, self.statement.pk)
        self.assertEqual(self.record.description, "Обновлённое описание")


@skipUnless(connection.vendor == "postgresql", "Requires PostgreSQL row locking")
class StatementRestoreConcurrencyTests(TransactionTestCase):
    def test_restore_and_attach_cannot_both_claim_record(self):
        from rest_framework.test import APIClient

        owner = User.objects.create_user(username="concurrent-owner")
        client = Client.objects.create(name="Concurrent client")
        deal = Deal.objects.create(title="Concurrent deal", client=client, seller=owner)
        payment = Payment.objects.create(deal=deal, amount=100)
        deleted = Statement.objects.create(name="Restore", statement_type="income", created_by=owner)
        other = Statement.objects.create(name="Attach", statement_type="income", created_by=owner)
        record = FinancialRecord.objects.create(payment=payment, amount=10, statement=deleted)
        deleted.delete()
        barrier = Barrier(2)

        def perform(action):
            close_old_connections()
            try:
                api = APIClient()
                api.force_authenticate(owner)
                barrier.wait(timeout=10)
                pk = deleted.pk if action == "restore" else other.pk
                response = api.post(
                    f"/api/v1/finance_statements/{pk}/{action}/",
                    {} if action == "restore" else {"record_ids": [str(record.pk)]},
                    format="json",
                )
                return response.status_code, response.data
            finally:
                close_old_connections()

        with ThreadPoolExecutor(max_workers=2) as executor:
            restore_result, attach_result = list(executor.map(perform, ["restore", "attach-records"]))
        self.assertEqual(restore_result[0], 200)
        record.refresh_from_db()
        if attach_result[0] == 200:
            self.assertEqual(record.statement_id, other.pk)
            self.assertEqual(restore_result[1]["restored_count"], 0)
            self.assertEqual(restore_result[1]["skipped_records"][0]["reason"], "already_assigned")
        else:
            self.assertEqual(attach_result[0], 400)
            self.assertEqual(record.statement_id, deleted.pk)
            self.assertEqual(restore_result[1]["restored_count"], 1)
