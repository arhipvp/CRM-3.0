from django.contrib import admin

from .models import Document


@admin.register(Document)
class DocumentAdmin(admin.ModelAdmin):
    list_display = ('title', 'doc_type', 'owner', 'deal', 'client', 'status')
    search_fields = ('title', 'doc_type')
    list_filter = ('doc_type', 'status')
