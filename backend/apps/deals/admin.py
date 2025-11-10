from django.contrib import admin

from .models import Deal


@admin.register(Deal)
class DealAdmin(admin.ModelAdmin):
    list_display = ('title', 'client', 'stage_name', 'amount', 'status', 'owner')
    list_filter = ('status',)
    search_fields = ('title', 'client__name')
