from rest_framework import serializers

from .models import Document, KnowledgeDocument


class DocumentSerializer(serializers.ModelSerializer):
    client_name = serializers.CharField(source="client.name", read_only=True)
    deal_title = serializers.CharField(source="deal.title", read_only=True)

    class Meta:
        model = Document
        fields = "__all__"
        read_only_fields = ("id", "file_size", "created_at", "updated_at")


class KnowledgeDocumentSerializer(serializers.ModelSerializer):
    owner_id = serializers.UUIDField(source="owner.id", read_only=True)
    owner_username = serializers.CharField(source="owner.username", read_only=True)

    class Meta:
        model = KnowledgeDocument
        fields = (
            "id",
            "title",
            "description",
            "file_name",
            "mime_type",
            "file_size",
            "web_view_link",
            "drive_file_id",
            "owner_id",
            "owner_username",
            "created_at",
            "updated_at",
        )
        read_only_fields = fields
