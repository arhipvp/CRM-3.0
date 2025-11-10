from rest_framework import serializers

from .models import Task


class TaskSerializer(serializers.ModelSerializer):
    client_name = serializers.CharField(source='client.name', read_only=True)
    deal_title = serializers.CharField(source='deal.title', read_only=True)

    class Meta:
        model = Task
        fields = '__all__'
        read_only_fields = ('id', 'created_at', 'updated_at')
