"""Integration tests для Django signals логирования."""

from datetime import date

import pytest
from apps.clients.models import Client
from apps.deals.models import Deal, InsuranceCompany, InsuranceType
from apps.documents.models import Document
from apps.finances.models import FinancialRecord, Payment
from apps.policies.models import Policy
from apps.tasks.models import Task
from apps.users.models import AuditLog
from django.contrib.auth.models import User

pytestmark = [pytest.mark.integration, pytest.mark.django_db]


class TestDealSignals:
    """Тесты для signals Deal модели."""

    def test_deal_create_logs_audit(self):
        """Создание Deal логирует в AuditLog."""
        client = Client.objects.create(name="Test Client")
        seller = User.objects.create_user(username="seller", password="pass")

        deal = Deal.objects.create(
            title="New Deal",
            client=client,
            seller=seller,
            executor=seller,
            status="open",
        )

        log = AuditLog.objects.filter(
            object_type="deal", object_id=str(deal.id)
        ).first()
        assert log is not None
        assert log.action == "create"
        assert log.object_name == "New Deal"
        assert "Создана сделка" in log.description
        assert log.new_value is not None
        assert log.old_value is None

    def test_deal_update_logs_audit(self):
        """Обновление Deal логирует изменения."""
        client = Client.objects.create(name="Test Client")
        seller = User.objects.create_user(username="seller", password="pass")
        deal = Deal.objects.create(
            title="Original Title",
            client=client,
            seller=seller,
            executor=seller,
            status="open",
        )

        # Clear previous logs
        AuditLog.objects.filter(object_type="deal", object_id=str(deal.id)).delete()

        deal.title = "Updated Title"
        deal.save()

        log = AuditLog.objects.filter(
            object_type="deal", object_id=str(deal.id)
        ).first()
        assert log is not None
        assert log.action == "update"
        assert "Updated Title" in log.description

    def test_deal_soft_delete_logs_audit(self):
        """Soft delete Deal логирует как soft_delete."""
        client = Client.objects.create(name="Test Client")
        seller = User.objects.create_user(username="seller", password="pass")
        deal = Deal.objects.create(
            title="Deal to Delete",
            client=client,
            seller=seller,
            executor=seller,
            status="open",
        )

        # Clear previous logs
        AuditLog.objects.filter(object_type="deal", object_id=str(deal.id)).delete()

        deal.delete()

        log = AuditLog.objects.filter(
            object_type="deal", object_id=str(deal.id)
        ).first()
        assert log is not None
        assert log.action == "soft_delete"
        assert "Удалена" in log.description


class TestClientSignals:
    """Тесты для signals Client модели."""

    def test_client_create_logs_audit(self):
        """Создание Client логирует в AuditLog."""
        client = Client.objects.create(name="New Client", phone="+79991234567")

        log = AuditLog.objects.filter(
            object_type="client", object_id=str(client.id)
        ).first()
        assert log is not None
        assert log.action == "create"
        assert "Создан клиент 'New Client'" in log.description
        assert log.new_value is not None

    def test_client_update_logs_audit(self):
        """Обновление Client логирует изменения."""
        client = Client.objects.create(name="Original Name")

        # Clear previous logs
        AuditLog.objects.filter(object_type="client", object_id=str(client.id)).delete()

        client.name = "Updated Name"
        client.save()

        log = AuditLog.objects.filter(
            object_type="client", object_id=str(client.id)
        ).first()
        assert log is not None
        assert log.action == "update"
        assert "Изменён клиент" in log.description

    def test_client_soft_delete_logs_audit(self):
        """Soft delete Client логирует как soft_delete."""
        client = Client.objects.create(name="Client to Delete")

        # Clear previous logs
        AuditLog.objects.filter(object_type="client", object_id=str(client.id)).delete()

        client.delete()

        log = AuditLog.objects.filter(
            object_type="client", object_id=str(client.id)
        ).first()
        assert log is not None
        assert log.action == "soft_delete"
        assert "Удалён клиент" in log.description


class TestTaskSignals:
    """Тесты для signals Task модели."""

    def test_task_create_logs_audit(self):
        """Создание Task логирует в AuditLog."""
        client = Client.objects.create(name="Test Client")
        seller = User.objects.create_user(username="seller", password="pass")
        deal = Deal.objects.create(
            title="Test Deal",
            client=client,
            seller=seller,
            executor=seller,
        )
        task = Task.objects.create(title="New Task", deal=deal)

        log = AuditLog.objects.filter(
            object_type="task", object_id=str(task.id)
        ).first()
        assert log is not None
        assert log.action == "create"
        assert "Создана задача 'New Task'" in log.description

    def test_task_update_logs_audit(self):
        """Обновление Task логирует изменения."""
        client = Client.objects.create(name="Test Client")
        seller = User.objects.create_user(username="seller", password="pass")
        deal = Deal.objects.create(
            title="Test Deal",
            client=client,
            seller=seller,
            executor=seller,
        )
        task = Task.objects.create(title="Original Title", deal=deal)

        # Clear previous logs
        AuditLog.objects.filter(object_type="task", object_id=str(task.id)).delete()

        task.title = "Updated Title"
        task.save()

        log = AuditLog.objects.filter(
            object_type="task", object_id=str(task.id)
        ).first()
        assert log is not None
        assert log.action == "update"
        assert "Изменена задача" in log.description


class TestDocumentSignals:
    """Тесты для signals Document модели."""

    def test_document_create_logs_audit(self):
        """Создание Document логирует в AuditLog."""
        client = Client.objects.create(name="Test Client")
        seller = User.objects.create_user(username="seller", password="pass")
        deal = Deal.objects.create(
            title="Test Deal",
            client=client,
            seller=seller,
            executor=seller,
        )
        document = Document.objects.create(
            deal=deal, doc_type="contract", title="Test Document", owner=seller
        )

        log = AuditLog.objects.filter(
            object_type="document", object_id=str(document.id)
        ).first()
        assert log is not None
        assert log.action == "create"
        assert "Загружен документ" in log.description

    def test_document_soft_delete_logs_audit(self):
        """Soft delete Document логирует как soft_delete."""
        client = Client.objects.create(name="Test Client")
        seller = User.objects.create_user(username="seller", password="pass")
        deal = Deal.objects.create(
            title="Test Deal",
            client=client,
            seller=seller,
            executor=seller,
        )
        document = Document.objects.create(deal=deal, doc_type="contract")

        # Clear previous logs
        AuditLog.objects.filter(
            object_type="document", object_id=str(document.id)
        ).delete()

        document.delete()

        log = AuditLog.objects.filter(
            object_type="document", object_id=str(document.id)
        ).first()
        assert log is not None
        assert log.action == "soft_delete"
        assert "Удалён документ" in log.description


class TestPaymentSignals:
    """Тесты для signals Payment модели."""

    def test_payment_create_logs_audit(self):
        """Создание Payment логирует в AuditLog."""
        client = Client.objects.create(name="Test Client")
        seller = User.objects.create_user(username="seller", password="pass")
        deal = Deal.objects.create(
            title="Test Deal",
            client=client,
            seller=seller,
            executor=seller,
        )
        payment = Payment.objects.create(deal=deal, amount=1000.00)

        log = AuditLog.objects.filter(
            object_type="payment", object_id=str(payment.id)
        ).first()
        assert log is not None
        assert log.action == "create"
        assert "1000" in log.object_name  # Should contain amount
        assert "Платёж" in log.object_name

    def test_payment_update_logs_audit(self):
        """Обновление Payment логирует изменения."""
        client = Client.objects.create(name="Test Client")
        seller = User.objects.create_user(username="seller", password="pass")
        deal = Deal.objects.create(
            title="Test Deal",
            client=client,
            seller=seller,
            executor=seller,
        )
        payment = Payment.objects.create(deal=deal, amount=1000.00)

        # Clear previous logs
        AuditLog.objects.filter(
            object_type="payment", object_id=str(payment.id)
        ).delete()

        payment.actual_date = date.today()
        payment.save()

        log = AuditLog.objects.filter(
            object_type="payment", object_id=str(payment.id)
        ).first()
        assert log is not None
        assert log.action == "update"


class TestFinancialRecordSignals:
    """Тесты для signals FinancialRecord модели."""

    def test_financial_record_income_create_logs_audit(self):
        """Создание FinancialRecord (доход) логирует в AuditLog."""
        client = Client.objects.create(name="Test Client")
        seller = User.objects.create_user(username="seller", password="pass")
        deal = Deal.objects.create(
            title="Test Deal",
            client=client,
            seller=seller,
            executor=seller,
        )
        payment = Payment.objects.create(deal=deal, amount=1000.00)
        record = FinancialRecord.objects.create(
            payment=payment, amount=500.00, source="commission"
        )

        log = AuditLog.objects.filter(
            object_type="financial_record", object_id=str(record.id)
        ).first()
        assert log is not None
        assert log.action == "create"
        assert "Доход" in log.object_name

    def test_financial_record_expense_create_logs_audit(self):
        """Создание FinancialRecord (расход) логирует в AuditLog."""
        client = Client.objects.create(name="Test Client")
        seller = User.objects.create_user(username="seller", password="pass")
        deal = Deal.objects.create(
            title="Test Deal",
            client=client,
            seller=seller,
            executor=seller,
        )
        payment = Payment.objects.create(deal=deal, amount=1000.00)
        record = FinancialRecord.objects.create(
            payment=payment, amount=-200.00, source="commission"
        )

        log = AuditLog.objects.filter(
            object_type="financial_record", object_id=str(record.id)
        ).first()
        assert log is not None
        assert log.action == "create"
        assert "Расход" in log.object_name

    def test_financial_record_update_logs_audit(self):
        """Обновление FinancialRecord логирует изменения."""
        client = Client.objects.create(name="Test Client")
        seller = User.objects.create_user(username="seller", password="pass")
        deal = Deal.objects.create(
            title="Test Deal",
            client=client,
            seller=seller,
            executor=seller,
        )
        payment = Payment.objects.create(deal=deal, amount=1000.00)
        record = FinancialRecord.objects.create(
            payment=payment, amount=500.00, source="commission"
        )

        # Clear previous logs
        AuditLog.objects.filter(
            object_type="financial_record", object_id=str(record.id)
        ).delete()

        record.amount = 600.00
        record.save()

        log = AuditLog.objects.filter(
            object_type="financial_record", object_id=str(record.id)
        ).first()
        assert log is not None
        assert log.action == "update"

    def test_financial_record_soft_delete_logs_audit(self):
        """Soft delete FinancialRecord логирует как soft_delete."""
        client = Client.objects.create(name="Test Client")
        seller = User.objects.create_user(username="seller", password="pass")
        deal = Deal.objects.create(
            title="Test Deal",
            client=client,
            seller=seller,
            executor=seller,
        )
        payment = Payment.objects.create(deal=deal, amount=1000.00)
        record = FinancialRecord.objects.create(payment=payment, amount=200.00)

        # Clear previous logs
        AuditLog.objects.filter(
            object_type="financial_record", object_id=str(record.id)
        ).delete()

        record.delete()

        log = AuditLog.objects.filter(
            object_type="financial_record", object_id=str(record.id)
        ).first()
        assert log is not None
        assert log.action == "soft_delete"
        assert "Удалена" in log.description


class TestPolicySignals:
    """Тесты для signals Policy модели."""

    def test_policy_create_logs_audit(self):
        """Создание Policy логирует в AuditLog."""
        client = Client.objects.create(name="Test Client")
        seller = User.objects.create_user(username="seller", password="pass")
        deal = Deal.objects.create(
            title="Test Deal",
            client=client,
            seller=seller,
            executor=seller,
        )
        company = InsuranceCompany.objects.create(name="Insurance Co")
        insurance_type = InsuranceType.objects.create(name="OSAGO")
        policy = Policy.objects.create(
            number="POL123456",
            insurance_company=company,
            insurance_type=insurance_type,
            deal=deal,
        )

        log = AuditLog.objects.filter(
            object_type="policy", object_id=str(policy.id)
        ).first()
        assert log is not None
        assert log.action == "create"
        assert "Создан полис" in log.description or "Полис" in log.object_name

    def test_policy_update_logs_audit(self):
        """Обновление Policy логирует изменения."""
        client = Client.objects.create(name="Test Client")
        seller = User.objects.create_user(username="seller", password="pass")
        deal = Deal.objects.create(
            title="Test Deal",
            client=client,
            seller=seller,
            executor=seller,
        )
        company = InsuranceCompany.objects.create(name="Insurance Co")
        insurance_type = InsuranceType.objects.create(name="OSAGO")
        policy = Policy.objects.create(
            number="POL123456",
            insurance_company=company,
            insurance_type=insurance_type,
            deal=deal,
        )

        # Clear previous logs
        AuditLog.objects.filter(object_type="policy", object_id=str(policy.id)).delete()

        policy.status = "expired"
        policy.save()

        log = AuditLog.objects.filter(
            object_type="policy", object_id=str(policy.id)
        ).first()
        assert log is not None
        assert log.action == "update"

    def test_policy_soft_delete_logs_audit(self):
        """Soft delete Policy логирует как soft_delete."""
        client = Client.objects.create(name="Test Client")
        seller = User.objects.create_user(username="seller", password="pass")
        deal = Deal.objects.create(
            title="Test Deal",
            client=client,
            seller=seller,
            executor=seller,
        )
        company = InsuranceCompany.objects.create(name="Insurance Co")
        insurance_type = InsuranceType.objects.create(name="OSAGO")
        policy = Policy.objects.create(
            number="POL123456",
            insurance_company=company,
            insurance_type=insurance_type,
            deal=deal,
        )

        # Clear previous logs
        AuditLog.objects.filter(object_type="policy", object_id=str(policy.id)).delete()

        policy.delete()

        log = AuditLog.objects.filter(
            object_type="policy", object_id=str(policy.id)
        ).first()
        assert log is not None
        assert log.action == "soft_delete"
        assert "Удалён полис" in log.description or "Удалён" in log.description


class TestChangesTracking:
    """Тесты для отслеживания изменений полей."""

    def test_deal_multiple_updates(self):
        """Deal multiple field updates are logged correctly."""
        client = Client.objects.create(name="Test Client")
        seller = User.objects.create_user(username="seller", password="pass")
        deal = Deal.objects.create(
            title="Original Title",
            client=client,
            seller=seller,
            executor=seller,
            status="open",
        )

        # Clear previous logs
        AuditLog.objects.filter(object_type="deal", object_id=str(deal.id)).delete()

        # Update multiple fields
        deal.title = "New Title"
        deal.status = "won"
        deal.save()

        log = AuditLog.objects.filter(
            object_type="deal", object_id=str(deal.id)
        ).first()
        assert log is not None
        assert log.action == "update"
        assert log.new_value is not None
        assert log.new_value["title"] == "New Title"
        assert log.new_value["status"] == "won"

    def test_payment_amount_update_logged(self):
        """Payment amount update is logged correctly."""
        client = Client.objects.create(name="Test Client")
        seller = User.objects.create_user(username="seller", password="pass")
        deal = Deal.objects.create(
            title="Test Deal",
            client=client,
            seller=seller,
            executor=seller,
        )
        payment = Payment.objects.create(deal=deal, amount=1000.00)

        # Clear previous logs
        AuditLog.objects.filter(
            object_type="payment", object_id=str(payment.id)
        ).delete()

        payment.amount = 1500.00
        payment.save()

        log = AuditLog.objects.filter(
            object_type="payment", object_id=str(payment.id)
        ).first()
        assert log is not None
        assert log.action == "update"
        assert log.new_value is not None
        assert float(log.new_value["amount"]) == 1500.00
