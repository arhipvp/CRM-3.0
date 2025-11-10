from rest_framework import serializers

from .models import Document


class DocumentSerializer(serializers.ModelSerializer):
    client_name = serializers.CharField(source='client.name', read_only=True)
    deal_title = serializers.CharField(source='deal.title', read_only=True)

    class Meta:
        model = Document
        fields = '__all__'
        read_only_fields = ('id', 'file_size', 'created_at', 'updated_at')
