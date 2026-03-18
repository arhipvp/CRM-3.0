from apps.common.admin import SoftDeleteImportExportAdmin
from django.contrib import admin
from django.db.models import Sum
from django.utils.html import format_html
from import_export import resources

from .models import FinancialRecord, Payment, Statement

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
            "statement",
            "record_type",
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
            "statement",
            "record_type",
            "amount",
            "date",
            "description",
            "source",
            "note",
            "created_at",
            "updated_at",
            "deleted_at",
        )


class StatementResource(resources.ModelResource):
    class Meta:
        model = Statement
        fields = (
            "id",
            "name",
            "statement_type",
            "status",
            "counterparty",
            "paid_at",
            "comment",
            "created_by",
            "created_at",
            "updated_at",
            "deleted_at",
        )
        export_order = (
            "id",
            "name",
            "statement_type",
            "status",
            "counterparty",
            "paid_at",
            "comment",
            "created_by",
            "created_at",
            "updated_at",
            "deleted_at",
        )


# ============ INLINE ADMINS ============


class FinancialRecordInline(admin.TabularInline):
    """Инлайн для финансовых записей (доход/расход) в платеже."""

    model = FinancialRecord
    extra = 1
    fields = (
        "record_type",
        "amount",
        "date",
        "description",
        "source",
        "note",
        "statement",
    )
    readonly_fields = ("created_at", "updated_at")


@admin.register(Payment)
class PaymentAdmin(SoftDeleteImportExportAdmin):
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
    list_select_related = ("policy", "deal")
    autocomplete_fields = ("policy", "deal")
    ordering = ("-created_at",)
    date_hierarchy = "scheduled_date"
    actions = ["mark_as_paid"]

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

    @admin.display(description="Сумма")
    def amount_display(self, obj):
        return format_html("<strong>{} руб.</strong>", obj.amount)

    @admin.display(description="Финансы")
    def total_financial(self, obj):
        """Показывает сумму по всем финансовым записям (доход - расход)."""
        total = (
            obj.financial_records.filter(deleted_at__isnull=True).aggregate(
                s=Sum("amount")
            )["s"]
            or 0
        )
        return f"{float(total):.2f} руб."

    def mark_as_paid(self, request, queryset):
        """Action для записи даты фактической оплаты."""
        from datetime import date

        updated = queryset.update(actual_date=date.today())
        self.message_user(
            request, f"{updated} платежей получили актуальную дату оплаты"
        )

    mark_as_paid.short_description = "Отметить как оплачено"


@admin.register(Statement)
class StatementAdmin(SoftDeleteImportExportAdmin):
    resource_class = StatementResource

    list_display = (
        "name",
        "statement_type",
        "status",
        "counterparty",
        "paid_at",
        "created_by",
        "created_at",
    )
    list_filter = ("statement_type", "status", "paid_at", "created_at", "deleted_at")
    search_fields = ("name", "counterparty", "comment")
    readonly_fields = ("id", "created_at", "updated_at", "deleted_at", "created_by")
    list_select_related = ("created_by",)
    ordering = ("-created_at",)

    fieldsets = (
        (
            "Основная информация",
            {"fields": ("id", "name", "statement_type", "status")},
        ),
        ("Контрагент", {"fields": ("counterparty",)}),
        ("Оплата", {"fields": ("paid_at",)}),
        ("Комментарий", {"fields": ("comment",)}),
        ("Автор", {"fields": ("created_by",)}),
        ("Статус удаления", {"fields": ("deleted_at",)}),
        ("Время", {"fields": ("created_at", "updated_at"), "classes": ("collapse",)}),
    )


@admin.register(FinancialRecord)
class FinancialRecordAdmin(SoftDeleteImportExportAdmin):
    resource_class = FinancialRecordResource

    list_display = (
        "payment",
        "statement",
        "amount_display",
        "record_type_badge",
        "date",
        "description_preview",
        "source",
        "created_at",
    )
    search_fields = ("source", "description", "note", "payment__policy__number")
    list_filter = ("date", "created_at", "deleted_at")
    list_select_related = ("payment", "statement")
    autocomplete_fields = ("payment", "statement")
    readonly_fields = (
        "id",
        "created_at",
        "updated_at",
        "deleted_at",
        "record_type_badge",
    )
    ordering = ("-date", "-created_at")
    date_hierarchy = "date"
    list_per_page = 30
    show_full_result_count = False

    fieldsets = (
        (
            "Основная информация",
            {
                "fields": (
                    "id",
                    "payment",
                    "statement",
                    "record_type",
                    "amount",
                    "record_type_badge",
                )
            },
        ),
        ("Детали", {"fields": ("date", "description", "source")}),
        ("Примечание", {"fields": ("note",)}),
        ("Статус удаления", {"fields": ("deleted_at",)}),
        ("Время", {"fields": ("created_at", "updated_at"), "classes": ("collapse",)}),
    )

    @admin.display(description="Сумма")
    def amount_display(self, obj):
        color = (
            "#06ffa5"
            if obj.record_type == FinancialRecord.RecordType.INCOME
            else "#ff006e"
        )
        return format_html(
            '<span style="color: {}; font-weight: bold;">{} руб.</span>',
            color,
            obj.amount,
        )

    @admin.display(description="Тип")
    def record_type_badge(self, obj):
        """Показывает тип записи: Доход или Расход."""
        if obj.record_type == FinancialRecord.RecordType.INCOME:
            return format_html(
                '<span style="background-color: #06ffa5; color: white; padding: 3px 8px; border-radius: 3px;">Доход</span>'
            )
        return format_html(
            '<span style="background-color: #ff006e; color: white; padding: 3px 8px; border-radius: 3px;">Расход</span>'
        )

    @admin.display(description="Описание")
    def description_preview(self, obj):
        if not obj.description:
            return "—"
        return (
            (obj.description[:50] + "...")
            if len(obj.description) > 50
            else obj.description
        )
