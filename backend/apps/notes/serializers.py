from rest_framework import serializers

from .models import Note


class NoteSerializer(serializers.ModelSerializer):
    deal_title = serializers.CharField(source='deal.title', read_only=True)
    client_name = serializers.CharField(source='client.name', read_only=True)

    class Meta:
        model = Note
        fields = '__all__'
        read_only_fields = ('id', 'created_at')
