"""
Integration tests for the deal history endpoint.
"""

import pytest
from apps.clients.models import Client
from apps.deals.models import Deal, InsuranceCompany, InsuranceType, Quote
from apps.documents.models import Document
from apps.finances.models import FinancialRecord, Payment
from apps.notes.models import Note
from apps.policies.models import Policy
from apps.tasks.models import Task
from apps.users.models import User
from django.core.files.uploadedfile import SimpleUploadedFile
from rest_framework.test import APIClient

pytestmark = [pytest.mark.integration, pytest.mark.django_db]


@pytest.mark.integration
def test_deal_history_includes_related_entities():
    admin = User.objects.create_superuser(username="history_admin", password="secret")
    api_client = APIClient()
    api_client.force_authenticate(admin)

    client_record = Client.objects.create(name="History Client")
    deal = Deal.objects.create(
        title="Historical Deal",
        client=client_record,
        status="open",
    )

    Task.objects.create(
        deal=deal,
        title="Historical Task",
        priority=Task.PriorityChoices.NORMAL,
        status=Task.TaskStatus.TODO,
        assignee=admin,
        created_by=admin,
    )

    doc_file = SimpleUploadedFile(
        "contract.pdf", b"pdf-data", content_type="application/pdf"
    )
    Document.objects.create(
        deal=deal,
        title="Agreement",
        file=doc_file,
        file_size=1234,
        mime_type="application/pdf",
    )

    company = InsuranceCompany.objects.create(name="InsCo")
    insurance_type = InsuranceType.objects.create(name="Auto")
    Quote.objects.create(
        deal=deal,
        insurance_company=company,
        insurance_type=insurance_type,
        sum_insured=10000,
        premium=500,
    )

    Policy.objects.create(
        number="POL-123",
        deal=deal,
        insurance_company=company,
        insurance_type=insurance_type,
    )

    payment = Payment.objects.create(deal=deal, amount=2000)
    FinancialRecord.objects.create(payment=payment, amount=2000, description="Оплата")

    Note.objects.create(deal=deal, body="Историческая заметка")

    response = api_client.get(f"/api/v1/deals/{deal.id}/history/")
    assert response.status_code == 200
    data = response.json()
    object_types = {
        entry.get("object_type") for entry in data if entry.get("object_type")
    }
    expected_object_types = {
        "deal",
        "task",
        "document",
        "payment",
        "financial_record",
        "note",
        "policy",
        "quote",
    }
    assert expected_object_types <= object_types
