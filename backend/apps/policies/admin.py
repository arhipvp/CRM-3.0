from django.contrib import admin

from .models import Policy


@admin.register(Policy)
class PolicyAdmin(admin.ModelAdmin):
    list_display = (
        'number',
        'insurance_type',
        'vin',
        'amount',
        'start_date',
        'end_date',
        'deal',
        'created_at'
    )
    search_fields = ('number', 'insurance_type', 'vin', 'deal__title')
    list_filter = ('insurance_type', 'start_date', 'end_date', 'created_at', 'deleted_at')
    readonly_fields = ('id', 'created_at', 'updated_at', 'deleted_at')
    ordering = ('-start_date',)
    date_hierarchy = 'start_date'

    fieldsets = (
        ('Основная информация', {
            'fields': ('number', 'deal')
        }),
        ('Страховая информация', {
            'fields': ('insurance_type', 'vin')
        }),
        ('Сумма', {
            'fields': ('amount',)
        }),
        ('Сроки действия', {
            'fields': ('start_date', 'end_date')
        }),
        ('Временные метки', {
            'fields': ('id', 'created_at', 'updated_at', 'deleted_at'),
            'classes': ('collapse',)
        }),
    )
