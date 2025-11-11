from rest_framework import serializers

from .models import ActivityLog, Deal, Quote


class QuoteSerializer(serializers.ModelSerializer):
    class Meta:
        model = Quote
        fields = "__all__"
        read_only_fields = ("id", "created_at", "updated_at", "deleted_at")


class DocumentBriefSerializer(serializers.Serializer):
    """Lightweight document serializer for Deal embedding"""
    id = serializers.CharField()
    title = serializers.CharField()
    file_size = serializers.IntegerField()
    mime_type = serializers.CharField()
    created_at = serializers.DateTimeField()

    def to_representation(self, instance):
        return {
            'id': str(instance.id),
            'title': instance.title,
            'file': instance.file.url if instance.file else None,
            'file_size': instance.file_size,
            'mime_type': instance.mime_type,
            'created_at': instance.created_at.isoformat(),
        }


class ActivityLogSerializer(serializers.ModelSerializer):
    action_type_display = serializers.CharField(source="get_action_type_display", read_only=True)
    user_username = serializers.CharField(source="user.username", read_only=True, allow_null=True)

    class Meta:
        model = ActivityLog
        fields = ("id", "deal", "action_type", "action_type_display", "description", "user", "user_username", "old_value", "new_value", "created_at")
        read_only_fields = ("id", "created_at")


class DealSerializer(serializers.ModelSerializer):
    client_name = serializers.CharField(source="client.name", read_only=True)
    stage_name = serializers.CharField(required=False, allow_blank=True, allow_null=True, default="")
    quotes = QuoteSerializer(many=True, read_only=True)
    documents = DocumentBriefSerializer(many=True, read_only=True)

    class Meta:
        model = Deal
        fields = "__all__"
        read_only_fields = ("id", "created_at", "updated_at")
        extra_kwargs = {}
