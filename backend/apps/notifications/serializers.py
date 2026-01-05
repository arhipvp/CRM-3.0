from rest_framework import serializers

from .models import Notification, NotificationSettings


class NotificationSerializer(serializers.ModelSerializer):
    class Meta:
        model = Notification
        fields = "__all__"
        read_only_fields = ("id", "created_at", "read_at")


class NotificationSettingsSerializer(serializers.ModelSerializer):
    class Meta:
        model = NotificationSettings
        fields = (
            "telegram_enabled",
            "notify_tasks",
            "notify_deal_events",
            "notify_deal_expected_close",
            "notify_payment_due",
            "remind_days",
        )

    def validate_remind_days(self, value):
        if value is None:
            return value
        if not isinstance(value, list):
            raise serializers.ValidationError("remind_days должен быть списком чисел.")
        cleaned = []
        for item in value:
            try:
                day = int(item)
            except (TypeError, ValueError):
                raise serializers.ValidationError(
                    "remind_days содержит нечисловое значение."
                )
            if day <= 0:
                raise serializers.ValidationError(
                    "remind_days должен содержать положительные числа."
                )
            cleaned.append(day)
        return sorted(set(cleaned), reverse=True)
