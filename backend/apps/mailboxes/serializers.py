import re

from rest_framework import serializers

from .models import Mailbox


class MailboxSerializer(serializers.ModelSerializer):
    class Meta:
        model = Mailbox
        fields = ["id", "email", "display_name", "is_active", "created_at"]


class MailboxCreateSerializer(serializers.Serializer):
    local_part = serializers.CharField(max_length=100)
    display_name = serializers.CharField(
        max_length=255, required=False, allow_blank=True
    )

    def validate_local_part(self, value: str) -> str:
        normalized = value.strip().lower()
        if not normalized:
            raise serializers.ValidationError("Локальная часть адреса обязательна.")
        if not re.fullmatch(r"[a-z0-9._-]+", normalized):
            raise serializers.ValidationError(
                "Допустимы латинские буквы, цифры, точка, дефис и подчёркивание."
            )
        return normalized
