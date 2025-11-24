from rest_framework import serializers

from .models import Policy


class PolicySerializer(serializers.ModelSerializer):
    insurance_company_name = serializers.CharField(
        source="insurance_company.name", read_only=True
    )
    insurance_type_name = serializers.CharField(
        source="insurance_type.name", read_only=True
    )
    client_name = serializers.CharField(source="client.name", read_only=True)
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
        )
        read_only_fields = (
        "id",
        "created_at",
        "updated_at",
        "deleted_at",
        "client_name",
        "sales_channel_name",
        "payments_paid",
        "payments_total",
        "deal_title",
    )
