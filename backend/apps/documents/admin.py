from django.contrib import admin

from .models import Document


@admin.register(Document)
class DocumentAdmin(admin.ModelAdmin):
    list_display = ('doc_type', 'owner', 'deal', 'file', 'created_at')
    search_fields = ('doc_type', 'owner', 'deal__title')
    list_filter = ('doc_type', 'created_at', 'deleted_at')
    readonly_fields = ('id', 'created_at', 'updated_at', 'deleted_at')
    ordering = ('-created_at',)

    fieldsets = (
        ('Основная информация', {
            'fields': ('deal', 'doc_type')
        }),
        ('Файл', {
            'fields': ('file',)
        }),
        ('Владелец', {
            'fields': ('owner',)
        }),
        ('Временные метки', {
            'fields': ('id', 'created_at', 'updated_at', 'deleted_at'),
            'classes': ('collapse',)
        }),
    )
