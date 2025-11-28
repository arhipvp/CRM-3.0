from rest_framework import serializers

from .models import Note


class NoteSerializer(serializers.ModelSerializer):
    deal_title = serializers.CharField(source="deal.title", read_only=True)

    class Meta:
        model = Note
        fields = (
            "id",
            "deal",
            "deal_title",
            "body",
            "author_name",
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
