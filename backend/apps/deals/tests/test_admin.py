from apps.deals.admin import (
    RESTORE_DEALS_LABEL,
    RESTORE_QUOTES_LABEL,
    DealAdmin,
    QuoteAdmin,
)
from apps.deals.models import Deal, Quote
from django.contrib import admin as django_admin
from django.test import TestCase


class DealAdminLabelsTests(TestCase):
    def test_restore_deals_action_description(self):
        site = django_admin.AdminSite()
        admin_instance = DealAdmin(Deal, site)
        self.assertEqual(
            admin_instance.restore_deals.short_description,
            RESTORE_DEALS_LABEL,
        )

    def test_restore_quotes_action_description(self):
        site = django_admin.AdminSite()
        admin_instance = QuoteAdmin(Quote, site)
        self.assertEqual(
            admin_instance.restore_quotes.short_description,
            RESTORE_QUOTES_LABEL,
        )
