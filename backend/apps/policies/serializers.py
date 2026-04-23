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
    renewed_by = serializers.PrimaryKeyRelatedField(
        queryset=Policy.objects.alive(),
        required=False,
        allow_null=True,
    )
    renews_policy = serializers.PrimaryKeyRelatedField(
        queryset=Policy.objects.alive(),
        required=False,
        allow_null=True,
        write_only=True,
    )
    renewed_by_number = serializers.CharField(
        source="renewed_by.number", read_only=True
    )
    is_renewed = serializers.SerializerMethodField(read_only=True)
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
            "renewed_by",
            "renewed_by_number",
            "renews_policy",
            "is_renewed",
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
            "renewed_by_number",
            "is_renewed",
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

    def get_is_renewed(self, obj: Policy) -> bool:
        return obj.is_renewed

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
        attrs = attrs.copy()
        client = attrs.get("client") if "client" in attrs else None
        insured_client = (
            attrs.get("insured_client") if "insured_client" in attrs else None
        )
        renewed_by = (
            attrs.get("renewed_by")
            if "renewed_by" in attrs
            else getattr(self.instance, "renewed_by", None)
        )
        renews_policy = attrs.pop("renews_policy", serializers.empty)

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

        current_policy = self.instance
        if renewed_by is not None:
            current_policy_id = getattr(current_policy, "id", None)
            if renewed_by.id == current_policy_id:
                errors["renewed_by"] = "Полис не может быть продлён самим собой."
            else:
                conflicting_policy = (
                    Policy.objects.alive()
                    .filter(renewed_by=renewed_by)
                    .exclude(pk=current_policy_id)
                    .first()
                )
                if conflicting_policy is not None:
                    errors["renewed_by"] = "Этот полис уже используется как продление."
                candidate = renewed_by
                visited_ids = {candidate.id}
                while candidate.renewed_by_id is not None:
                    candidate = candidate.renewed_by
                    if candidate is None:
                        break
                    if current_policy_id and candidate.id == current_policy_id:
                        errors["renewed_by"] = (
                            "Нельзя построить цикл в цепочке продления полисов."
                        )
                        break
                    if candidate.id in visited_ids:
                        errors["renewed_by"] = (
                            "Обнаружен цикл в цепочке продления полисов."
                        )
                        break
                    visited_ids.add(candidate.id)

        if renews_policy is not serializers.empty and renews_policy is not None:
            current_policy_id = getattr(current_policy, "id", None)
            if renews_policy.id == current_policy_id:
                errors["renews_policy"] = "Полис не может продлевать сам себя."
            if renewed_by is not None:
                errors["renews_policy"] = (
                    "Нельзя одновременно указывать 'renewed_by' и 'renews_policy'."
                )
            if (
                renews_policy.renewed_by_id
                and renews_policy.renewed_by_id != current_policy_id
            ):
                errors["renews_policy"] = "У выбранного полиса уже указано продление."
            candidate = current_policy
            visited_ids = {renews_policy.id}
            while candidate is not None and getattr(candidate, "renewed_by_id", None):
                candidate = candidate.renewed_by
                if candidate is None:
                    break
                if candidate.id == renews_policy.id:
                    errors["renews_policy"] = (
                        "Нельзя построить цикл в цепочке продления полисов."
                    )
                    break
                if candidate.id in visited_ids:
                    errors["renews_policy"] = (
                        "Обнаружен цикл в цепочке продления полисов."
                    )
                    break
                visited_ids.add(candidate.id)

        if errors:
            raise serializers.ValidationError(errors)
        attrs["renews_policy"] = renews_policy
        return attrs

    def create(self, validated_data):
        renews_policy = validated_data.pop("renews_policy", serializers.empty)
        policy = super().create(validated_data)
        self._apply_reverse_renewal_link(policy, renews_policy)
        return policy

    def update(self, instance, validated_data):
        renews_policy = validated_data.pop("renews_policy", serializers.empty)
        policy = super().update(instance, validated_data)
        self._apply_reverse_renewal_link(policy, renews_policy)
        return policy

    def _apply_reverse_renewal_link(
        self,
        policy: Policy,
        renews_policy,
    ) -> None:
        if renews_policy is serializers.empty:
            return

        previous_linked = (
            Policy.objects.alive()
            .filter(renewed_by=policy)
            .exclude(pk=renews_policy.pk)
            .first()
            if renews_policy is not None
            else Policy.objects.alive().filter(renewed_by=policy).first()
        )
        if previous_linked is not None:
            previous_linked.renewed_by = None
            previous_linked.save(update_fields=["renewed_by", "updated_at"])

        if renews_policy is None:
            return

        if renews_policy.renewed_by_id != policy.id:
            renews_policy.renewed_by = policy
            renews_policy.save(update_fields=["renewed_by", "updated_at"])


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
