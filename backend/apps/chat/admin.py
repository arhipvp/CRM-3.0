from django.contrib import admin

from .models import ChatMessage


@admin.register(ChatMessage)
class ChatMessageAdmin(admin.ModelAdmin):
    list_display = ('author_name', 'deal', 'created_at')
    list_filter = ('created_at', 'deal')
    search_fields = ('author_name', 'body', 'deal__title')
    readonly_fields = ('id', 'created_at', 'updated_at', 'deleted_at')
    fieldsets = (
        (None, {'fields': ('deal', 'author_name', 'author', 'body')}),
        ('Metadata', {'fields': ('id', 'created_at', 'updated_at', 'deleted_at'), 'classes': ('collapse',)}),
    )
