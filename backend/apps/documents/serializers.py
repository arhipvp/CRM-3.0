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
    insurance_type_name = serializers.CharField(
        source="insurance_type.name", read_only=True
    )
    file_url = serializers.SerializerMethodField()

    class Meta:
        model = KnowledgeDocument
        fields = (
            "id",
            "title",
            "description",
            "file_name",
            "file",
            "file_url",
            "mime_type",
            "file_size",
            "web_view_link",
            "drive_file_id",
            "insurance_type",
            "insurance_type_name",
            "open_notebook_source_id",
            "open_notebook_status",
            "open_notebook_error",
            "owner_id",
            "owner_username",
            "created_at",
            "updated_at",
        )
        read_only_fields = (
            "id",
            "file_url",
            "file_name",
            "mime_type",
            "file_size",
            "web_view_link",
            "drive_file_id",
            "insurance_type_name",
            "open_notebook_source_id",
            "open_notebook_status",
            "open_notebook_error",
            "owner_id",
            "owner_username",
            "created_at",
            "updated_at",
        )
        extra_kwargs = {"file": {"write_only": True}}

    def get_file_url(self, obj):
        if obj.file:
            return obj.file.url
        return None

    def validate(self, attrs):
        if self.instance is None and not attrs.get("insurance_type"):
            raise serializers.ValidationError(
                {"insurance_type": "Поле 'insurance_type' обязательно."}
            )
        return attrs
