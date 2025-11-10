from rest_framework import serializers

from .models import Deal


class DealSerializer(serializers.ModelSerializer):
    client_name = serializers.CharField(source='client.name', read_only=True)

    class Meta:
        model = Deal
        fields = '__all__'
        read_only_fields = ('id', 'created_at', 'updated_at')
        extra_kwargs = {
            'stage_name': {'required': False, 'allow_blank': True},
        }
