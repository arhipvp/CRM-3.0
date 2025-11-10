from django.contrib import admin

from .models import Document


@admin.register(Document)
class DocumentAdmin(admin.ModelAdmin):
    list_display = ('title', 'doc_type', 'owner', 'deal', 'status', 'created_at')
    search_fields = ('title', 'doc_type')
    list_filter = ('doc_type', 'status')
    readonly_fields = ('id', 'created_at', 'updated_at', 'deleted_at')
