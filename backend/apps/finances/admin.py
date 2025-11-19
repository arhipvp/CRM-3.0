from django.contrib import admin
from django.db.models import Sum
from django.utils.html import format_html
from import_export import resources
from import_export.admin import ImportExportModelAdmin

from .models import FinancialRecord, Payment

# ============ IMPORT/EXPORT RESOURCES ============


class PaymentResource(resources.ModelResource):
    class Meta:
        model = Payment
        fields = (
            "id",
            "policy",
            "deal",
            "amount",
            "description",
            "scheduled_date",
            "actual_date",
            "created_at",
            "updated_at",
            "deleted_at",
        )
        export_order = (
            "id",
            "policy",
            "deal",
            "amount",
            "description",
            "scheduled_date",
            "actual_date",
            "created_at",
            "updated_at",
            "deleted_at",
        )


class FinancialRecordResource(resources.ModelResource):
    class Meta:
        model = FinancialRecord
        fields = (
            "id",
            "payment",
            "amount",
            "date",
            "description",
            "source",
            "note",
            "created_at",
            "updated_at",
            "deleted_at",
        )
        export_order = (
            "id",
            "payment",
            "amount",
            "date",
            "description",
            "source",
            "note",
            "created_at",
            "updated_at",
            "deleted_at",
        )


# ============ INLINE ADMINS ============


class FinancialRecordInline(admin.TabularInline):
    """Инлайн для финансовых записей (доход/расход) в платеже."""

    model = FinancialRecord
    extra = 1
    fields = ("amount", "date", "description", "source", "note")
    readonly_fields = ("created_at", "updated_at")


@admin.register(Payment)
class PaymentAdmin(ImportExportModelAdmin):
    resource_class = PaymentResource

    list_display = (
        "id",
        "policy",
        "amount_display",
        "scheduled_date",
        "actual_date",
        "total_financial",
        "created_at",
    )
    list_filter = (
        "scheduled_date",
        "actual_date",
        "created_at",
        "deleted_at",
    )
    search_fields = ("description", "policy__number", "deal__title")
    readonly_fields = ("id", "created_at", "updated_at", "deleted_at")
    ordering = ("-created_at",)
    date_hierarchy = "scheduled_date"
    actions = ["mark_as_paid", "restore_payments"]

    fieldsets = (
        (
            "Основная информация",
            {"fields": ("id", "policy", "deal", "amount", "description")},
        ),
        ("Даты", {"fields": ("scheduled_date", "actual_date")}),
        ("Статус удаления", {"fields": ("deleted_at",)}),
        ("Время", {"fields": ("created_at", "updated_at"), "classes": ("collapse",)}),
    )

    inlines = [FinancialRecordInline]

    def amount_display(self, obj):
        return format_html("<strong>{} руб.</strong>", obj.amount)

    amount_display.short_description = "Сумма"

    def total_financial(self, obj):
        """Показывает сумму по всем финансовым записям (доход - расход)."""
        total = (
            obj.financial_records.filter(deleted_at__isnull=True).aggregate(
                s=Sum("amount")
            )["s"]
            or 0
        )
        return f"{float(total):.2f} руб."

    total_financial.short_description = "Финансы"

    def mark_as_paid(self, request, queryset):
        """Action для записи даты фактической оплаты."""
        from datetime import date

        updated = queryset.update(actual_date=date.today())
        self.message_user(request, f"{updated} платежей получили актуальную дату оплаты")

    mark_as_paid.short_description = "✓ Отметить как оплачено"



    def restore_payments(self, request, queryset):
        restored = 0
        for payment in queryset.filter(deleted_at__isnull=False):
            payment.restore()
            restored += 1
        self.message_user(request, f"Восстановлено {restored} платежей")

    restore_payments.short_description = "✓ Восстановить выбранные платежи"


@admin.register(FinancialRecord)
class FinancialRecordAdmin(ImportExportModelAdmin):
    resource_class = FinancialRecordResource

    list_display = (
        "payment",
        "amount_display",
        "record_type_badge",
        "date",
        "description_preview",
        "source",
        "created_at",
    )
    search_fields = ("source", "description", "note", "payment__policy__number")
    list_filter = ("date", "created_at", "deleted_at")
    readonly_fields = (
        "id",
        "created_at",
        "updated_at",
        "deleted_at",
        "record_type_badge",
    )
    ordering = ("-date", "-created_at")
    date_hierarchy = "date"
    actions = ["restore_financial_records"]

    fieldsets = (
        (
            "Основная информация",
            {"fields": ("id", "payment", "amount", "record_type_badge")},
        ),
        ("Детали", {"fields": ("date", "description", "source")}),
        ("Примечание", {"fields": ("note",)}),
        ("Статус удаления", {"fields": ("deleted_at",)}),
        ("Время", {"fields": ("created_at", "updated_at"), "classes": ("collapse",)}),
    )

    def amount_display(self, obj):
        color = "#06ffa5" if obj.amount >= 0 else "#ff006e"
        return format_html(
            '<span style="color: {}; font-weight: bold;">{} руб.</span>',
            color,
            obj.amount,
        )

    amount_display.short_description = "Сумма"

    def record_type_badge(self, obj):
        """Показывает тип записи: Доход или Расход."""
        if obj.amount >= 0:
            return format_html(
                '<span style="background-color: #06ffa5; color: white; padding: 3px 8px; border-radius: 3px;">Доход</span>'
            )
        return format_html(
            '<span style="background-color: #ff006e; color: white; padding: 3px 8px; border-radius: 3px;">Расход</span>'
        )

    record_type_badge.short_description = "Тип"

    def description_preview(self, obj):
        if not obj.description:
            return "—"
        return (
            (obj.description[:50] + "...")
            if len(obj.description) > 50
            else obj.description
        )

    description_preview.short_description = "Описание"

    def restore_financial_records(self, request, queryset):
        restored = 0
        for record in queryset.filter(deleted_at__isnull=False):
            record.restore()
            restored += 1
        self.message_user(request, f"Восстановлено {restored} финансовых записей")

    restore_financial_records.short_description = "✓ Восстановить выбранные записи"