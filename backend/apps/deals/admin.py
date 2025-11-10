from django.contrib import admin

from .models import Deal


@admin.register(Deal)
class DealAdmin(admin.ModelAdmin):
    list_display = ('title', 'client', 'stage_name', 'status', 'seller', 'executor')
    list_filter = ('status', 'created_at')
    search_fields = ('title', 'client__name')
    readonly_fields = ('id', 'created_at', 'updated_at', 'deleted_at')
