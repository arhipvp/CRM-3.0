from importlib import import_module

import pytest
from apps.deals.models import Deal
from apps.documents.models import Document
from apps.finances.models import FinancialRecord, Payment
from apps.notifications.models import Notification
from apps.policies.models import Policy
from apps.tasks.models import Task
from apps.users.models import AuditLog
from django.apps import apps
from django.contrib.admin.sites import site

pytestmark = [pytest.mark.admin]


def _import_all_admin_modules() -> None:
    for app_config in apps.get_app_configs():
        try:
            import_module(f"{app_config.name}.admin")
        except ModuleNotFoundError:
            continue


def test_critical_admins_have_select_related_and_autocomplete():
    _import_all_admin_modules()

    deal_admin = site._registry[Deal]
    task_admin = site._registry[Task]
    policy_admin = site._registry[Policy]
    document_admin = site._registry[Document]
    payment_admin = site._registry[Payment]

    assert set(deal_admin.list_select_related) >= {"client", "seller", "executor"}
    assert set(deal_admin.autocomplete_fields) >= {"client", "seller", "executor"}

    assert set(task_admin.list_select_related) >= {
        "deal",
        "assignee",
        "created_by",
        "completed_by",
    }
    assert set(task_admin.autocomplete_fields) >= {"deal", "assignee", "created_by"}

    assert set(policy_admin.autocomplete_fields) >= {
        "deal",
        "client",
        "insurance_type",
        "insurance_company",
        "sales_channel",
    }
    assert set(document_admin.autocomplete_fields) >= {"deal", "owner"}
    assert set(payment_admin.autocomplete_fields) >= {"policy", "deal"}


def test_heavy_admins_disable_full_result_count():
    _import_all_admin_modules()

    heavy_models = [Deal, Task, Policy, Notification, FinancialRecord, AuditLog]
    for model in heavy_models:
        model_admin = site._registry[model]
        assert model_admin.show_full_result_count is False
