from django.contrib import admin
from django.utils.html import format_html

from .models import Deal
from apps.tasks.models import Task
from apps.finances.models import Payment
from apps.policies.models import Policy
from apps.documents.models import Document
from apps.notes.models import Note


class TaskInline(admin.TabularInline):
    """Инлайн для задач в сделке."""
    model = Task
    extra = 1
    fields = ('title', 'status', 'priority', 'due_at')
    readonly_fields = ('created_at',)


class PolicyInline(admin.TabularInline):
    """Инлайн для полисов в сделке."""
    model = Policy
    extra = 1
    fields = ('number', 'insurance_type', 'vin', 'amount', 'start_date', 'end_date')
    readonly_fields = ('created_at',)


class DocumentInline(admin.TabularInline):
    """Инлайн для документов в сделке."""
    model = Document
    extra = 1
    fields = ('doc_type', 'file', 'owner')
    readonly_fields = ('created_at',)


class NoteInline(admin.TabularInline):
    """Инлайн для заметок в сделке."""
    model = Note
    extra = 1
    fields = ('author_name', 'body')
    readonly_fields = ('created_at',)


class PaymentInline(admin.TabularInline):
    """Инлайн для платежей в сделке."""
    model = Payment
    extra = 1
    fields = ('amount', 'status', 'scheduled_date', 'actual_date')
    readonly_fields = ('created_at',)


@admin.register(Deal)
class DealAdmin(admin.ModelAdmin):
    list_display = (
        'title',
        'client',
        'status',
        'stage_name',
        'next_review_date',
        'probability',
        'seller',
        'executor',
        'created_at'
    )
    list_filter = (
        'status',
        'stage_name',
        'created_at',
        'next_review_date',
        'deleted_at'
    )
    search_fields = ('title', 'client__name', 'description')
    readonly_fields = ('id', 'created_at', 'updated_at', 'deleted_at')
    ordering = ('next_review_date', '-created_at')
    date_hierarchy = 'next_review_date'

    fieldsets = (
        ('Основная информация', {
            'fields': ('title', 'description', 'client')
        }),
        ('Статус', {
            'fields': ('status', 'stage_name', 'probability')
        }),
        ('Даты', {
            'fields': ('expected_close', 'next_review_date')
        }),
        ('Участники', {
            'fields': ('seller', 'executor')
        }),
        ('Служебная информация', {
            'fields': ('source', 'loss_reason', 'channel'),
            'classes': ('collapse',)
        }),
        ('Временные метки', {
            'fields': ('id', 'created_at', 'updated_at', 'deleted_at'),
            'classes': ('collapse',)
        }),
    )

    inlines = [TaskInline, PaymentInline, PolicyInline, DocumentInline, NoteInline]

    actions = ['mark_as_won', 'mark_as_lost', 'mark_as_on_hold']

    def mark_as_won(self, request, queryset):
        """Action для отметки сделок как выигранные."""
        updated = queryset.update(status='won')
        self.message_user(request, f'{updated} сделок отмечено как выигранные')
    mark_as_won.short_description = "Отметить как выигранные"

    def mark_as_lost(self, request, queryset):
        """Action для отметки сделок как потеряные."""
        updated = queryset.update(status='lost')
        self.message_user(request, f'{updated} сделок отмечено как потеряные')
    mark_as_lost.short_description = "Отметить как потеряные"

    def mark_as_on_hold(self, request, queryset):
        """Action для отметки сделок как в ожидании."""
        updated = queryset.update(status='on_hold')
        self.message_user(request, f'{updated} сделок отмечено как в ожидании')
    mark_as_on_hold.short_description = "Отметить как в ожидании"
