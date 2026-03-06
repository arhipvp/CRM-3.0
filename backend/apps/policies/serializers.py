import re

from rest_framework import serializers

from .models import Policy, PolicyIssuanceExecution
from .status import resolve_computed_status

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
    computed_status = serializers.SerializerMethodField(read_only=True)
    sber_issuance = serializers.SerializerMethodField(read_only=True)

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
            "note",
            "sales_channel",
            "start_date",
            "end_date",
            "status",
            "computed_status",
            "payments_paid",
            "payments_total",
            "created_at",
            "updated_at",
            "deleted_at",
            "source_file_id",
            "source_file_ids",
            "sber_issuance",
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
            "computed_status",
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

    def validate_note(self, value: str) -> str:
        if value is None:
            return ""
        normalized = str(value).strip()
        if len(normalized) > 2000:
            raise serializers.ValidationError(
                "Policy note cannot be longer than 2000 characters."
            )
        return normalized

    def get_computed_status(self, obj: Policy) -> str:
        return resolve_computed_status(obj)

    def _get_latest_issuance(self, obj: Policy) -> PolicyIssuanceExecution | None:
        prefetched = getattr(obj, "prefetched_issuance_executions", None)
        if prefetched is not None:
            return prefetched[0] if prefetched else None
        return obj.issuance_executions.order_by("-created_at").first()

    def get_sber_issuance(self, obj: Policy):
        execution = self._get_latest_issuance(obj)
        if execution is None:
            return None
        return PolicyIssuanceExecutionStatusSerializer(execution).data

    def validate(self, attrs):
        client = attrs.get("client") if "client" in attrs else None
        insured_client = (
            attrs.get("insured_client") if "insured_client" in attrs else None
        )

        # Source of truth: `client`.
        # Legacy compatibility: map insured_client -> client when client is omitted.
        if "client" not in attrs and insured_client is not None:
            attrs["client"] = insured_client
            client = insured_client

        if (
            "client" in attrs
            and "insured_client" in attrs
            and client is not None
            and insured_client is not None
            and client != insured_client
        ):
            raise serializers.ValidationError(
                {
                    "insured_client": (
                        "legacy insured_client conflicts with client; "
                        "use the same value or omit insured_client."
                    )
                }
            )

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


class PolicyIssuanceExecutionLogEntrySerializer(serializers.Serializer):
    timestamp = serializers.CharField()
    level = serializers.CharField()
    step = serializers.CharField(allow_blank=True, required=False)
    message = serializers.CharField()


class PolicyIssuanceExecutionStatusSerializer(serializers.ModelSerializer):
    manualStepReason = serializers.CharField(source="manual_step_reason")
    manualStepInstructions = serializers.CharField(source="manual_step_instructions")
    externalPolicyNumber = serializers.CharField(source="external_policy_number")
    lastError = serializers.CharField(source="last_error")
    startedAt = serializers.DateTimeField(source="started_at", allow_null=True)
    finishedAt = serializers.DateTimeField(source="finished_at", allow_null=True)
    updatedAt = serializers.DateTimeField(source="updated_at")
    createdAt = serializers.DateTimeField(source="created_at")
    log = PolicyIssuanceExecutionLogEntrySerializer(many=True)
    vncHint = serializers.SerializerMethodField()

    class Meta:
        model = PolicyIssuanceExecution
        fields = (
            "id",
            "provider",
            "product",
            "status",
            "step",
            "manualStepReason",
            "manualStepInstructions",
            "externalPolicyNumber",
            "lastError",
            "startedAt",
            "finishedAt",
            "updatedAt",
            "createdAt",
            "log",
            "vncHint",
        )

    def get_vncHint(self, obj: PolicyIssuanceExecution) -> str:
        from django.conf import settings

        return getattr(settings, "SBER_ISSUANCE_VNC_HINT", "")
