from rest_framework import serializers

from .models import Client


class ClientSerializer(serializers.ModelSerializer):
    email = serializers.EmailField(
        required=False,
        allow_blank=True,
        allow_null=True,
    )

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


class ClientMergeSerializer(serializers.Serializer):
    class FieldOverridesSerializer(serializers.Serializer):
        name = serializers.CharField(required=False, allow_blank=True, max_length=255)
        phone = serializers.CharField(required=False, allow_blank=True, max_length=20)
        email = serializers.EmailField(
            required=False, allow_blank=True, allow_null=True
        )
        notes = serializers.CharField(required=False, allow_blank=True)

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
