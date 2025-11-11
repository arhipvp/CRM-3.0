from rest_framework import serializers

from .models import Deal, Quote


class QuoteSerializer(serializers.ModelSerializer):
    class Meta:
        model = Quote
        fields = "__all__"
        read_only_fields = ("id", "created_at", "updated_at", "deleted_at")


class DealSerializer(serializers.ModelSerializer):
    client_name = serializers.CharField(source="client.name", read_only=True)
    stage_name = serializers.CharField(required=False, allow_blank=True, allow_null=True, default="")
    quotes = QuoteSerializer(many=True, read_only=True)

    class Meta:
        model = Deal
        fields = "__all__"
        read_only_fields = ("id", "created_at", "updated_at")
        extra_kwargs = {}
