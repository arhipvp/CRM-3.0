from django.contrib import admin

from .models import Expense, Income, Payment


@admin.register(Payment)
class PaymentAdmin(admin.ModelAdmin):
    list_display = ('deal', 'amount', 'status', 'scheduled_date', 'actual_date', 'created_at')
    list_filter = ('status', 'created_at')
    search_fields = ('description', 'deal__title')
    readonly_fields = ('id', 'created_at', 'updated_at', 'deleted_at')


@admin.register(Income)
class IncomeAdmin(admin.ModelAdmin):
    list_display = ('payment', 'amount', 'received_at', 'source', 'created_at')
    search_fields = ('source', 'note')
    readonly_fields = ('id', 'created_at', 'updated_at', 'deleted_at')


@admin.register(Expense)
class ExpenseAdmin(admin.ModelAdmin):
    list_display = ('payment', 'amount', 'expense_type', 'expense_date', 'created_at')
    search_fields = ('expense_type', 'note')
    readonly_fields = ('id', 'created_at', 'updated_at', 'deleted_at')
