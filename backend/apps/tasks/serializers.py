from rest_framework import serializers

from .models import Task


class TaskSerializer(serializers.ModelSerializer):
    client_name = serializers.CharField(source="client.name", read_only=True)
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
