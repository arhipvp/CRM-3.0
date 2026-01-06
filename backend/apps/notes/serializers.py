from rest_framework import serializers

from .models import Note


class NoteAttachmentSerializer(serializers.Serializer):
    id = serializers.CharField()
    name = serializers.CharField()
    mime_type = serializers.CharField(required=False, allow_blank=True)
    size = serializers.IntegerField(required=False, allow_null=True)
    web_view_link = serializers.CharField(
        required=False, allow_blank=True, allow_null=True
    )


class NoteSerializer(serializers.ModelSerializer):
    deal_title = serializers.CharField(source="deal.title", read_only=True)
    attachments = NoteAttachmentSerializer(many=True, required=False)

    class Meta:
        model = Note
        fields = (
            "id",
            "deal",
            "deal_title",
            "body",
            "author_name",
            "attachments",
            "created_at",
            "updated_at",
            "deleted_at",
        )
        read_only_fields = (
            "id",
            "created_at",
            "updated_at",
            "deleted_at",
            "deal_title",
        )
