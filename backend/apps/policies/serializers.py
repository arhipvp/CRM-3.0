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
        source="insured_client.name",
        read_only=True,
        allow_null=True,
        help_text="Legacy field, kept for backward compatibility.",
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
    source_file_ids = serializers.ListField(
        child=serializers.CharField(),
        write_only=True,
        required=False,
        allow_empty=True,
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
            "source_file_ids",
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
        extra_kwargs = {
            "insured_client": {
                "help_text": "Legacy field, kept for backward compatibility."
            },
        }

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

    def validate_number(self, value: str) -> str:
        if value is None:
            return value
        normalized = value.strip()
        if not normalized:
            raise serializers.ValidationError("Номер полиса не может быть пустым.")
        return normalized

    def validate_status(self, value: str) -> str:
        if value is None:
            return value
        normalized = str(value).strip().lower()
        legacy_map = {
            "cancelled": Policy.PolicyStatus.CANCELED,
            "canceled": Policy.PolicyStatus.CANCELED,
        }
        normalized = legacy_map.get(normalized, normalized)
        if normalized not in Policy.PolicyStatus.values:
            raise serializers.ValidationError(
                f"Unsupported status '{value}'. Allowed: {', '.join(Policy.PolicyStatus.values)}."
            )
        return normalized

    def validate(self, attrs):
        start_date = attrs.get("start_date") or getattr(
            self.instance, "start_date", None
        )
        end_date = attrs.get("end_date") or getattr(self.instance, "end_date", None)
        status = attrs.get("status") or getattr(self.instance, "status", None)

        errors = {}
        if start_date and end_date and end_date < start_date:
            errors["end_date"] = "End date cannot be earlier than start date."
        if status == Policy.PolicyStatus.EXPIRED and not end_date:
            errors["end_date"] = "End date is required for expired policies."
        if errors:
            raise serializers.ValidationError(errors)
        return attrs
