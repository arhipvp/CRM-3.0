from rest_framework import serializers

from .models import Policy


class PolicySerializer(serializers.ModelSerializer):
    class Meta:
        model = Policy
        fields = "__all__"
        read_only_fields = ("id", "created_at", "updated_at", "deleted_at")
