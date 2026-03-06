from rest_framework import serializers

from .models import Notification, NotificationSettings


class NotificationSerializer(serializers.ModelSerializer):
    class Meta:
        model = Notification
        fields = "__all__"
        read_only_fields = ("id", "created_at", "read_at")


class NotificationSettingsSerializer(serializers.ModelSerializer):
    has_sber_password = serializers.SerializerMethodField(read_only=True)
    sber_password = serializers.CharField(
        required=False,
        allow_blank=True,
        allow_null=True,
        write_only=True,
    )

    class Meta:
        model = NotificationSettings
        fields = (
            "next_contact_lead_days",
            "telegram_enabled",
            "notify_tasks",
            "notify_deal_events",
            "notify_deal_expected_close",
            "notify_payment_due",
            "notify_policy_expiry",
            "remind_days",
            "sber_login",
            "sber_password",
            "has_sber_password",
        )

    def validate_remind_days(self, value):
        if value is None:
            return value
        if not isinstance(value, list):
            raise serializers.ValidationError("remind_days must be a list of numbers.")
        cleaned = []
        for item in value:
            try:
                day = int(item)
            except (TypeError, ValueError):
                raise serializers.ValidationError(
                    "remind_days contains a non-numeric value."
                )
            if day <= 0:
                raise serializers.ValidationError(
                    "remind_days must contain positive numbers."
                )
            cleaned.append(day)
        return sorted(set(cleaned), reverse=True)

    def validate_next_contact_lead_days(self, value):
        if value is None:
            return value
        try:
            days = int(value)
        except (TypeError, ValueError):
            raise serializers.ValidationError(
                "next_contact_lead_days must be an integer."
            )
        if days < 1:
            raise serializers.ValidationError(
                "next_contact_lead_days must be at least 1."
            )
        return days

    def get_has_sber_password(self, obj):
        return bool(obj.sber_password)

    def update(self, instance, validated_data):
        sber_password = validated_data.pop("sber_password", serializers.empty)
        instance = super().update(instance, validated_data)
        if sber_password is not serializers.empty:
            instance.sber_password = (sber_password or "").strip()
            instance.save(update_fields=["sber_password"])
        return instance
