from rest_framework import serializers

from .models import FinancialRecord, Payment


class FinancialRecordSerializer(serializers.ModelSerializer):
    payment_description = serializers.CharField(
        source="payment.description", read_only=True
    )
    payment_amount = serializers.DecimalField(
        source="payment.amount", read_only=True, max_digits=12, decimal_places=2
    )
    record_type = serializers.SerializerMethodField()

    class Meta:
        model = FinancialRecord
        fields = "__all__"
        read_only_fields = ("id", "created_at", "updated_at", "deleted_at")

    def get_record_type(self, obj):
        """Возвращает 'Доход' или 'Расход' в зависимости от знака amount"""
        return "Доход" if obj.amount >= 0 else "Расход"


class PaymentSerializer(serializers.ModelSerializer):
    deal_title = serializers.CharField(
        source="deal.title", read_only=True, allow_null=True
    )
    policy_number = serializers.CharField(
        source="policy.number", read_only=True, allow_null=True
    )
    policy_insurance_type = serializers.CharField(
        source="policy.insurance_type", read_only=True, allow_null=True
    )
    financial_records = FinancialRecordSerializer(many=True, read_only=True)
    can_delete = serializers.SerializerMethodField()

    class Meta:
        model = Payment
        fields = "__all__"
        read_only_fields = ("id", "created_at", "updated_at", "deleted_at")

    def get_can_delete(self, obj):
        """Проверка возможности удаления платежа"""
        return obj.can_delete()
