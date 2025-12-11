import re

from rest_framework import serializers

from .models import Policy

VIN_PATTERN = re.compile(r"^[A-Za-z0-9]{17}$")


class PolicySerializer(serializers.ModelSerializer):
    insurance_company_name = serializers.CharField(
        source="insurance_company.name", read_only=True
    )
    insurance_type_name = serializers.CharField(
        source="insurance_type.name", read_only=True
    )
    client_name = serializers.CharField(source="client.name", read_only=True)
    insured_client_name = serializers.CharField(
        source="insured_client.name", read_only=True, allow_null=True
    )
    sales_channel_name = serializers.CharField(
        source="sales_channel.name", read_only=True, allow_null=True
    )
    deal_title = serializers.CharField(
        source="deal.title", read_only=True, allow_null=True
    )
    payments_total = serializers.DecimalField(
        max_digits=12, decimal_places=2, read_only=True
    )
    payments_paid = serializers.DecimalField(
        max_digits=12, decimal_places=2, read_only=True
    )
    source_file_id = serializers.CharField(
        write_only=True, required=False, allow_blank=True
    )

    class Meta:
        model = Policy
        fields = (
            "id",
            "number",
            "insurance_company",
            "insurance_company_name",
            "insurance_type",
            "insurance_type_name",
            "deal",
            "deal_title",
            "client",
            "client_name",
            "insured_client",
            "insured_client_name",
            "sales_channel_name",
            "is_vehicle",
            "brand",
            "model",
            "vin",
            "counterparty",
            "sales_channel",
            "start_date",
            "end_date",
            "status",
            "payments_paid",
            "payments_total",
            "created_at",
            "updated_at",
            "deleted_at",
            "source_file_id",
        )
        read_only_fields = (
            "id",
            "created_at",
            "updated_at",
            "deleted_at",
            "client_name",
            "insured_client_name",
            "sales_channel_name",
            "payments_paid",
            "payments_total",
            "deal_title",
        )

    def validate_vin(self, value: str) -> str:
        """Убедиться, что VIN — 17 латинских символов или цифр."""

        if not value:
            return value
        normalized = value.strip()
        if not VIN_PATTERN.fullmatch(normalized):
            raise serializers.ValidationError(
                "VIN должен состоять из 17 латинских букв и цифр."
            )
        return normalized
