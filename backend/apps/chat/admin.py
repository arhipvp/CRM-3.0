from django.contrib import admin
from django.utils.html import format_html
from import_export import resources
from import_export.admin import ImportExportModelAdmin

from .models import ChatMessage


# ============ IMPORT/EXPORT RESOURCES ============

class ChatMessageResource(resources.ModelResource):
    class Meta:
        model = ChatMessage
        fields = ('id', 'deal', 'author_name', 'author', 'body', 'created_at', 'updated_at', 'deleted_at')
        export_order = ('id', 'deal', 'author_name', 'author', 'body', 'created_at', 'updated_at', 'deleted_at')


# ============ MODEL ADMINS ============

@admin.register(ChatMessage)
class ChatMessageAdmin(ImportExportModelAdmin):
    resource_class = ChatMessageResource

    list_display = ('author_display', 'deal', 'body_preview', 'status_badge', 'created_at')
    list_filter = ('created_at', 'deleted_at', 'deal')
    search_fields = ('author_name', 'author__username', 'body', 'deal__title')
    readonly_fields = ('id', 'created_at', 'updated_at', 'deleted_at')
    ordering = ('-created_at',)
    actions = ['restore_messages']

    fieldsets = (
        ('Основная информация', {
            'fields': ('id', 'deal', 'author_name', 'author')
        }),
        ('Сообщение', {
            'fields': ('body',)
        }),
        ('Статус удаления', {
            'fields': ('deleted_at',)
        }),
        ('Время', {
            'fields': ('created_at', 'updated_at'),
            'classes': ('collapse',)
        }),
    )

    def author_display(self, obj):
        if obj.author:
            return format_html('<strong>{}</strong>', obj.author.username)
        return format_html('<em>{}</em>', obj.author_name or 'Анонимный')
    author_display.short_description = 'Автор'

    def body_preview(self, obj):
        return (obj.body[:80] + '...') if len(obj.body) > 80 else obj.body
    body_preview.short_description = 'Сообщение'

    def status_badge(self, obj):
        if obj.deleted_at:
            return format_html('<span style="background-color: #ffcccc; padding: 3px 8px; border-radius: 3px; color: #cc0000;">Удалено</span>')
        return format_html('<span style="background-color: #ccffcc; padding: 3px 8px; border-radius: 3px; color: #00cc00;">Активно</span>')
    status_badge.short_description = 'Статус'

    def restore_messages(self, request, queryset):
        restored = 0
        for msg in queryset.filter(deleted_at__isnull=False):
            msg.restore()
            restored += 1
        self.message_user(request, f'Восстановлено {restored} сообщений')
    restore_messages.short_description = '✓ Восстановить выбранные сообщения'
