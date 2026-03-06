from apps.common.admin import SoftDeleteImportExportAdmin
from django.contrib import admin
from django.utils import timezone
from django.utils.html import format_html
from import_export import resources

from .models import Policy, PolicyIssuanceExecution


class PolicyResource(resources.ModelResource):
    class Meta:
        model = Policy
        fields = (
            "id",
            "number",
            "deal",
            "client",
            "insurance_type",
            "insurance_company",
            "is_vehicle",
            "brand",
            "model",
            "vin",
            "sales_channel",
            "status",
            "start_date",
            "end_date",
            "created_at",
            "updated_at",
            "deleted_at",
        )
        export_order = fields


@admin.register(Policy)
class PolicyAdmin(SoftDeleteImportExportAdmin):
    resource_class = PolicyResource

    list_display = (
        "number",
        "insurance_type",
        "insurance_company",
        "is_vehicle",
        "brand",
        "model",
        "vin",
        "counterparty",
        "sales_channel",
        "status_badge",
        "period_display",
        "client",
        "deal",
        "created_at",
    )
    search_fields = (
        "number",
        "insurance_type__name",
        "insurance_company__name",
        "vin",
        "brand",
        "model",
        "deal__title",
        "client__name",
        "counterparty",
        "sales_channel__name",
    )
    list_filter = (
        "insurance_type",
        "insurance_company",
        "is_vehicle",
        "sales_channel",
        "status",
        "start_date",
        "end_date",
        "created_at",
        "deleted_at",
    )
    readonly_fields = ("id", "created_at", "updated_at", "deleted_at")
    list_select_related = (
        "insurance_type",
        "insurance_company",
        "sales_channel",
        "client",
        "deal",
    )
    autocomplete_fields = (
        "insurance_type",
        "insurance_company",
        "sales_channel",
        "client",
        "deal",
    )
    ordering = ("-start_date",)
    date_hierarchy = "start_date"
    actions = ["mark_as_active", "mark_as_inactive"]
    list_per_page = 30
    show_full_result_count = False

    fieldsets = (
        ("Основная информация", {"fields": ("id", "number", "deal", "client")}),
        (
            "Страховая информация",
            {
                "fields": (
                    "insurance_type",
                    "insurance_company",
                    "counterparty",
                    "sales_channel",
                    "status",
                )
            },
        ),
        (
            "Детали транспорта",
            {"fields": ("is_vehicle", "brand", "model", "vin")},
        ),
        ("Срок действия", {"fields": ("start_date", "end_date")}),
        ("Статус удаления", {"fields": ("deleted_at",)}),
        ("Время", {"fields": ("created_at", "updated_at"), "classes": ("collapse",)}),
    )

    @admin.display(description="Статус")
    def status_badge(self, obj):
        today = timezone.now().date()
        if obj.end_date and obj.end_date < today:
            color = "#ff006e"
            text = "Истекла"
        elif obj.start_date and obj.start_date <= today:
            color = "#06ffa5"
            text = "Активна"
        else:
            color = "#ffbe0b"
            text = "Ожидание"

        return format_html(
            '<span style="background-color: {}; color: white; padding: 3px 8px; border-radius: 3px; font-weight: bold;">{}</span>',
            color,
            text,
        )

    @admin.display(description="Период")
    def period_display(self, obj):
        if obj.start_date and obj.end_date:
            return f'{obj.start_date.strftime("%d.%m.%y")} - {obj.end_date.strftime("%d.%m.%y")}'
        return "—"

    def mark_as_active(self, request, queryset):
        updated = queryset.update(status="active")
        self.message_user(request, f"{updated} полисов отмечено как активные")

    mark_as_active.short_description = "Отметить как активные"

    def mark_as_inactive(self, request, queryset):
        updated = queryset.update(status="inactive")
        self.message_user(request, f"{updated} полисов отмечено как неактивные")

    mark_as_inactive.short_description = "Отметить как неактивные"


@admin.register(PolicyIssuanceExecution)
class PolicyIssuanceExecutionAdmin(admin.ModelAdmin):
    list_display = (
        "policy",
        "provider",
        "product",
        "status",
        "step",
        "external_policy_number",
        "requested_by",
        "started_at",
        "finished_at",
        "updated_at",
    )
    search_fields = (
        "policy__number",
        "external_policy_number",
        "manual_step_reason",
        "last_error",
    )
    list_filter = ("provider", "product", "status", "started_at", "finished_at")
    readonly_fields = (
        "id",
        "created_at",
        "updated_at",
        "started_at",
        "finished_at",
        "payload",
        "runtime_state",
        "log",
    )
    autocomplete_fields = ("policy", "requested_by")
    list_select_related = ("policy", "requested_by")
    list_per_page = 30
    show_full_result_count = False
