from django.contrib import admin

from .models import Notification


@admin.register(Notification)
class NotificationAdmin(admin.ModelAdmin):
    list_display = ('user', 'type', 'is_read', 'read_at', 'created_at')
    search_fields = ('user__username', 'type')
    list_filter = ('is_read', 'type', 'created_at', 'read_at')
    readonly_fields = ('id', 'created_at', 'updated_at', 'deleted_at')
    ordering = ('-created_at',)

    fieldsets = (
        ('Основная информация', {
            'fields': ('user', 'type')
        }),
        ('Данные', {
            'fields': ('payload',)
        }),
        ('Статус', {
            'fields': ('is_read', 'read_at')
        }),
        ('Временные метки', {
            'fields': ('id', 'created_at', 'updated_at', 'deleted_at'),
            'classes': ('collapse',)
        }),
    )

    actions = ['mark_as_read', 'mark_as_unread']

    def mark_as_read(self, request, queryset):
        """Action для отметки уведомлений как прочитанные."""
        updated = 0
        for obj in queryset:
            obj.mark_as_read()
            updated += 1
        self.message_user(request, f'{updated} уведомлений отмечено как прочитанные')
    mark_as_read.short_description = "Отметить как прочитанные"

    def mark_as_unread(self, request, queryset):
        """Action для отметки уведомлений как непрочитанные."""
        updated = queryset.update(is_read=False, read_at=None)
        self.message_user(request, f'{updated} уведомлений отмечено как непрочитанные')
    mark_as_unread.short_description = "Отметить как непрочитанные"
