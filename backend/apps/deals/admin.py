# -*- coding: utf-8 -*-
from django import forms
from django.core.exceptions import ValidationError
from django.urls import reverse
from django.utils.safestring import mark_safe

from apps.common.admin import ShowDeletedFilter, SoftDeleteImportExportAdmin
from apps.documents.models import Document
from apps.finances.models import Payment
from apps.notes.models import Note
from apps.policies.models import Policy
from apps.tasks.models import Task
from django.contrib import admin
from django.utils.html import format_html
from import_export import resources

from .models import Deal, InsuranceCompany, InsuranceType, Quote, SalesChannel

RESTORE_DEALS_LABEL = "Восстановить выбранные сделки"
RESTORE_QUOTES_LABEL = "Восстановить выбранные расчёты"


# ============ IMPORT/EXPORT RESOURCES ============


class DealResource(resources.ModelResource):
    class Meta:
        model = Deal
        fields = (
            "id",
            "title",
            "description",
            "client",
            "seller",
            "executor",
            "status",
            "stage_name",
            "expected_close",
            "next_review_date",
            "source",
            "loss_reason",
            "closing_reason",
            "created_at",
            "updated_at",
            "deleted_at",
        )
        export_order = fields


class SalesChannelResource(resources.ModelResource):
    class Meta:
        model = SalesChannel
        fields = (
            "id",
            "name",
            "description",
            "created_at",
            "updated_at",
            "deleted_at",
        )
        export_order = fields


class QuoteResource(resources.ModelResource):
    class Meta:
        model = Quote
        fields = (
            "id",
            "deal",
            "insurance_company",
            "insurance_type",
            "sum_insured",
            "premium",
            "deductible",
            "comments",
            "created_at",
            "updated_at",
            "deleted_at",
        )
        export_order = (
            "id",
            "deal",
            "insurance_company",
            "insurance_type",
            "sum_insured",
            "premium",
            "deductible",
            "comments",
            "created_at",
            "updated_at",
            "deleted_at",
        )


class TaskInline(admin.TabularInline):
    model = Task
    extra = 1
    fields = ("title", "status", "priority", "due_at")
    readonly_fields = ("created_at",)


class PolicyInline(admin.TabularInline):
    model = Policy
    extra = 1
    fields = ("number", "insurance_type", "vin", "amount", "start_date", "end_date")
    readonly_fields = ("created_at",)


class DocumentInline(admin.TabularInline):
    model = Document
    extra = 1
    fields = ("doc_type", "file", "owner")
    readonly_fields = ("created_at",)


class NoteInline(admin.TabularInline):
    model = Note
    extra = 1
    fields = ("author_name", "body")
    readonly_fields = ("created_at",)


class PaymentInline(admin.TabularInline):
    model = Payment
    extra = 1
    fields = ("amount", "status", "scheduled_date", "actual_date")
    readonly_fields = ("created_at",)


class QuoteInline(admin.TabularInline):
    model = Quote
    extra = 0
    fields = (
        "insurance_company",
        "insurance_type",
        "sum_insured",
        "premium",
        "deductible",
    )
    readonly_fields = ("created_at",)


@admin.register(Deal)
class DealAdmin(SoftDeleteImportExportAdmin):
    resource_class = DealResource

    list_display = (
        "title",
        "client",
        "status_badge",
        "stage_name",
        "next_contact_date",
        "next_review_date",
        "seller",
        "executor",
        "created_at",
    )
    list_filter = (
        "status",
        "stage_name",
        "created_at",
        "next_contact_date",
        "next_review_date",
        "deleted_at",
    )
    search_fields = ("title", "client__name", "description")
    readonly_fields = ("id", "created_at", "updated_at", "deleted_at")
    ordering = ("next_review_date", "-created_at")
    date_hierarchy = "next_review_date"

    fieldsets = (
        (
            "Основные данные",
            {
                "fields": ("title", "description", "client"),
            },
        ),
        (
            "Статус",
            {
                "fields": ("status", "stage_name"),
            },
        ),
        (
            "Планирование",
            {
                "fields": ("expected_close", "next_contact_date", "next_review_date"),
            },
        ),
        (
            "Команда",
            {
                "fields": ("seller", "executor"),
            },
        ),
        (
            "Источник",
            {
                "fields": ("source", "loss_reason", "closing_reason"),
                "classes": ("collapse",),
            },
        ),
        (
            "Служебная информация",
            {
                "fields": ("id", "created_at", "updated_at", "deleted_at"),
                "classes": ("collapse",),
            },
        ),
    )

    inlines = [
        QuoteInline,
        TaskInline,
        PaymentInline,
        PolicyInline,
        DocumentInline,
        NoteInline,
    ]
    actions = ["mark_as_won", "mark_as_lost", "mark_as_on_hold", "restore_deals"]

    def status_badge(self, obj):
        colors = {
            "open": "#3a86ff",
            "won": "#06ffa5",
            "lost": "#ff006e",
            "on_hold": "#ffbe0b",
        }
        color = colors.get(obj.status, "#999999")
        return format_html(
            '<span style="background-color: {}; color: white; padding: 3px 8px; border-radius: 3px; font-weight: bold;">{}</span>',
            color,
            obj.status,
        )

    status_badge.short_description = "Статус"

    def mark_as_won(self, request, queryset):
        updated = queryset.update(status="won")
        self.message_user(request, f"{updated} сделок переведено в статус 'выиграна'")

    mark_as_won.short_description = "Перевести в выигранные"

    def mark_as_lost(self, request, queryset):
        updated = queryset.update(status="lost")
        self.message_user(request, f"{updated} сделок переведено в статус 'проиграна'")

    mark_as_lost.short_description = "Перевести в проигранные"

    def mark_as_on_hold(self, request, queryset):
        updated = queryset.update(status="on_hold")
        self.message_user(request, f"{updated} сделок поставлено на паузу")

    mark_as_on_hold.short_description = "Перевести на паузу"

    def restore_deals(self, request, queryset):
        restored = 0
        for deal in queryset.filter(deleted_at__isnull=False):
            deal.restore()
            restored += 1
        self.message_user(request, f"Восстановлено {restored} сделок")

    restore_deals.short_description = RESTORE_DEALS_LABEL


@admin.register(SalesChannel)
class SalesChannelAdmin(SoftDeleteImportExportAdmin):
    resource_class = SalesChannelResource
    list_display = ("name", "description", "created_at")
    search_fields = ("name", "description")
    readonly_fields = ("id", "created_at", "updated_at", "deleted_at")
    ordering = ("name",)
    list_filter = ("created_at", "deleted_at")
    fieldsets = (
        ("Основная информация", {"fields": ("name", "description")}),
        (
            "Метаданные",
            {
                "fields": ("id", "created_at", "updated_at", "deleted_at"),
                "classes": ("collapse",),
            },
        ),
    )


@admin.register(Quote)
class QuoteAdmin(SoftDeleteImportExportAdmin):
    resource_class = QuoteResource

    list_display = (
        "deal",
        "insurance_type",
        "insurance_company",
        "sum_insured",
        "premium",
        "created_at",
    )
    list_filter = ("insurance_type", "insurance_company", "created_at", "deleted_at")
    search_fields = ("deal__title", "insurance_type", "insurance_company")
    readonly_fields = ("id", "created_at", "updated_at", "deleted_at")
    ordering = ("-created_at",)
    actions = ["restore_quotes"]

    fieldsets = (
        ("Основная информация", {"fields": ("id", "deal")}),
        ("Страховая информация", {"fields": ("insurance_type", "insurance_company")}),
        ("Условия", {"fields": ("sum_insured", "premium", "deductible")}),
        ("Примечания", {"fields": ("comments",)}),
        ("Статус", {"fields": ("deleted_at",)}),
        ("Время", {"fields": ("created_at", "updated_at"), "classes": ("collapse",)}),
    )

    def restore_quotes(self, request, queryset):
        restored = 0
        for quote in queryset.filter(deleted_at__isnull=False):
            quote.restore()
            restored += 1
        self.message_user(request, f"Восстановлено {restored} расчётов")

    restore_quotes.short_description = RESTORE_QUOTES_LABEL


@admin.register(InsuranceCompany)
class InsuranceCompanyAdminForm(forms.ModelForm):
    class Meta:
        model = InsuranceCompany
        fields = "__all__"

    def clean_name(self):
        raw_name = self.cleaned_data["name"].strip()
        qs = InsuranceCompany.objects.with_deleted().filter(name__iexact=raw_name)
        if self.instance.pk:
            qs = qs.exclude(pk=self.instance.pk)
        if not qs.exists():
            return raw_name

        existing = qs.first()
        message = "Страховая компания с таким названием уже существует."
        if existing.deleted_at:
            admin_url = reverse(
                "admin:deals_insurancecompany_change", args=[existing.pk]
            )
            message = mark_safe(
                f'{message} Можно <a href="{admin_url}?show_deleted=true">восстановить её</a>.'
            )
        raise ValidationError(message)


@admin.register(InsuranceCompany)
class InsuranceCompanyAdmin(SoftDeleteImportExportAdmin):
    form = InsuranceCompanyAdminForm
    list_display = ("name", "description", "created_at")
    search_fields = ("name", "description")
    readonly_fields = ("id", "created_at", "updated_at", "deleted_at")
    ordering = ("name",)
    list_filter = (ShowDeletedFilter,)


@admin.register(InsuranceType)
class InsuranceTypeAdmin(SoftDeleteImportExportAdmin):
    list_display = ("name", "description", "created_at")
    search_fields = ("name", "description")
    readonly_fields = ("id", "created_at", "updated_at", "deleted_at")
    ordering = ("name",)
