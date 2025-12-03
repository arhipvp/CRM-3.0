from apps.deals.models import Deal
from rest_framework import serializers

from .models import ChatMessage


class ChatMessageSerializer(serializers.ModelSerializer):
    """Serializer that exposes chat message fields and author info."""

    author_username = serializers.CharField(
        source="author.username", read_only=True, allow_null=True
    )

    deal = serializers.PrimaryKeyRelatedField(queryset=Deal.objects.with_deleted())

    class Meta:
        model = ChatMessage
        fields = "__all__"
        read_only_fields = (
            "id",
            "created_at",
            "updated_at",
            "deleted_at",
            "author",
            "author_name",
        )

    def to_representation(self, instance):
        data = super().to_representation(instance)
        if data.get("deal") is not None:
            data["deal"] = str(data["deal"])
        return data
