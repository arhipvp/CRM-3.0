from rest_framework import serializers

from .models import ChatMessage


class ChatMessageSerializer(serializers.ModelSerializer):
    author_username = serializers.CharField(source='author.username', read_only=True, allow_null=True)

    class Meta:
        model = ChatMessage
        fields = "__all__"
        read_only_fields = ("id", "created_at", "updated_at", "deleted_at")
