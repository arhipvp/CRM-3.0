from django.contrib import admin
from django.utils.html import format_html
from import_export import resources
from import_export.admin import ImportExportModelAdmin

from .models import Note


# ============ IMPORT/EXPORT RESOURCES ============

class NoteResource(resources.ModelResource):
    class Meta:
        model = Note
        fields = ('id', 'deal', 'author_name', 'body', 'created_at', 'updated_at', 'deleted_at')
        export_order = ('id', 'deal', 'author_name', 'body', 'created_at', 'updated_at', 'deleted_at')


# ============ MODEL ADMINS ============

@admin.register(Note)
class NoteAdmin(ImportExportModelAdmin):
    resource_class = NoteResource

    list_display = ('deal', 'author_name', 'body_preview', 'status_badge', 'created_at')
    search_fields = ('deal__title', 'author_name', 'body')
    list_filter = ('created_at', 'deleted_at')
    readonly_fields = ('id', 'created_at', 'updated_at', 'deleted_at')
    ordering = ('-created_at',)
    actions = ['restore_notes']

    fieldsets = (
        ('Основная информация', {
            'fields': ('id', 'deal', 'author_name')
        }),
        ('Содержание', {
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

    def body_preview(self, obj):
        """Показывает сокращённый текст заметки."""
        return (obj.body[:80] + '...') if len(obj.body) > 80 else obj.body
    body_preview.short_description = 'Содержание'

    def status_badge(self, obj):
        if obj.deleted_at:
            return format_html('<span style="background-color: #ffcccc; padding: 3px 8px; border-radius: 3px; color: #cc0000;">Удалена</span>')
        return format_html('<span style="background-color: #ccffcc; padding: 3px 8px; border-radius: 3px; color: #00cc00;">Активна</span>')
    status_badge.short_description = 'Статус'

    def restore_notes(self, request, queryset):
        restored = 0
        for note in queryset.filter(deleted_at__isnull=False):
            note.restore()
            restored += 1
        self.message_user(request, f'Восстановлено {restored} заметок')
    restore_notes.short_description = '✓ Восстановить выбранные заметки'
