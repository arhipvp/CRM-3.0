from django.contrib import admin
from django.utils.html import format_html

from .models import Client
from .forms import ClientAdminForm


@admin.register(Client)
class ClientAdmin(admin.ModelAdmin):
    form = ClientAdminForm
    list_display = ('name', 'phone', 'birth_date', 'deals_count', 'created_at')
    search_fields = ('name', 'phone')
    list_filter = ('created_at', 'updated_at')
    readonly_fields = ('id', 'created_at', 'updated_at', 'deleted_at')
    ordering = ('-created_at',)

    fieldsets = (
        ('Основная информация', {
            'fields': ('name', 'phone', 'birth_date')
        }),
        ('Временные метки', {
            'fields': ('id', 'created_at', 'updated_at', 'deleted_at'),
            'classes': ('collapse',)
        }),
    )

    def deals_count(self, obj):
        """Показывает количество сделок клиента."""
        count = obj.deals.filter(deleted_at__isnull=True).count()
        url = f'/admin/deals/deal/?client__id__exact={obj.id}'
        return format_html(
            '<a href="{}">{} сделок</a>',
            url,
            count
        )
    deals_count.short_description = 'Сделки'
