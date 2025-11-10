from django.contrib import admin

from .models import Task


@admin.register(Task)
class TaskAdmin(admin.ModelAdmin):
    list_display = ('title', 'deal', 'status', 'priority', 'assignee', 'due_at', 'created_at')
    search_fields = ('title', 'deal__title')
    list_filter = ('status', 'priority', 'due_at', 'created_at', 'deleted_at')
    readonly_fields = ('id', 'created_at', 'updated_at', 'deleted_at')
    ordering = ('due_at', '-created_at')
    date_hierarchy = 'due_at'

    fieldsets = (
        ('Основная информация', {
            'fields': ('title', 'deal', 'description')
        }),
        ('Статус', {
            'fields': ('status', 'priority')
        }),
        ('Дата выполнения', {
            'fields': ('due_at',)
        }),
        ('Исполнитель', {
            'fields': ('assignee',)
        }),
        ('Контрольный список', {
            'fields': ('checklist',)
        }),
        ('Временные метки', {
            'fields': ('id', 'created_at', 'updated_at', 'deleted_at'),
            'classes': ('collapse',)
        }),
    )

    actions = ['mark_as_completed', 'mark_as_in_progress', 'mark_as_pending']

    def mark_as_completed(self, request, queryset):
        """Action для отметки задач как выполненные."""
        updated = queryset.update(status='completed')
        self.message_user(request, f'{updated} задач отмечено как выполненные')
    mark_as_completed.short_description = "Отметить как выполненные"

    def mark_as_in_progress(self, request, queryset):
        """Action для отметки задач как в процессе."""
        updated = queryset.update(status='in_progress')
        self.message_user(request, f'{updated} задач отмечено как в процессе')
    mark_as_in_progress.short_description = "Отметить как в процессе"

    def mark_as_pending(self, request, queryset):
        """Action для отметки задач как в ожидании."""
        updated = queryset.update(status='pending')
        self.message_user(request, f'{updated} задач отмечено как в ожидании')
    mark_as_pending.short_description = "Отметить как в ожидании"
