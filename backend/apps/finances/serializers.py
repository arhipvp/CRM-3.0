from rest_framework import serializers

from .models import Expense, Income, Payment


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
