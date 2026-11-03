from datetime import date
from decimal import Decimal
from unittest.mock import patch

from apps.clients.models import Client
from apps.common.tests.auth_utils import AuthenticatedAPITestCase
from apps.deals.deadline_service import calculate_deal_deadline
from apps.deals.event_service import _payment_events
from apps.deals.models import Deal, InsuranceCompany, InsuranceType, SalesChannel
from apps.finances.models import FinancialRecord, Payment, Statement
from apps.finances.services.summary import build_finance_summary_payload
from apps.policies.finance_rules import PKV_INCOME_NOTE
from apps.policies.models import Policy
from apps.policies.serializers import PolicyDraftSerializer
from apps.policies.services.import_defaults import prepare_import_finances
from apps.policies.status import with_computed_status_flags
from django.contrib.auth.models import User
from django.db import IntegrityError, transaction


class PolicyFinanceDefaultsTests(AuthenticatedAPITestCase):
    def setUp(self):
        super().setUp()
        self.user = User.objects.create_user(
            username="finance-rule-seller", first_name="Иван"
        )
        self.client_obj = Client.objects.create(name="Клиент финансовых правил")
        self.deal = Deal.objects.create(
            title="Правила финансов",
            client=self.client_obj,
            seller=self.user,
            executor=self.user,
        )
        self.company = InsuranceCompany.objects.create(
            name="Компания финансовых правил"
        )
        self.osago = InsuranceType.objects.create(name="  ОСАГО  ")
        self.channel = SalesChannel.objects.create(name="  ГРИША. СБЕР  ")
        self.external = SalesChannel.objects.create(name="  Чужой полис  ")
        self.authenticate(self.user)

    def payload(self, **overrides):
        return {
            "deal": str(self.deal.pk),
            "number": "RULE-001",
            "insurance_company": str(self.company.pk),
            "insurance_type": str(self.osago.pk),
            "sales_channel": str(self.channel.pk),
            "counterparty": "Контрагент",
            "payments": [
                {
                    "amount": "1000",
                    "scheduled_date": "2026-02-01",
                    "actual_date": "2026-02-01",
                    "incomes": [],
                    "expenses": [],
                }
            ],
            **overrides,
        }

    def create(self, **overrides):
        response = self.api_client.post(
            "/api/v1/policies/draft/", self.payload(**overrides), format="json"
        )
        self.assertEqual(response.status_code, 200, response.data)
        return response.data

    def test_draft_adds_one_pkv_without_refilling_explicitly_empty_premium_records(
        self,
    ):
        created = self.create()
        pkv = Payment.objects.get(policy_id=created["policy"]["id"], kind="pkv")
        premium = Payment.objects.get(policy_id=created["policy"]["id"], kind="premium")
        self.assertFalse(premium.financial_records.exists())
        self.assertEqual(pkv.amount, Decimal("0"))
        self.assertIsNone(pkv.actual_date)
        self.assertEqual(pkv.scheduled_date, premium.scheduled_date)
        records = list(pkv.financial_records.order_by("record_type"))
        self.assertEqual(
            {r.note for r in records},
            {PKV_INCOME_NOTE, "Расход исполнителю Иван от ПКВ"},
        )
        self.assertEqual(
            {r.record_type: r.amount for r in records},
            {"income": Decimal("0"), "expense": Decimal("-1")},
        )
        self.assertEqual(len(created["payments"]), 2)

    def test_pkv_requires_exact_condition_and_executor_is_optional(self):
        self.deal.executor = None
        self.deal.save()
        created = self.create()
        pkv = Payment.objects.get(policy_id=created["policy"]["id"], kind="pkv")
        self.assertEqual(pkv.financial_records.count(), 1)
        other_type = InsuranceType.objects.create(name="КАСКО")
        second = self.create(number="RULE-002", insurance_type=str(other_type.pk))
        self.assertEqual(len(second["payments"]), 1)

    def test_external_import_skips_defaults_and_preserves_manual_records(self):
        data = self.payload(sales_channel=str(self.external.pk))
        serializer = PolicyDraftSerializer(data=data)
        serializer.is_valid(raise_exception=True)
        prepared = prepare_import_finances(serializer.validated_data)
        self.assertEqual(prepared["payments"][0]["incomes"], [])
        self.assertEqual(prepared["payments"][0]["expenses"], [])
        data["payments"][0]["incomes"] = [{"amount": "123", "note": "Вручную"}]
        data["payments"][0]["expenses"] = [{"amount": "20", "note": "Вручную"}]
        result = self.api_client.post("/api/v1/policies/draft/", data, format="json")
        self.assertEqual(result.status_code, 200, result.data)
        self.assertEqual(
            set(FinancialRecord.objects.values_list("amount", flat=True)),
            {Decimal("123"), Decimal("-20")},
        )

    def test_existing_draft_omitted_kind_is_preserved_and_defaults_do_not_return(self):
        created = self.create()
        payments = [
            {
                "id": item["id"],
                "amount": item["amount"],
                "scheduled_date": item["scheduled_date"],
                "incomes": [],
                "expenses": [],
            }
            for item in created["payments"]
        ]
        updated = self.api_client.patch(
            f"/api/v1/policies/{created['policy']['id']}/draft/",
            self.payload(payments=payments, sales_channel=str(self.external.pk)),
            format="json",
        )
        self.assertEqual(updated.status_code, 200, updated.data)
        self.assertEqual(Payment.objects.filter(kind="pkv").count(), 1)
        self.assertFalse(FinancialRecord.objects.exists())
        premium_only = [
            payment for payment in payments if Decimal(payment["amount"]) > 0
        ]
        for _ in range(2):
            updated = self.api_client.patch(
                f"/api/v1/policies/{created['policy']['id']}/draft/",
                self.payload(payments=premium_only),
                format="json",
            )
            self.assertEqual(updated.status_code, 200, updated.data)
            self.assertFalse(Payment.objects.filter(kind="pkv").exists())

    def test_payment_api_validates_kind_amount_dates_uniqueness_and_immutability(self):
        policy = Policy.objects.create(
            number="DIRECT",
            deal=self.deal,
            insurance_type=self.osago,
            sales_channel=self.channel,
        )
        for data in (
            {"amount": "0"},
            {"kind": "pkv", "amount": "1"},
            {"kind": "pkv", "amount": "0", "actual_date": "2026-01-01"},
            {"kind": "premium", "amount": "-1"},
        ):
            response = self.api_client.post(
                "/api/v1/payments/", {"policy": str(policy.pk), **data}, format="json"
            )
            self.assertEqual(response.status_code, 400, response.data)
        created = self.api_client.post(
            "/api/v1/payments/",
            {"policy": str(policy.pk), "kind": "pkv", "amount": "0"},
            format="json",
        )
        self.assertEqual(created.status_code, 201, created.data)
        repeated = self.api_client.post(
            "/api/v1/payments/",
            {"policy": str(policy.pk), "kind": "pkv", "amount": "0"},
            format="json",
        )
        self.assertEqual(repeated.status_code, 400, repeated.data)
        updated = self.api_client.patch(
            f"/api/v1/payments/{created.data['id']}/",
            {"amount": "0", "description": "Обновлено"},
            format="json",
        )
        self.assertEqual(updated.status_code, 200, updated.data)
        self.assertEqual(updated.data["kind"], "pkv")
        converted = self.api_client.patch(
            f"/api/v1/payments/{created.data['id']}/",
            {"kind": "premium", "amount": "100"},
            format="json",
        )
        self.assertEqual(converted.status_code, 400, converted.data)
        with self.assertRaises(IntegrityError), transaction.atomic():
            Payment.objects.create(policy=policy, kind="pkv", amount=0)

    def test_invalid_pkv_source_and_duplicate_drafts_are_rejected_atomically(self):
        for payments, channel in (
            ([{"kind": "pkv", "amount": "0"}], self.external),
            (
                [{"kind": "pkv", "amount": "0"}, {"kind": "pkv", "amount": "0"}],
                self.channel,
            ),
        ):
            response = self.api_client.post(
                "/api/v1/policies/draft/",
                self.payload(payments=payments, sales_channel=str(channel.pk)),
                format="json",
            )
            self.assertEqual(response.status_code, 400, response.data)
            self.assertFalse(Policy.objects.exists())

    def test_pkv_has_financial_effects_without_premium_debt_events_or_deadlines(self):
        created = self.create()
        policy = Policy.objects.get(pk=created["policy"]["id"])
        pkv = Payment.objects.get(policy=policy, kind="pkv")
        pkv.scheduled_date = date(2025, 1, 1)
        pkv.save()
        flagged = with_computed_status_flags(Policy.objects.all()).get(pk=policy.pk)
        self.assertFalse(flagged.has_unpaid_payment)
        self.assertTrue(flagged.has_unpaid_record)
        self.assertIsNone(calculate_deal_deadline(self.deal.pk))
        self.assertEqual(_payment_events(self.deal), [])
        self.assertEqual(
            build_finance_summary_payload(user=self.user)["planned_payments"], []
        )
        for suffix in (
            "payments/?paid=false",
            "policies/?unpaid_payments=true",
            "financial_records/?payment_paid=false",
        ):
            response = self.api_client.get(f"/api/v1/{suffix}")
            self.assertEqual(response.status_code, 200, response.data)
            self.assertEqual(response.data["count"], 0)
        income = pkv.financial_records.get(record_type="income")
        response = self.api_client.get(f"/api/v1/financial_records/{income.pk}/")
        self.assertEqual(response.data["payment_kind"], "pkv")
        income.amount = Decimal("500")
        income.date = date(2026, 2, 1)
        income.save()
        pkv.refresh_from_db()
        self.assertEqual(pkv.paid_balance, Decimal("500"))
        summary = build_finance_summary_payload(user=self.user)
        self.assertEqual(summary["incomes_total"], 500)
        with patch(
            "apps.notifications.telegram_notifications.send_notification"
        ) as send:
            from apps.notifications.telegram_notifications import (
                send_payment_due_reminders,
            )

            send_payment_due_reminders()
        send.assert_not_called()

    def test_pkv_records_keep_statement_edit_protection(self):
        created = self.create()
        pkv = Payment.objects.get(kind="pkv")
        income = pkv.financial_records.get(record_type="income")
        statement = Statement.objects.create(
            name="ПКВ выплачена", statement_type="income", paid_at=date(2026, 2, 1)
        )
        income.statement = statement
        income.save()
        drafts = [
            {
                "id": item["id"],
                "kind": item["kind"],
                "amount": item["amount"],
                "incomes": [],
                "expenses": [],
            }
            for item in created["payments"]
        ]
        response = self.api_client.patch(
            f"/api/v1/policies/{created['policy']['id']}/draft/",
            self.payload(payments=drafts),
            format="json",
        )
        self.assertEqual(response.status_code, 400, response.data)
        income.refresh_from_db()
        self.assertIsNone(income.deleted_at)

    def test_admin_restore_skips_replaced_pkv_and_keeps_premium_restore(self):
        from apps.finances.admin import PaymentAdmin
        from django.contrib import admin

        self.create()
        pkv = Payment.objects.get(kind="pkv")
        pkv.delete()
        Payment.objects.create(policy=pkv.policy, kind="pkv", amount=0)
        premium = Payment.objects.get(kind="premium")
        premium.actual_date = None
        premium.save()
        premium.delete()
        model_admin = PaymentAdmin(Payment, admin.site)
        with patch.object(model_admin, "message_user") as message:
            model_admin.restore_selected(
                None, Payment.objects.with_deleted().filter(pk__in=[pkv.pk, premium.pk])
            )
        pkv.refresh_from_db()
        premium.refresh_from_db()
        self.assertIsNotNone(pkv.deleted_at)
        self.assertIsNone(premium.deleted_at)
        self.assertIn("Восстановлено 1", message.call_args.args[1])
