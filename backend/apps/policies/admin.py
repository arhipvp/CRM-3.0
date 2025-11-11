from django.contrib import admin
from django.utils.html import format_html
from django.utils import timezone
from import_export import resources
from import_export.admin import ImportExportModelAdmin

from .models import Policy


# ============ IMPORT/EXPORT RESOURCES ============

class PolicyResource(resources.ModelResource):
    class Meta:
        model = Policy
        fields = ('id', 'number', 'deal', 'insurance_type', 'insurance_company', 'vin', 'amount', 'status', 'start_date', 'end_date', 'created_at', 'updated_at', 'deleted_at')
        export_order = ('id', 'number', 'deal', 'insurance_type', 'insurance_company', 'vin', 'amount', 'status', 'start_date', 'end_date', 'created_at', 'updated_at', 'deleted_at')


# ============ MODEL ADMINS ============

@admin.register(Policy)
class PolicyAdmin(ImportExportModelAdmin):
    resource_class = PolicyResource

    list_display = (
        'number',
        'insurance_type',
        'vin',
        'amount_display',
        'status_badge',
        'period_display',
        'deal',
        'created_at'
    )
    search_fields = ('number', 'insurance_type', 'vin', 'insurance_company', 'deal__title')
    list_filter = ('insurance_type', 'status', 'start_date', 'end_date', 'created_at', 'deleted_at')
    readonly_fields = ('id', 'created_at', 'updated_at', 'deleted_at')
    ordering = ('-start_date',)
    date_hierarchy = 'start_date'
    actions = ['mark_as_active', 'mark_as_inactive', 'restore_policies']

    fieldsets = (
        ('Основная информация', {
            'fields': ('id', 'number', 'deal')
        }),
        ('Страховая информация', {
            'fields': ('insurance_type', 'insurance_company', 'vin', 'status')
        }),
        ('Сумма', {
            'fields': ('amount',)
        }),
        ('Сроки действия', {
            'fields': ('start_date', 'end_date')
        }),
        ('Статус удаления', {
            'fields': ('deleted_at',)
        }),
        ('Время', {
            'fields': ('created_at', 'updated_at'),
            'classes': ('collapse',)
        }),
    )

    def amount_display(self, obj):
        return format_html('<strong>{} руб.</strong>', obj.amount)
    amount_display.short_description = 'Сумма'

    def status_badge(self, obj):
        # Determine status based on dates
        today = timezone.now().date()
        if obj.end_date and obj.end_date < today:
            color = '#ff006e'
            text = 'Истекла'
        elif obj.start_date and obj.start_date <= today:
            color = '#06ffa5'
            text = 'Активна'
        else:
            color = '#ffbe0b'
            text = 'Ожидание'

        return format_html(
            '<span style="background-color: {}; color: white; padding: 3px 8px; border-radius: 3px; font-weight: bold;">{}</span>',
            color,
            text
        )
    status_badge.short_description = 'Статус'

    def period_display(self, obj):
        if obj.start_date and obj.end_date:
            return f'{obj.start_date.strftime("%d.%m.%y")} - {obj.end_date.strftime("%d.%m.%y")}'
        return '—'
    period_display.short_description = 'Период'

    def mark_as_active(self, request, queryset):
        updated = queryset.update(status='active')
        self.message_user(request, f'{updated} полисов отмечено как активные')
    mark_as_active.short_description = '✓ Отметить как активные'

    def mark_as_inactive(self, request, queryset):
        updated = queryset.update(status='inactive')
        self.message_user(request, f'{updated} полисов отмечено как неактивные')
    mark_as_inactive.short_description = '✗ Отметить как неактивные'

    def restore_policies(self, request, queryset):
        restored = 0
        for policy in queryset.filter(deleted_at__isnull=False):
            policy.restore()
            restored += 1
        self.message_user(request, f'Восстановлено {restored} полисов')
    restore_policies.short_description = '✓ Восстановить выбранные полисы'
