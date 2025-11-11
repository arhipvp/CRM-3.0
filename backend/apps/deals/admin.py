from django.contrib import admin
from django.utils.html import format_html

from apps.documents.models import Document
from apps.finances.models import Payment
from apps.notes.models import Note
from apps.policies.models import Policy
from apps.tasks.models import Task

from .models import Deal, Quote


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


@admin.register(Deal)
class DealAdmin(admin.ModelAdmin):
    list_display = (
        "title",
        "client",
        "status",
        "stage_name",
        "next_review_date",
        "probability",
        "seller",
        "executor",
        "created_at",
    )
    list_filter = ("status", "stage_name", "created_at", "next_review_date", "deleted_at")
    search_fields = ("title", "client__name", "description")
    readonly_fields = ("id", "created_at", "updated_at", "deleted_at")
    ordering = ("next_review_date", "-created_at")
    date_hierarchy = "next_review_date"

    fieldsets = (
        ("Основные данные", {
            "fields": ("title", "description", "client"),
        }),
        ("Статус", {
            "fields": ("status", "stage_name", "probability"),
        }),
        ("Планирование", {
            "fields": ("expected_close", "next_review_date"),
        }),
        ("Команда", {
            "fields": ("seller", "executor"),
        }),
        ("Источник", {
            "fields": ("source", "loss_reason", "channel"),
            "classes": ("collapse",),
        }),
        ("Служебная информация", {
            "fields": ("id", "created_at", "updated_at", "deleted_at"),
            "classes": ("collapse",),
        }),
    )

    inlines = [QuoteInline, TaskInline, PaymentInline, PolicyInline, DocumentInline, NoteInline]
    actions = ["mark_as_won", "mark_as_lost", "mark_as_on_hold"]

    def deals_count(self, obj):
        count = obj.deals.filter(deleted_at__isnull=True).count()
        url = f"/admin/deals/deal/?client__id__exact={obj.id}"
        return format_html('<a href="{}">{} сделок</a>', url, count)

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
