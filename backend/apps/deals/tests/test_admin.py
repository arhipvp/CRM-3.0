from apps.deals.admin import (
    RESTORE_DEALS_LABEL,
    RESTORE_QUOTES_LABEL,
    DealAdmin,
    QuoteAdmin,
)
from apps.deals.models import Deal, Quote
from django.contrib import admin as django_admin
from django.contrib.auth.models import AnonymousUser
from django.test import RequestFactory, SimpleTestCase


class DealAdminLabelsTests(SimpleTestCase):
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


class DealAdminInlineFormsetsTests(SimpleTestCase):
    def test_deal_admin_inlines_formsets_build(self):
        site = django_admin.AdminSite()
        request = RequestFactory().get("/admin/")
        request.user = AnonymousUser()

        from apps.deals.admin import (
            DocumentInline,
            NoteInline,
            PaymentInline,
            PolicyInline,
            QuoteInline,
            TaskInline,
        )

        for inline_cls in (
            QuoteInline,
            TaskInline,
            PaymentInline,
            PolicyInline,
            DocumentInline,
            NoteInline,
        ):
            inline = inline_cls(Deal, site)
            formset = inline.get_formset(request)
            self.assertIsNotNone(formset)
