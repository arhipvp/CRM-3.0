from unittest.mock import Mock

from apps.deals.admin import (
    DealAdmin,
    InsuranceTypeAdmin,
    InsuranceTypeDescriptionFilter,
    QuoteAdmin,
)
from apps.deals.models import Deal, InsuranceType, Quote
from django.contrib import admin as django_admin
from django.contrib.auth.models import AnonymousUser
from django.test import RequestFactory, SimpleTestCase, TestCase


class DealAdminLabelsTests(SimpleTestCase):
    def test_restore_action_description_for_deals(self):
        site = django_admin.AdminSite()
        admin_instance = DealAdmin(Deal, site)
        self.assertEqual(
            admin_instance.restore_selected.short_description,
            "Восстановить выбранные записи",
        )

    def test_restore_action_description_for_quotes(self):
        site = django_admin.AdminSite()
        admin_instance = QuoteAdmin(Quote, site)
        self.assertEqual(
            admin_instance.restore_selected.short_description,
            "Восстановить выбранные записи",
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


class InsuranceTypeAdminTests(TestCase):
    def setUp(self):
        self.site = django_admin.AdminSite()
        self.admin_instance = InsuranceTypeAdmin(InsuranceType, self.site)
        self.request = RequestFactory().get("/admin/")
        self.request.user = AnonymousUser()

    def test_insurance_type_admin_exposes_description_tools(self):
        self.assertIn(InsuranceTypeDescriptionFilter, self.admin_instance.list_filter)
        self.assertEqual(
            self.admin_instance.search_help_text,
            "Поиск по названию и описанию",
        )
        self.assertIn("populate_ai_descriptions", self.admin_instance.actions)
        self.assertEqual(
            self.admin_instance.fieldsets[0],
            ("Основная информация", {"fields": ("name", "description")}),
        )

    def test_populate_ai_descriptions_action_fills_empty_known_types(self):
        osago = InsuranceType.objects.create(name="ОСАГО", description="")
        dgo = InsuranceType.objects.create(name="ДГО/ДСАГО", description="")
        unknown = InsuranceType.objects.create(name="Новый тип", description="")
        self.admin_instance.message_user = Mock()

        self.admin_instance.populate_ai_descriptions(
            self.request,
            InsuranceType.objects.filter(id__in=[osago.id, dgo.id, unknown.id]),
        )

        osago.refresh_from_db()
        dgo.refresh_from_db()
        unknown.refresh_from_db()
        self.assertIn("обязательное страхование", osago.description)
        self.assertIn("добровольная дополнительная", dgo.description)
        self.assertEqual(unknown.description, "")
        self.admin_instance.message_user.assert_called_once_with(
            self.request,
            "Заполнено стандартных AI-описаний: 2",
        )

    def test_populate_ai_descriptions_action_keeps_custom_description(self):
        custom = "Наше ручное описание"
        osago = InsuranceType.objects.create(name="ОСАГО", description=custom)
        self.admin_instance.message_user = Mock()

        self.admin_instance.populate_ai_descriptions(
            self.request,
            InsuranceType.objects.filter(id=osago.id),
        )

        osago.refresh_from_db()
        self.assertEqual(osago.description, custom)
        self.admin_instance.message_user.assert_called_once_with(
            self.request,
            "Заполнено стандартных AI-описаний: 0",
        )
