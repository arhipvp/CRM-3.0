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

    def to_representation(self, instance):
        data = super().to_representation(instance)
        return {key: value for key, value in data.items() if value is not None}


class NoteSerializer(serializers.ModelSerializer):
    body = serializers.CharField(allow_blank=True, required=False)
    deal_title = serializers.CharField(source="deal.title", read_only=True)
    attachments = NoteAttachmentSerializer(many=True, required=False)
    is_important = serializers.BooleanField(required=False)

    class Meta:
        model = Note
        fields = (
            "id",
            "deal",
            "deal_title",
            "body",
            "author_name",
            "attachments",
            "is_important",
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

    def validate(self, attrs):
        """
        Запрещаем сохранять пустую заметку без текста и вложений.
        """
        if self.instance:
            body = attrs.get("body", self.instance.body or "")
            attachments = attrs.get("attachments", self.instance.attachments or [])
        else:
            body = attrs.get("body", "")
            attachments = attrs.get("attachments", [])

        body = (body or "").strip()
        attachments = attachments or []

        if not body and not attachments:
            raise serializers.ValidationError(
                {"body": "Заметка должна содержать текст или хотя бы одно вложение."}
            )
        return attrs
