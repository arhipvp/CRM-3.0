from django.contrib import admin
from django.utils.html import format_html
from import_export import resources
from import_export.admin import ImportExportModelAdmin

from .models import Notification


# ============ IMPORT/EXPORT RESOURCES ============

class NotificationResource(resources.ModelResource):
    class Meta:
        model = Notification
        fields = ('id', 'user', 'type', 'payload', 'is_read', 'read_at', 'created_at', 'updated_at', 'deleted_at')
        export_order = ('id', 'user', 'type', 'payload', 'is_read', 'read_at', 'created_at', 'updated_at', 'deleted_at')


# ============ MODEL ADMINS ============

@admin.register(Notification)
class NotificationAdmin(ImportExportModelAdmin):
    resource_class = NotificationResource

    list_display = ('user', 'type', 'read_badge', 'read_at', 'created_at')
    search_fields = ('user__username', 'type')
    list_filter = ('is_read', 'type', 'created_at', 'read_at')
    readonly_fields = ('id', 'created_at', 'updated_at', 'deleted_at')
    ordering = ('-created_at',)
    actions = ['mark_as_read', 'mark_as_unread', 'restore_notifications']

    fieldsets = (
        ('Основная информация', {
            'fields': ('id', 'user', 'type')
        }),
        ('Данные', {
            'fields': ('payload',)
        }),
        ('Статус прочтения', {
            'fields': ('is_read', 'read_at')
        }),
        ('Статус удаления', {
            'fields': ('deleted_at',)
        }),
        ('Время', {
            'fields': ('created_at', 'updated_at'),
            'classes': ('collapse',)
        }),
    )

    def read_badge(self, obj):
        if obj.is_read:
            return format_html('<span style="background-color: #ccffcc; padding: 3px 8px; border-radius: 3px; color: #00cc00;">✓ Прочитано</span>')
        return format_html('<span style="background-color: #ffffcc; padding: 3px 8px; border-radius: 3px; color: #ccaa00;">⚫ Новое</span>')
    read_badge.short_description = 'Статус'

    def mark_as_read(self, request, queryset):
        """Action для отметки уведомлений как прочитанные."""
        updated = 0
        for obj in queryset:
            obj.mark_as_read()
            updated += 1
        self.message_user(request, f'{updated} уведомлений отмечено как прочитанные')
    mark_as_read.short_description = "✓ Отметить как прочитанные"

    def mark_as_unread(self, request, queryset):
        """Action для отметки уведомлений как непрочитанные."""
        updated = queryset.update(is_read=False, read_at=None)
        self.message_user(request, f'{updated} уведомлений отмечено как непрочитанные')
    mark_as_unread.short_description = "⚫ Отметить как непрочитанные"

    def restore_notifications(self, request, queryset):
        restored = 0
        for notif in queryset.filter(deleted_at__isnull=False):
            notif.restore()
            restored += 1
        self.message_user(request, f'Восстановлено {restored} уведомлений')
    restore_notifications.short_description = '✓ Восстановить выбранные уведомления'
