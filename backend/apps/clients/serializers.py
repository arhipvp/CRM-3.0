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
