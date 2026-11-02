import copy
import uuid
from datetime import date
from decimal import Decimal
from unittest.mock import patch

from apps.clients.models import Client
from apps.deals.models import InsuranceCompany, InsuranceType, SalesChannel
from apps.finances.models import FinancialRecord, Payment
from apps.policies.models import Policy
from apps.policies.serializers import PolicyDraftSerializer
from apps.policies.services.finance import apply_policy_draft
from apps.users.models import AuditLog

from ..models import McpMutation
from .test_tools import McpFixture


class PolicyImportFinanceTests(McpFixture):
    def setUp(self):
        super().setUp()
        self.company = InsuranceCompany.objects.create(name="Страховая для импорта")
        self.insurance_type = InsuranceType.objects.create(name="КАСКО для импорта")
        self.channel = SalesChannel.objects.create(name="Канал продаж для импорта")
        self.user.first_name = "Иван"
        self.user.last_name = "Исполнитель"
        self.user.save()

    def payload(self, **overrides):
        return {
            "deal": str(self.deal.pk),
            "client": str(self.customer.pk),
            "number": "MCP-POLICY-IMPORT",
            "insurance_company": str(self.company.pk),
            "insurance_type": str(self.insurance_type.pk),
            "is_vehicle": False,
            "start_date": "2026-01-01",
            "end_date": "2026-12-31",
            "payments": [{"amount": "1000.00"}],
            **overrides,
        }

    def preview(self, payload, tool="crm_create_policy_draft", policy=None):
        arguments = {"data": payload}
        if policy is not None:
            arguments["id"] = str(policy.pk)
        result = self.call(
            "crm_preview_change", {"tool_name": tool, "arguments": arguments}
        )
        self.assertNotIn("error", result, result)
        self.assertFalse(result["committed"])
        return result, arguments

    def apply(self, preview, arguments, request_id=None):
        result = self.call(
            "crm_apply_change",
            {
                "tool_name": preview["tool_name"],
                "arguments": arguments,
                "preview_token": preview["preview_token"],
                "confirmed": True,
                "request_id": str(request_id or uuid.uuid4()),
            },
        )
        self.assertNotIn("error", result, result)
        self.assertEqual(result["status"], 200)
        return result

    def requested_payments(self, preview):
        return preview["changes"]["requested"]["payments"]

    def assert_placeholder(self, record, note):
        self.assertEqual(Decimal(record["amount"]), Decimal("1.00"))
        self.assertIsNone(record["date"])
        self.assertEqual(record["description"], "")
        self.assertEqual(record["source"], "")
        self.assertEqual(record["note"], note)

    def test_preview_contains_each_default_income_with_or_without_channel(self):
        for channel, expected_note in (
            (None, "Комиссионное вознаграждение"),
            (
                self.channel,
                "Комиссионное вознаграждение от Канал продаж для импорта",
            ),
        ):
            with self.subTest(channel=channel):
                payload = self.payload(
                    payments=[
                        {"amount": "1000.00"},
                        {"amount": "2000.00", "incomes": [], "expenses": []},
                    ]
                )
                if channel is not None:
                    payload["sales_channel"] = str(channel.pk)
                original = copy.deepcopy(payload)
                before = (
                    Policy.objects.count(),
                    Payment.objects.count(),
                    FinancialRecord.objects.count(),
                    McpMutation.objects.count(),
                    AuditLog.objects.count(),
                )
                with patch("apps.policies.signals.ensure_policy_folder") as drive:
                    preview, _ = self.preview(payload)
                drive.assert_not_called()
                self.assertEqual(payload, original)
                payments = self.requested_payments(preview)
                self.assertEqual(len(payments), 2)
                for payment in payments:
                    self.assertEqual(len(payment["incomes"]), 1)
                    self.assert_placeholder(payment["incomes"][0], expected_note)
                self.assertEqual(
                    before,
                    (
                        Policy.objects.count(),
                        Payment.objects.count(),
                        FinancialRecord.objects.count(),
                        McpMutation.objects.count(),
                        AuditLog.objects.count(),
                    ),
                )

    def test_counterparty_and_executor_defaults_follow_explicit_precedence(self):
        referral = Client.objects.create(name="Рекомендатель", created_by=self.user)
        cases = (
            ("Явный контрагент", True, True, True, "Явный контрагент"),
            ("Явный контрагент", False, True, False, "Явный контрагент"),
            ("   ", True, True, True, self.customer.name),
            (None, True, False, False, self.customer.name),
            (None, False, True, True, referral.name),
            ("", False, True, False, referral.name),
            (None, False, False, True, None),
            (None, False, False, False, None),
        )
        for explicit, is_counterparty, has_referral, has_executor, expected in cases:
            with self.subTest(
                explicit=explicit,
                counterparty=is_counterparty,
                referral=has_referral,
                executor=has_executor,
            ):
                self.customer.is_counterparty = is_counterparty
                self.customer.referred_by = referral if has_referral else None
                self.customer.save()
                self.deal.executor = self.user if has_executor else None
                self.deal.save()
                payload = self.payload()
                if explicit is not None:
                    payload["counterparty"] = explicit
                preview, _ = self.preview(payload)
                expenses = self.requested_payments(preview)[0]["expenses"]
                notes = []
                if expected is not None:
                    notes.append(f"Расход контрагенту {expected}")
                if has_executor:
                    notes.append("Расход исполнителю Иван Исполнитель")
                self.assertEqual([record["note"] for record in expenses], notes)
                for record, note in zip(expenses, notes):
                    self.assert_placeholder(record, note)

    def test_deleted_referral_is_ignored_and_executor_uses_username_fallback(self):
        referral = Client.objects.create(name="Удалённый рекомендатель")
        self.customer.referred_by = referral
        self.customer.save()
        referral.delete()
        self.user.first_name = ""
        self.user.last_name = ""
        self.user.save()
        preview, _ = self.preview(self.payload())
        expenses = self.requested_payments(preview)[0]["expenses"]
        self.assertEqual(
            [record["note"] for record in expenses],
            [f"Расход исполнителю {self.user.username}"],
        )
        self.deal.executor = None
        self.deal.save()
        preview, _ = self.preview(self.payload())
        self.assertEqual(self.requested_payments(preview)[0]["expenses"], [])

    def test_defaults_use_deal_client_even_when_policy_client_differs(self):
        referral = Client.objects.create(name="Рекомендатель сделки")
        policy_client = Client.objects.create(
            name="Другой страхователь", is_counterparty=True, created_by=self.user
        )
        self.customer.referred_by = referral
        self.customer.save()
        preview, _ = self.preview(self.payload(client=str(policy_client.pk)))
        self.assertEqual(
            [
                record["note"]
                for record in self.requested_payments(preview)[0]["expenses"]
            ],
            [
                "Расход контрагенту Рекомендатель сделки",
                "Расход исполнителю Иван Исполнитель",
            ],
        )

    def test_explicit_records_and_zero_amounts_are_preserved_without_appending(self):
        income = {
            "amount": "0.00",
            "date": None,
            "description": "Явный доход",
            "source": "Источник",
            "note": "Моё примечание дохода",
        }
        expense = {
            "amount": "0.00",
            "date": "2026-03-04",
            "description": "Явный расход",
            "source": "Назначение",
            "note": "Моё примечание расхода",
        }
        payload = self.payload(
            counterparty="Контрагент с дефолтами",
            sales_channel=str(self.channel.pk),
            payments=[
                {
                    "amount": "1000.00",
                    "incomes": [copy.deepcopy(income)],
                    "expenses": [copy.deepcopy(expense)],
                }
            ],
        )
        preview, arguments = self.preview(payload)
        payment = self.requested_payments(preview)[0]
        self.assertEqual(payment["incomes"], [income])
        self.assertEqual(payment["expenses"], [expense])
        result = self.apply(preview, arguments)
        records = FinancialRecord.objects.filter(
            payment__policy_id=result["data"]["policy"]["id"]
        )
        self.assertEqual(records.count(), 2)
        self.assertEqual(
            set(records.values_list("amount", flat=True)), {Decimal("0.00")}
        )
        self.assertEqual(
            set(records.values_list("note", flat=True)),
            {income["note"], expense["note"]},
        )

    def test_income_and_expense_defaults_are_applied_independently(self):
        explicit = {
            "amount": "0.00",
            "date": None,
            "description": "",
            "source": "",
            "note": "Явная нулевая запись",
        }
        for preserved, generated in (("incomes", "expenses"), ("expenses", "incomes")):
            with self.subTest(preserved=preserved):
                payload = self.payload(
                    counterparty="Контрагент",
                    payments=[
                        {
                            "amount": "1000.00",
                            preserved: [copy.deepcopy(explicit)],
                            generated: [],
                        }
                    ],
                )
                preview, _ = self.preview(payload)
                payment = self.requested_payments(preview)[0]
                self.assertEqual(payment[preserved], [explicit])
                self.assertEqual(
                    len(payment[generated]), 2 if generated == "expenses" else 1
                )

    def test_create_draft_cannot_bypass_financial_preview(self):
        result = self.write("crm_create_policy_draft", {"data": self.payload()})
        self.assertEqual(result["error"]["code"], "preview_required")
        self.assertFalse(Policy.objects.exists())
        self.assertFalse(Payment.objects.exists())
        self.assertFalse(FinancialRecord.objects.exists())

    def test_create_without_source_files_completes_without_drive_calls(self):
        with patch("apps.policies.signals.ensure_policy_folder") as drive:
            preview, arguments = self.preview(self.payload())
            with self.captureOnCommitCallbacks(execute=True):
                result = self.apply(preview, arguments)
        drive.assert_not_called()
        self.assertEqual(
            result["data"]["file_transfer"], {"status": "completed", "files": []}
        )

    def test_payment_actual_date_does_not_mark_generated_income_or_expenses_paid(self):
        payload = self.payload(
            counterparty="Контрагент",
            payments=[
                {
                    "amount": "1000.00",
                    "scheduled_date": "2026-02-01",
                    "actual_date": "2026-02-02",
                    "description": "Описание премии не переносится",
                }
            ],
        )
        preview, arguments = self.preview(payload)
        prepared = self.requested_payments(preview)[0]
        self.assertEqual(prepared["actual_date"], "2026-02-02")
        for record in prepared["incomes"] + prepared["expenses"]:
            self.assertIsNone(record["date"])
            self.assertEqual(record["description"], "")
        result = self.apply(preview, arguments)
        payment = Payment.objects.get(policy_id=result["data"]["policy"]["id"])
        self.assertEqual(payment.actual_date, date(2026, 2, 2))
        self.assertEqual(payment.financial_records.count(), 3)
        self.assertFalse(payment.financial_records.exclude(date=None).exists())
        self.assertEqual(
            set(payment.financial_records.values_list("record_type", "amount")),
            {("income", Decimal("1.00")), ("expense", Decimal("-1.00"))},
        )

    def test_default_finances_are_create_only_and_update_can_clear_arrays(self):
        payload = self.payload()
        preview, arguments = self.preview(payload)
        created = self.apply(preview, arguments)
        policy = Policy.objects.get(pk=created["data"]["policy"]["id"])
        payment = Payment.objects.get(policy=policy)
        self.assertTrue(payment.financial_records.exists())
        update = self.payload(
            payments=[
                {
                    "id": str(payment.pk),
                    "amount": "1000.00",
                    "incomes": [],
                    "expenses": [],
                }
            ]
        )
        preview, arguments = self.preview(update, "crm_update_policy_draft", policy)
        prepared = self.requested_payments(preview)[0]
        self.assertEqual(prepared["incomes"], [])
        self.assertEqual(prepared["expenses"], [])
        self.apply(preview, arguments)
        self.assertFalse(FinancialRecord.objects.filter(payment=payment).exists())

    def test_shared_policy_draft_service_does_not_autofill_mcp_defaults(self):
        serializer = PolicyDraftSerializer(data=self.payload())
        serializer.is_valid(raise_exception=True)
        policy, payments = apply_policy_draft(
            user=self.user, data=serializer.validated_data.copy()
        )
        self.assertEqual(len(payments), 1)
        self.assertEqual(Payment.objects.filter(policy=policy).count(), 1)
        self.assertFalse(
            FinancialRecord.objects.filter(payment__policy=policy).exists()
        )

    def test_retry_reuses_the_created_policy_and_all_financial_records(self):
        payload = self.payload(
            counterparty="Контрагент",
            payments=[{"amount": "1000.00"}, {"amount": "2000.00"}],
        )
        preview, arguments = self.preview(payload)
        request_id = uuid.uuid4()
        first = self.apply(preview, arguments, request_id)
        counts = (
            Policy.objects.count(),
            Payment.objects.count(),
            FinancialRecord.objects.count(),
        )
        self.assertEqual(counts, (1, 2, 6))
        again = self.apply(preview, arguments, request_id)
        self.assertTrue(again["replayed"])
        self.assertEqual(first["data"]["policy"]["id"], again["data"]["policy"]["id"])
        self.assertEqual(
            counts,
            (
                Policy.objects.count(),
                Payment.objects.count(),
                FinancialRecord.objects.count(),
            ),
        )

    def test_policy_payments_and_records_have_the_actual_audit_actor(self):
        preview, arguments = self.preview(self.payload(counterparty="Контрагент"))
        result = self.apply(preview, arguments)
        policy = Policy.objects.get(pk=result["data"]["policy"]["id"])
        payment = Payment.objects.get(policy=policy)
        objects = [("policy", policy.pk), ("payment", payment.pk)]
        objects += [
            ("financial_record", record.pk)
            for record in payment.financial_records.all()
        ]
        for object_type, object_id in objects:
            with self.subTest(object_type=object_type, object_id=object_id):
                logs = AuditLog.objects.filter(
                    object_type=object_type, object_id=str(object_id)
                )
                self.assertTrue(logs.exists())
                self.assertTrue(
                    all(
                        log.actor_id == self.user.pk and "[ChatGPT]" in log.description
                        for log in logs
                    )
                )

    def test_changed_referral_after_preview_requires_a_new_preview(self):
        referral = Client.objects.create(name="Первоначальный рекомендатель")
        self.customer.referred_by = referral
        self.customer.save()
        payload = self.payload()
        preview, arguments = self.preview(payload)
        referral.name = "Изменённый рекомендатель"
        referral.save()
        result = self.call(
            "crm_apply_change",
            {
                "tool_name": preview["tool_name"],
                "arguments": arguments,
                "preview_token": preview["preview_token"],
                "confirmed": True,
                "request_id": str(uuid.uuid4()),
            },
        )
        self.assertEqual(result["error"]["code"], "sources_changed", result)
        self.assertFalse(Policy.objects.exists())
        self.assertFalse(Payment.objects.exists())
        self.assertFalse(FinancialRecord.objects.exists())
