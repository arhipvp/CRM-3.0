from rest_framework import serializers

from .models import Task


class TaskSerializer(serializers.ModelSerializer):
    client_name = serializers.CharField(source="deal.client.name", read_only=True)
    deal_title = serializers.CharField(source="deal.title", read_only=True)
    assignee_name = serializers.CharField(source="assignee.username", read_only=True)
    created_by_name = serializers.CharField(
        source="created_by.username", read_only=True
    )
    completed_by_name = serializers.CharField(
        source="completed_by.username", read_only=True
    )

    class Meta:
        model = Task
        fields = "__all__"
        read_only_fields = (
            "id",
            "created_at",
            "updated_at",
            "created_by",
            "completed_by",
            "completed_at",
        )

    def validate(self, attrs):
        attrs = super().validate(attrs)
        if self.instance is not None:
            if "assignee" in attrs and attrs["assignee"] is None:
                raise serializers.ValidationError(
                    {"assignee": "Ответственный обязателен."}
                )
            return attrs

        assignee = attrs.get("assignee")
        deal = attrs.get("deal")
        if assignee is None and not getattr(deal, "executor_id", None):
            raise serializers.ValidationError({"assignee": "Ответственный обязателен."})
        return attrs
