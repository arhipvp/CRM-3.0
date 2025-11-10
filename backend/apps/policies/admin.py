from django.contrib import admin

from .models import Policy


@admin.register(Policy)
class PolicyAdmin(admin.ModelAdmin):
    list_display = ('number', 'insurance_company', 'insurance_type', 'deal', 'status', 'created_at')
    search_fields = ('number', 'insurance_company', 'insurance_type', 'vin')
    list_filter = ('insurance_type', 'status', 'created_at')
    readonly_fields = ('id', 'created_at', 'updated_at', 'deleted_at')
