from django.contrib import admin

from .models import Note


@admin.register(Note)
class NoteAdmin(admin.ModelAdmin):
    list_display = ('body', 'deal', 'author_name', 'created_at')
    search_fields = ('body', 'author_name')
    readonly_fields = ('id', 'created_at', 'updated_at', 'deleted_at')
