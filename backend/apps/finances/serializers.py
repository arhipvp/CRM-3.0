from django.db.models import Sum
from rest_framework import serializers

from .models import FinancialRecord, Payment, Statement


class StatementSerializer(serializers.ModelSerializer):
    record_ids = serializers.PrimaryKeyRelatedField(
        queryset=FinancialRecord.objects.filter(deleted_at__isnull=True),
        many=True,
        required=False,
        write_only=True,
    )
    records_count = serializers.IntegerField(source="records.count", read_only=True)
    total_amount = serializers.SerializerMethodField()

    class Meta:
        model = Statement
        fields = "__all__"
        read_only_fields = (
            "id",
            "created_at",
            "updated_at",
            "deleted_at",
            "created_by",
            "drive_folder_id",
        )

    def get_total_amount(self, obj):
        total = (
            obj.records.filter(deleted_at__isnull=True).aggregate(total=Sum("amount"))[
                "total"
            ]
            or 0
        )
        return total

    def validate(self, attrs):
        record_ids = attrs.get("record_ids")
        statement_type = attrs.get("statement_type") or getattr(
            self.instance, "statement_type", None
        )
        if record_ids is None:
            return attrs
        if not statement_type:
            raise serializers.ValidationError(
                {"statement_type": "Укажите тип ведомости."}
            )
        if self.instance and self.instance.status == Statement.STATUS_PAID:
            raise serializers.ValidationError(
                {"status": "Нельзя изменять ведомость со статусом «Выплачена»."}
            )

        errors = []
        for record in record_ids:
            if record.statement_id and (
                not self.instance or record.statement_id != self.instance.id
            ):
                errors.append(f"Запись {record.id} уже включена в другую ведомость.")
                continue
            if record.amount == 0:
                errors.append(f"Запись {record.id} имеет нулевую сумму.")
                continue
            if statement_type == Statement.TYPE_INCOME and record.amount < 0:
                errors.append(
                    f"Запись {record.id} относится к расходам и не подходит для ведомости доходов."
                )
            if statement_type == Statement.TYPE_EXPENSE and record.amount > 0:
                errors.append(
                    f"Запись {record.id} относится к доходам и не подходит для ведомости расходов."
                )
        if errors:
            raise serializers.ValidationError({"record_ids": errors})
        return attrs

    def create(self, validated_data):
        record_ids = validated_data.pop("record_ids", [])
        statement = super().create(validated_data)
        if record_ids:
            FinancialRecord.objects.filter(id__in=[r.id for r in record_ids]).update(
                statement=statement
            )
        return statement

    def update(self, instance, validated_data):
        record_ids = validated_data.pop("record_ids", None)
        statement = super().update(instance, validated_data)
        if record_ids:
            FinancialRecord.objects.filter(id__in=[r.id for r in record_ids]).update(
                statement=statement
            )
        return statement


class FinancialRecordSerializer(serializers.ModelSerializer):
    payment_description = serializers.CharField(
        source="payment.description", read_only=True
    )
    payment_amount = serializers.DecimalField(
        source="payment.amount", read_only=True, max_digits=12, decimal_places=2
    )
    payment_paid_balance = serializers.DecimalField(
        max_digits=12, decimal_places=2, read_only=True
    )
    record_type = serializers.SerializerMethodField()

    class Meta:
        model = FinancialRecord
        fields = "__all__"
        read_only_fields = (
            "id",
            "created_at",
            "updated_at",
            "deleted_at",
            "statement",
            "payment_paid_balance",
        )

    def get_record_type(self, obj):
        """Возвращает 'Доход' или 'Расход' в зависимости от знака amount"""
        return "Доход" if obj.amount >= 0 else "Расход"


class PaymentSerializer(serializers.ModelSerializer):
    deal_title = serializers.CharField(
        source="deal.title", read_only=True, allow_null=True
    )
    deal_client_name = serializers.CharField(
        source="deal.client.name", read_only=True, allow_null=True
    )
    policy_number = serializers.CharField(
        source="policy.number", read_only=True, allow_null=True
    )
    policy_insurance_type = serializers.CharField(
        source="policy.insurance_type", read_only=True, allow_null=True
    )
    note = serializers.CharField(source="description", allow_blank=True, read_only=True)
    financial_records = FinancialRecordSerializer(many=True, read_only=True)
    can_delete = serializers.SerializerMethodField()

    class Meta:
        model = Payment
        fields = "__all__"
        read_only_fields = ("id", "created_at", "updated_at", "deleted_at")

    def get_can_delete(self, obj):
        """Проверка возможности удаления платежа"""
        return obj.can_delete()
