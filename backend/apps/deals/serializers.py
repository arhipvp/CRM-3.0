import datetime
from rest_framework import serializers

from .models import Deal, InsuranceCompany, InsuranceType, Quote, SalesChannel


class QuoteSerializer(serializers.ModelSerializer):
    insurance_company_name = serializers.CharField(
        source="insurance_company.name", read_only=True
    )
    insurance_type_name = serializers.CharField(
        source="insurance_type.name", read_only=True
    )

    class Meta:
        model = Quote
        fields = (
            "id",
            "deal",
            "insurance_company",
            "insurance_type",
            "insurance_company_name",
            "insurance_type_name",
            "sum_insured",
            "premium",
            "deductible",
            "comments",
            "created_at",
            "updated_at",
            "deleted_at",
        )
        read_only_fields = ("id", "created_at", "updated_at", "deleted_at")


class InsuranceCompanySerializer(serializers.ModelSerializer):
    class Meta:
        model = InsuranceCompany
        fields = (
            "id",
            "name",
            "description",
            "created_at",
            "updated_at",
            "deleted_at",
        )
        read_only_fields = ("id", "created_at", "updated_at", "deleted_at")


class InsuranceTypeSerializer(serializers.ModelSerializer):
    class Meta:
        model = InsuranceType
        fields = (
            "id",
            "name",
            "description",
            "created_at",
            "updated_at",
            "deleted_at",
        )
        read_only_fields = ("id", "created_at", "updated_at", "deleted_at")


class SalesChannelSerializer(serializers.ModelSerializer):
    class Meta:
        model = SalesChannel
        fields = (
            "id",
            "name",
            "description",
            "created_at",
            "updated_at",
            "deleted_at",
        )
        read_only_fields = ("id", "created_at", "updated_at", "deleted_at")


class DocumentBriefSerializer(serializers.Serializer):
    """Lightweight document serializer for Deal embedding"""

    id = serializers.CharField()
    title = serializers.CharField()
    file_size = serializers.IntegerField()
    mime_type = serializers.CharField()
    created_at = serializers.DateTimeField()

    def to_representation(self, instance):
        return {
            "id": str(instance.id),
            "title": instance.title,
            "file": instance.file.url if instance.file else None,
            "file_size": instance.file_size,
            "mime_type": instance.mime_type,
            "created_at": instance.created_at.isoformat(),
        }


class DateOrDateTimeField(serializers.DateField):
    """DateField that tolerates datetime objects by trimming to date."""

    def to_representation(self, value):
        if isinstance(value, datetime.datetime):
            value = value.date()
        return super().to_representation(value)


class DealSerializer(serializers.ModelSerializer):
    client_name = serializers.CharField(source="client.name", read_only=True)
    stage_name = serializers.CharField(
        required=False, allow_blank=True, allow_null=True, default=""
    )
    seller_name = serializers.SerializerMethodField(read_only=True)
    executor_name = serializers.SerializerMethodField(read_only=True)
    quotes = QuoteSerializer(many=True, read_only=True)
    documents = DocumentBriefSerializer(many=True, read_only=True)
    next_contact_date = DateOrDateTimeField(required=False, allow_null=True)
    expected_close = DateOrDateTimeField(required=False, allow_null=True)
    next_review_date = DateOrDateTimeField(required=False, allow_null=True)

    class Meta:
        model = Deal
        fields = "__all__"
        read_only_fields = ("id", "created_at", "updated_at", "drive_folder_id")
        extra_kwargs = {}

    def get_seller_name(self, obj: Deal) -> str | None:
        return self._get_user_display(obj.seller)

    def get_executor_name(self, obj: Deal) -> str | None:
        return self._get_user_display(obj.executor)

    @staticmethod
    def _get_user_display(user) -> str | None:
        if not user:
            return None
        full_name = f"{user.first_name} {user.last_name}".strip()
        return full_name or user.username
