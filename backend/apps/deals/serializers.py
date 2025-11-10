from rest_framework import serializers

from .models import Deal, DealStage, Pipeline


class PipelineSerializer(serializers.ModelSerializer):
    class Meta:
        model = Pipeline
        fields = '__all__'
        read_only_fields = ('id',)


class DealStageSerializer(serializers.ModelSerializer):
    class Meta:
        model = DealStage
        fields = '__all__'
        read_only_fields = ('id',)


class DealSerializer(serializers.ModelSerializer):
    client_name = serializers.CharField(source='client.name', read_only=True)
    pipeline_name = serializers.CharField(source='pipeline.name', read_only=True)
    stage_name = serializers.CharField(source='stage.name', read_only=True)

    class Meta:
        model = Deal
        fields = '__all__'
        read_only_fields = ('id', 'created_at', 'updated_at')
