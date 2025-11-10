from rest_framework import serializers

from .models import Deal


class DealSerializer(serializers.ModelSerializer):
    client_name = serializers.CharField(source='client.name', read_only=True)
    stage_name = serializers.CharField(read_only=False, required=False)

    class Meta:
        model = Deal
        fields = '__all__'
        read_only_fields = ('id', 'created_at', 'updated_at')
