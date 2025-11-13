from apps.common.admin import SoftDeleteImportExportAdmin
from apps.documents.models import Document
from apps.finances.models import Payment
from apps.notes.models import Note
from apps.policies.models import Policy
from apps.tasks.models import Task
from django.contrib import admin
from django.utils.html import format_html
from import_export import resources

from .models import ActivityLog, Deal, Quote

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
            "probability",
            "status",
            "stage_name",
            "expected_close",
            "next_review_date",
            "source",
            "loss_reason",
            "channel",
            "created_at",
            "updated_at",
            "deleted_at",
        )
        export_order = (
            "id",
            "title",
            "description",
            "client",
            "seller",
            "executor",
            "probability",
            "status",
            "stage_name",
            "expected_close",
            "next_review_date",
            "source",
            "loss_reason",
            "channel",
            "created_at",
            "updated_at",
            "deleted_at",
        )


class QuoteResource(resources.ModelResource):
    class Meta:
        model = Quote
        fields = (
            "id",
            "deal",
            "insurer",
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
            "insurer",
            "insurance_type",
            "sum_insured",
            "premium",
            "deductible",
            "comments",
            "created_at",
            "updated_at",
            "deleted_at",
        )


class ActivityLogResource(resources.ModelResource):
    class Meta:
        model = ActivityLog
        fields = (
            "id",
            "deal",
            "action_type",
            "description",
            "user",
            "old_value",
            "new_value",
            "created_at",
        )
        export_order = (
            "id",
            "deal",
            "action_type",
            "description",
            "user",
            "old_value",
            "new_value",
            "created_at",
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
    fields = ("insurer", "insurance_type", "sum_insured", "premium", "deductible")
    readonly_fields = ("created_at",)


class ActivityLogInline(admin.TabularInline):
    model = ActivityLog
    extra = 0
    fields = ("action_type", "description", "user", "created_at")
    readonly_fields = ("action_type", "description", "user", "created_at")
    can_delete = False


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
        "probability_display",
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
                "fields": ("status", "stage_name", "probability"),
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
                "fields": ("source", "loss_reason", "channel"),
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
        ActivityLogInline,
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

    def probability_display(self, obj):
        return format_html(
            '<span style="background-color: #e0e0e0; padding: 3px 8px; border-radius: 3px;">{0}%</span>',
            obj.probability,
        )

    probability_display.short_description = "Вероятность"

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

    restore_deals.short_description = "✓ Восстановить выбранные сделки"


@admin.register(Quote)
class QuoteAdmin(SoftDeleteImportExportAdmin):
    resource_class = QuoteResource

    list_display = (
        "deal",
        "insurance_type",
        "insurer",
        "sum_insured",
        "premium",
        "created_at",
    )
    list_filter = ("insurance_type", "insurer", "created_at", "deleted_at")
    search_fields = ("deal__title", "insurance_type", "insurer")
    readonly_fields = ("id", "created_at", "updated_at", "deleted_at")
    ordering = ("-created_at",)
    actions = ["restore_quotes"]

    fieldsets = (
        ("Основная информация", {"fields": ("id", "deal")}),
        ("Страховая информация", {"fields": ("insurance_type", "insurer")}),
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

    restore_quotes.short_description = "✓ Восстановить выбранные расчёты"


@admin.register(ActivityLog)
class ActivityLogAdmin(admin.ModelAdmin):
    list_display = ("deal", "action_type", "description", "user", "created_at")
    list_filter = ("action_type", "created_at", "deal")
    search_fields = ("deal__title", "description", "user__username")
    readonly_fields = (
        "deal",
        "action_type",
        "description",
        "user",
        "old_value",
        "new_value",
        "created_at",
    )
    ordering = ("-created_at",)
    date_hierarchy = "created_at"

    def has_add_permission(self, request):
        return False

    def has_delete_permission(self, request, obj=None):
        return False
