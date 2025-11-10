from django.contrib import admin

from .models import Note


@admin.register(Note)
class NoteAdmin(admin.ModelAdmin):
    list_display = ('deal', 'author_name', 'body_preview', 'created_at')
    search_fields = ('deal__title', 'author_name', 'body')
    list_filter = ('created_at', 'deleted_at')
    readonly_fields = ('id', 'created_at', 'updated_at', 'deleted_at')
    ordering = ('-created_at',)

    fieldsets = (
        ('Основная информация', {
            'fields': ('deal', 'author_name')
        }),
        ('Содержание', {
            'fields': ('body',)
        }),
        ('Временные метки', {
            'fields': ('id', 'created_at', 'updated_at', 'deleted_at'),
            'classes': ('collapse',)
        }),
    )

    def body_preview(self, obj):
        """Показывает сокращённый текст заметки."""
        return (obj.body[:100] + '...') if len(obj.body) > 100 else obj.body
    body_preview.short_description = 'Содержание'
