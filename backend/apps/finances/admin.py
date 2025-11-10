from django.contrib import admin

from .models import Expense, Income, Payment


@admin.register(Payment)
class PaymentAdmin(admin.ModelAdmin):
    list_display = ('deal', 'amount', 'currency', 'status', 'scheduled_date', 'actual_date')
    list_filter = ('status', 'currency')
    search_fields = ('description', 'deal__title')


@admin.register(Income)
class IncomeAdmin(admin.ModelAdmin):
    list_display = ('payment', 'amount', 'received_at', 'source')
    search_fields = ('source', 'note')


@admin.register(Expense)
class ExpenseAdmin(admin.ModelAdmin):
    list_display = ('payment', 'amount', 'expense_type', 'expense_date')
    search_fields = ('expense_type', 'note')
