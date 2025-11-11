from rest_framework import serializers

from .models import Expense, Income, Payment, FinancialTransaction


class PaymentSerializer(serializers.ModelSerializer):
    deal_title = serializers.CharField(source='deal.title', read_only=True)

    class Meta:
        model = Payment
        fields = '__all__'
        read_only_fields = ('id', 'created_at', 'updated_at')


class IncomeSerializer(serializers.ModelSerializer):
    payment_description = serializers.CharField(source='payment.description', read_only=True)

    class Meta:
        model = Income
        fields = '__all__'
        read_only_fields = ('id', 'created_at')


class ExpenseSerializer(serializers.ModelSerializer):
    payment_description = serializers.CharField(source='payment.description', read_only=True)

    class Meta:
        model = Expense
        fields = '__all__'
        read_only_fields = ('id', 'created_at')


class FinancialTransactionSerializer(serializers.ModelSerializer):
    deal_title = serializers.CharField(source='deal.title', read_only=True, allow_null=True)
    transaction_type_display = serializers.CharField(source='get_transaction_type_display', read_only=True)

    class Meta:
        model = FinancialTransaction
        fields = '__all__'
        read_only_fields = ('id', 'created_at', 'updated_at', 'deleted_at')
