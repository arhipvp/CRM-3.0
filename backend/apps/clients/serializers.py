from django.utils import timezone
from rest_framework import serializers

from .models import Client


class ClientSerializer(serializers.ModelSerializer):
    def validate_birth_date(self, value):
        if value and value > timezone.localdate():
            raise serializers.ValidationError("Дата рождения не может быть в будущем.")
        return value

    deal_count = serializers.IntegerField(read_only=True)
    referred_by = serializers.PrimaryKeyRelatedField(
        queryset=Client.objects.with_deleted(), required=False, allow_null=True
    )
    referred_by_name = serializers.CharField(
        source="referred_by.name", read_only=True, default=None
    )
    referred_by_deleted = serializers.SerializerMethodField()
    email = serializers.EmailField(
        required=False,
        allow_blank=True,
        allow_null=True,
    )

    def get_referred_by_deleted(self, obj):
        return bool(obj.referred_by_id and obj.referred_by.deleted_at)

    def validate_referred_by(self, value):
        if value is None:
            return value
        if self.instance and value.pk == self.instance.pk:
            raise serializers.ValidationError("Нельзя выбрать самого клиента.")
        if value.deleted_at and (
            not self.instance or self.instance.referred_by_id != value.pk
        ):
            raise serializers.ValidationError("Удалённого клиента нельзя выбрать.")
        return value

    class Meta:
        model = Client
        fields = "__all__"
        read_only_fields = (
            "id",
            "created_at",
            "updated_at",
            "deleted_at",
            "created_by",
        )


class ClientLookupSerializer(serializers.ModelSerializer):
    class Meta:
        model = Client
        fields = ("id", "name", "phone", "email")
        read_only_fields = fields


class ClientMergeSerializer(serializers.Serializer):
    class FieldOverridesSerializer(serializers.Serializer):
        name = serializers.CharField(required=False, allow_blank=True, max_length=255)
        phone = serializers.CharField(required=False, allow_blank=True, max_length=20)
        email = serializers.EmailField(
            required=False, allow_blank=True, allow_null=True
        )
        notes = serializers.CharField(required=False, allow_blank=True)
        current_passport_id = serializers.CharField(required=False, allow_blank=False)
        current_driver_license_id = serializers.CharField(
            required=False, allow_blank=False
        )

    target_client_id = serializers.UUIDField(
        help_text="ID клиента, в который будут перенесены данные."
    )
    source_client_ids = serializers.ListField(
        child=serializers.UUIDField(),
        allow_empty=False,
        help_text="Список ID клиентов, которых нужно объединить в целевого.",
    )
    include_deleted = serializers.BooleanField(
        required=False,
        default=True,
        help_text="Учитывать soft-deleted связанные записи.",
    )
    preview_snapshot_id = serializers.CharField(
        required=False,
        allow_blank=True,
        help_text="Идентификатор снапшота предпросмотра.",
    )
    field_overrides = FieldOverridesSerializer(
        required=False,
        help_text="Явные значения итогового профиля клиента.",
    )

    def validate(self, attrs):
        target_id = attrs["target_client_id"]
        source_ids = attrs["source_client_ids"]
        if target_id in source_ids:
            raise serializers.ValidationError(
                "Целевой клиент не может быть частью списка исходных."
            )
        if len(source_ids) != len(set(source_ids)):
            raise serializers.ValidationError(
                "Список исходных клиентов содержит дубликаты."
            )
        overrides = attrs.get("field_overrides") or {}
        if "name" in overrides and not (overrides.get("name") or "").strip():
            raise serializers.ValidationError(
                {"field_overrides": {"name": "Имя клиента не может быть пустым."}}
            )
        return attrs


class ClientMergePreviewSerializer(serializers.Serializer):
    target_client_id = serializers.UUIDField(
        help_text="ID клиента, в который будут перенесены данные."
    )
    source_client_ids = serializers.ListField(
        child=serializers.UUIDField(),
        allow_empty=False,
        help_text="Список ID клиентов, которых нужно объединить в целевого.",
    )
    include_deleted = serializers.BooleanField(
        required=False,
        default=True,
        help_text="Учитывать soft-deleted связанные записи.",
    )

    def validate(self, attrs):
        target_id = attrs["target_client_id"]
        source_ids = attrs["source_client_ids"]
        if target_id in source_ids:
            raise serializers.ValidationError(
                "Целевой клиент не может быть частью списка исходных."
            )
        if len(source_ids) != len(set(source_ids)):
            raise serializers.ValidationError(
                "Список исходных клиентов содержит дубликаты."
            )
        return attrs


class ClientSimilarSerializer(serializers.Serializer):
    target_client_id = serializers.UUIDField(help_text="ID клиента для поиска дублей.")
    limit = serializers.IntegerField(
        required=False,
        min_value=1,
        max_value=200,
        default=50,
        help_text="Максимум кандидатов в ответе.",
    )
    include_self = serializers.BooleanField(
        required=False,
        default=False,
        help_text="Включать ли самого клиента в список кандидатов.",
    )


class ClientSimilarityExclusionSerializer(serializers.Serializer):
    target_client_id = serializers.UUIDField(
        help_text="ID клиента, для которого скрывается ложный дубль."
    )
    candidate_client_id = serializers.UUIDField(
        help_text="ID кандидата, который точно является другим клиентом."
    )

    def validate(self, attrs):
        if attrs["target_client_id"] == attrs["candidate_client_id"]:
            raise serializers.ValidationError(
                "Клиент не может быть отмечен как отличающийся от самого себя."
            )
        return attrs


class ClientDuplicateHintsSerializer(serializers.Serializer):
    client_ids = serializers.ListField(
        child=serializers.UUIDField(),
        allow_empty=False,
        max_length=500,
        help_text="Список ID клиентов для пакетной проверки дублей.",
    )

    def validate_client_ids(self, value):
        if len(value) != len(set(value)):
            raise serializers.ValidationError("Список клиентов содержит дубликаты.")
        return value
