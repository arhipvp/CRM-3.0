from django.contrib import admin

from .models import Note


@admin.register(Note)
class NoteAdmin(admin.ModelAdmin):
    list_display = ('body', 'deal', 'client', 'author_name', 'created_at')
    search_fields = ('body', 'author_name')
