from django.contrib import admin

from .models import Expense, Income, Payment


class IncomeInline(admin.TabularInline):
    """Инлайн для доходов в платеже."""
    model = Income
    extra = 1
    fields = ('amount', 'received_at', 'source', 'note')
    readonly_fields = ('created_at',)


class ExpenseInline(admin.TabularInline):
    """Инлайн для расходов в платеже."""
    model = Expense
    extra = 1
    fields = ('amount', 'expense_type', 'expense_date', 'note')
    readonly_fields = ('created_at',)


@admin.register(Payment)
class PaymentAdmin(admin.ModelAdmin):
    list_display = (
        'deal',
        'amount',
        'status',
        'scheduled_date',
        'actual_date',
        'total_income',
        'total_expense',
        'created_at'
    )
    list_filter = ('status', 'scheduled_date', 'actual_date', 'created_at', 'deleted_at')
    search_fields = ('description', 'deal__title')
    readonly_fields = ('id', 'created_at', 'updated_at', 'deleted_at')
    ordering = ('-created_at',)
    date_hierarchy = 'scheduled_date'

    fieldsets = (
        ('Основная информация', {
            'fields': ('deal', 'amount', 'description')
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

    inlines = [IncomeInline, ExpenseInline]

    actions = ['mark_as_paid', 'mark_as_pending', 'mark_as_cancelled']

    def total_income(self, obj):
        """Показывает общую сумму доходов."""
        total = obj.incomes.aggregate(s=admin.Sum('amount'))['s'] or 0
        return f'{total} руб.'
    total_income.short_description = 'Доходы'

    def total_expense(self, obj):
        """Показывает общую сумму расходов."""
        total = obj.expenses.aggregate(s=admin.Sum('amount'))['s'] or 0
        return f'{total} руб.'
    total_expense.short_description = 'Расходы'

    def mark_as_paid(self, request, queryset):
        """Action для отметки платежей как оплачено."""
        from datetime import date
        updated = queryset.update(status='paid', actual_date=date.today())
        self.message_user(request, f'{updated} платежей отмечено как оплачено')
    mark_as_paid.short_description = "Отметить как оплачено"

    def mark_as_pending(self, request, queryset):
        """Action для отметки платежей как в ожидании."""
        updated = queryset.update(status='pending')
        self.message_user(request, f'{updated} платежей отмечено как в ожидании')
    mark_as_pending.short_description = "Отметить как в ожидании"

    def mark_as_cancelled(self, request, queryset):
        """Action для отметки платежей как отменено."""
        updated = queryset.update(status='cancelled')
        self.message_user(request, f'{updated} платежей отмечено как отменено')
    mark_as_cancelled.short_description = "Отметить как отменено"


@admin.register(Income)
class IncomeAdmin(admin.ModelAdmin):
    list_display = ('payment', 'amount', 'received_at', 'source', 'created_at')
    search_fields = ('source', 'note', 'payment__deal__title')
    list_filter = ('received_at', 'created_at')
    readonly_fields = ('id', 'created_at', 'updated_at', 'deleted_at')
    ordering = ('-received_at',)
    date_hierarchy = 'received_at'

    fieldsets = (
        ('Основная информация', {
            'fields': ('payment', 'amount', 'source')
        }),
        ('Дата получения', {
            'fields': ('received_at',)
        }),
        ('Примечание', {
            'fields': ('note',)
        }),
        ('Временные метки', {
            'fields': ('id', 'created_at', 'updated_at', 'deleted_at'),
            'classes': ('collapse',)
        }),
    )


@admin.register(Expense)
class ExpenseAdmin(admin.ModelAdmin):
    list_display = ('payment', 'amount', 'expense_type', 'expense_date', 'created_at')
    search_fields = ('expense_type', 'note', 'payment__deal__title')
    list_filter = ('expense_type', 'expense_date', 'created_at')
    readonly_fields = ('id', 'created_at', 'updated_at', 'deleted_at')
    ordering = ('-expense_date',)
    date_hierarchy = 'expense_date'

    fieldsets = (
        ('Основная информация', {
            'fields': ('payment', 'amount', 'expense_type')
        }),
        ('Дата', {
            'fields': ('expense_date',)
        }),
        ('Примечание', {
            'fields': ('note',)
        }),
        ('Временные метки', {
            'fields': ('id', 'created_at', 'updated_at', 'deleted_at'),
            'classes': ('collapse',)
        }),
    )
