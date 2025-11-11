from django.contrib import admin
from django.db.models import Sum, Q

from .models import Payment, FinancialRecord


class FinancialRecordInline(admin.TabularInline):
    """Инлайн для финансовых записей (доход/расход) в платеже."""
    model = FinancialRecord
    extra = 1
    fields = ('amount', 'date', 'description', 'source', 'note')
    readonly_fields = ('created_at', 'updated_at')


@admin.register(Payment)
class PaymentAdmin(admin.ModelAdmin):
    list_display = (
        'id',
        'policy',
        'amount',
        'status',
        'scheduled_date',
        'actual_date',
        'total_financial',
        'created_at'
    )
    list_filter = ('status', 'scheduled_date', 'actual_date', 'created_at', 'deleted_at')
    search_fields = ('description', 'policy__number', 'deal__title')
    readonly_fields = ('id', 'created_at', 'updated_at', 'deleted_at')
    ordering = ('-created_at',)
    date_hierarchy = 'scheduled_date'

    fieldsets = (
        ('Основная информация', {
            'fields': ('policy', 'deal', 'amount', 'description')
        }),
        ('Статус', {
            'fields': ('status',)
        }),
        ('Даты', {
            'fields': ('scheduled_date', 'actual_date')
        }),
        ('Временные метки', {
            'fields': ('id', 'created_at', 'updated_at', 'deleted_at'),
            'classes': ('collapse',)
        }),
    )

    inlines = [FinancialRecordInline]

    actions = ['mark_as_paid', 'mark_as_pending', 'mark_as_partial']

    def total_financial(self, obj):
        """Показывает сумму по всем финансовым записям (доход - расход)."""
        total = obj.financial_records.filter(deleted_at__isnull=True).aggregate(s=Sum('amount'))['s'] or 0
        return f'{float(total):.2f} руб.'
    total_financial.short_description = 'Доход/Расход'

    def mark_as_paid(self, request, queryset):
        """Action для отметки платежей как оплачено."""
        from datetime import date
        updated = queryset.update(status='paid', actual_date=date.today())
        self.message_user(request, f'{updated} платежей отмечено как оплачено')
    mark_as_paid.short_description = "Отметить как оплачено"

    def mark_as_pending(self, request, queryset):
        """Action для отметки платежей как в ожидании."""
        updated = queryset.update(status='planned')
        self.message_user(request, f'{updated} платежей отмечено как в ожидании')
    mark_as_pending.short_description = "Отметить как запланировано"

    def mark_as_partial(self, request, queryset):
        """Action для отметки платежей как частичный."""
        updated = queryset.update(status='partial')
        self.message_user(request, f'{updated} платежей отмечено как частичный')
    mark_as_partial.short_description = "Отметить как частичный"


@admin.register(FinancialRecord)
class FinancialRecordAdmin(admin.ModelAdmin):
    list_display = ('payment', 'amount', 'record_type', 'date', 'description', 'source', 'created_at')
    search_fields = ('source', 'description', 'note', 'payment__policy__number')
    list_filter = ('date', 'created_at', 'deleted_at')
    readonly_fields = ('id', 'created_at', 'updated_at', 'deleted_at', 'record_type')
    ordering = ('-date', '-created_at')
    date_hierarchy = 'date'

    fieldsets = (
        ('Основная информация', {
            'fields': ('payment', 'amount', 'record_type')
        }),
        ('Детали', {
            'fields': ('date', 'description', 'source')
        }),
        ('Примечание', {
            'fields': ('note',)
        }),
        ('Временные метки', {
            'fields': ('id', 'created_at', 'updated_at', 'deleted_at'),
            'classes': ('collapse',)
        }),
    )

    def record_type(self, obj):
        """Показывает тип записи: Доход или Расход."""
        return 'Доход' if obj.amount >= 0 else 'Расход'
    record_type.short_description = 'Тип'
