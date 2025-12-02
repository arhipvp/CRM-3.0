from django.contrib import admin
from django.utils.html import format_html
from import_export import resources
from import_export.admin import ImportExportModelAdmin

from .models import Task

# ============ IMPORT/EXPORT RESOURCES ============


class TaskResource(resources.ModelResource):
    class Meta:
        model = Task
        fields = (
            "id",
            "title",
            "description",
            "deal",
            "assignee",
            "created_by",
            "completed_by",
            "completed_at",
            "due_at",
            "remind_at",
            "status",
            "priority",
            "checklist",
            "created_at",
            "updated_at",
            "deleted_at",
        )
        export_order = (
            "id",
            "title",
            "description",
            "deal",
            "assignee",
            "created_by",
            "completed_by",
            "completed_at",
            "due_at",
            "remind_at",
            "status",
            "priority",
            "checklist",
            "created_at",
            "updated_at",
            "deleted_at",
        )


# ============ MODEL ADMINS ============


@admin.register(Task)
class TaskAdmin(ImportExportModelAdmin):
    resource_class = TaskResource

    list_display = (
        "title",
        "deal",
        "status_badge",
        "priority_badge",
        "assignee",
        "due_at",
        "created_at",
    )
    search_fields = ("title", "deal__title", "assignee__username")
    list_filter = (
        "status",
        "priority",
        "due_at",
        "created_at",
        "deleted_at",
        "assignee",
    )
    readonly_fields = (
        "id",
        "created_at",
        "updated_at",
        "deleted_at",
        "completed_by",
        "completed_at",
    )
    ordering = ("due_at", "-created_at")
    date_hierarchy = "due_at"
    actions = ["mark_as_done", "mark_as_in_progress", "mark_as_todo", "restore_tasks"]

    fieldsets = (
        ("Основная информация", {"fields": ("id", "title", "deal", "description")}),
        ("Статус и приоритет", {"fields": ("status", "priority")}),
        ("Сроки", {"fields": ("due_at", "remind_at")}),
        ("Исполнители", {"fields": ("assignee", "created_by")}),
        ("Выполнено", {"fields": ("completed_by", "completed_at")}),
        ("Контрольный список", {"fields": ("checklist",)}),
        ("Статус удаления", {"fields": ("deleted_at",)}),
        ("Время", {"fields": ("created_at", "updated_at"), "classes": ("collapse",)}),
    )

    def status_badge(self, obj):
        colors = {
            "todo": "#3a86ff",
            "in_progress": "#fb5607",
            "done": "#06ffa5",
            "overdue": "#ff006e",
            "canceled": "#999999",
        }
        color = colors.get(obj.status, "#999999")
        return format_html(
            '<span style="background-color: {}; color: white; padding: 3px 8px; border-radius: 3px; font-weight: bold;">{}</span>',
            color,
            obj.get_status_display(),
        )

    status_badge.short_description = "Статус"

    def priority_badge(self, obj):
        colors = {
            "low": "#06ffa5",
            "normal": "#3a86ff",
            "high": "#ffbe0b",
            "urgent": "#ff006e",
        }
        color = colors.get(obj.priority, "#999999")
        return format_html(
            '<span style="background-color: {}; color: white; padding: 3px 8px; border-radius: 3px;">{}</span>',
            color,
            obj.get_priority_display(),
        )

    priority_badge.short_description = "Приоритет"

    def mark_as_done(self, request, queryset):
        """Action для отметки задач как выполненные."""
        updated = queryset.update(status="done")
        self.message_user(request, f"{updated} задач отмечено как выполненные")

    mark_as_done.short_description = "✓ Отметить как выполненные"

    def mark_as_in_progress(self, request, queryset):
        """Action для отметки задач как в процессе."""
        updated = queryset.update(status="in_progress")
        self.message_user(request, f"{updated} задач отмечено как в процессе")

    mark_as_in_progress.short_description = "⏳ Отметить как в процессе"

    def mark_as_todo(self, request, queryset):
        """Action для отметки задач как к выполнению."""
        updated = queryset.update(status="todo")
        self.message_user(request, f"{updated} задач отмечено как к выполнению")

    mark_as_todo.short_description = "↻ Отметить как к выполнению"

    def restore_tasks(self, request, queryset):
        restored = 0
        for task in queryset.filter(deleted_at__isnull=False):
            task.restore()
            restored += 1
        self.message_user(request, f"Восстановлено {restored} задач")

    restore_tasks.short_description = "✓ Восстановить выбранные задачи"
