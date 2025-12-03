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
    target_client_id = serializers.UUIDField(
        help_text="ID клиента, в который будут перенесены данные."
    )
    source_client_ids = serializers.ListField(
        child=serializers.UUIDField(),
        allow_empty=False,
        help_text="Список ID клиентов, которых нужно объединить в целевого.",
    )

    def validate(self, attrs):
        target_id = attrs["target_client_id"]
        source_ids = attrs["source_client_ids"]
        if target_id in source_ids:
            raise serializers.ValidationError(
                "Целевой клиент не может быть частью списка исходных."
            )
        if len(source_ids) != len(set(source_ids)):
            raise serializers.ValidationError("Список исходных клиентов содержит дубликаты.")
        return attrs
