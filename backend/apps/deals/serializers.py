import datetime

from apps.policies.serializers import PolicySerializer
from apps.policies.status import with_computed_status_flags
from django.contrib.auth import get_user_model
from django.db.models import DecimalField, Q, Sum, Value
from django.db.models.functions import Coalesce
from rest_framework import serializers

from .models import (
    Deal,
    DealViewer,
    InsuranceCompany,
    InsuranceType,
    Quote,
    SalesChannel,
)

User = get_user_model()


class QuoteSerializer(serializers.ModelSerializer):
    seller = serializers.PrimaryKeyRelatedField(
        queryset=User.objects.all(),
        required=False,
        allow_null=True,
    )
    seller_name = serializers.SerializerMethodField(read_only=True)
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
            "seller",
            "insurance_company",
            "insurance_type",
            "insurance_company_name",
            "insurance_type_name",
            "sum_insured",
            "premium",
            "deductible",
            "official_dealer",
            "gap",
            "comments",
            "seller_name",
            "created_at",
            "updated_at",
            "deleted_at",
        )
        read_only_fields = ("id", "created_at", "updated_at", "deleted_at")

    def get_seller_name(self, obj):
        seller = getattr(obj, "seller", None)
        if not seller:
            return None
        full_name = f"{seller.first_name} {seller.last_name}".strip()
        return full_name or seller.username


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
    client_active_deals_count = serializers.IntegerField(read_only=True)
    stage_name = serializers.CharField(
        required=False, allow_blank=True, allow_null=True, default=""
    )
    seller_name = serializers.SerializerMethodField(read_only=True)
    executor_name = serializers.SerializerMethodField(read_only=True)
    mailbox_id = serializers.SerializerMethodField(read_only=True)
    mailbox_email = serializers.SerializerMethodField(read_only=True)
    is_pinned = serializers.SerializerMethodField(read_only=True)
    quotes = QuoteSerializer(many=True, read_only=True)
    documents = DocumentBriefSerializer(many=True, read_only=True)
    next_contact_date = DateOrDateTimeField(required=False, allow_null=True)
    expected_close = DateOrDateTimeField(required=False, allow_null=True)
    next_review_date = DateOrDateTimeField(required=False, allow_null=True)
    payments_total = serializers.DecimalField(
        max_digits=12, decimal_places=2, read_only=True
    )
    payments_paid = serializers.DecimalField(
        max_digits=12, decimal_places=2, read_only=True
    )
    policies = serializers.SerializerMethodField(read_only=True)
    visible_users = serializers.PrimaryKeyRelatedField(
        many=True,
        queryset=User.objects.all(),
        required=False,
    )
    _embed_sensitive_fields = {"quotes", "documents", "policies"}

    class Meta:
        model = Deal
        fields = "__all__"
        read_only_fields = (
            "id",
            "created_at",
            "updated_at",
            "drive_folder_id",
            "payments_total",
            "payments_paid",
        )
        extra_kwargs = {}

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        embed_fields = self.context.get("deal_embed")
        if embed_fields is None:
            return
        for field_name in self._embed_sensitive_fields - set(embed_fields):
            self.fields.pop(field_name, None)

    def get_seller_name(self, obj: Deal) -> str | None:
        return self._get_user_display(obj.seller)

    def get_executor_name(self, obj: Deal) -> str | None:
        return self._get_user_display(obj.executor)

    def get_mailbox_id(self, obj: Deal) -> int | None:
        mailbox = getattr(obj, "mailbox", None)
        return getattr(mailbox, "id", None)

    def get_mailbox_email(self, obj: Deal) -> str | None:
        mailbox = getattr(obj, "mailbox", None)
        return getattr(mailbox, "email", None)

    def get_is_pinned(self, obj: Deal) -> bool:
        if hasattr(obj, "is_pinned"):
            return bool(obj.is_pinned)
        request = self.context.get("request")
        user = getattr(request, "user", None)
        if not user or not user.is_authenticated:
            return False
        return obj.pins.filter(user=user).exists()

    def get_policies(self, obj: Deal):
        if not self.context.get("include_policies"):
            return []
        decimal_field = DecimalField(max_digits=12, decimal_places=2)
        policies = (
            obj.policies.select_related(
                "insurance_company",
                "insurance_type",
                "client",
                "insured_client",
                "sales_channel",
                "deal",
            )
            .annotate(
                payments_total=Coalesce(
                    Sum("payments__amount"),
                    Value(0),
                    output_field=decimal_field,
                ),
                payments_paid=Coalesce(
                    Sum(
                        "payments__amount",
                        filter=Q(payments__actual_date__isnull=False),
                    ),
                    Value(0),
                    output_field=decimal_field,
                ),
            )
            .order_by("-created_at")
        )
        policies = with_computed_status_flags(policies)
        return PolicySerializer(policies, many=True).data

    def _set_visible_users(self, deal: Deal, users):
        if users is None:
            return
        current_ids = set(deal.visible_users.values_list("id", flat=True))
        new_ids = {user.id for user in users}
        to_add = new_ids - current_ids
        to_remove = current_ids - new_ids

        if to_remove:
            DealViewer.objects.filter(deal=deal, user_id__in=to_remove).delete()

        if to_add:
            request = self.context.get("request")
            actor = getattr(request, "user", None)
            added_by = actor if actor and actor.is_authenticated else None
            DealViewer.objects.bulk_create(
                [
                    DealViewer(deal=deal, user_id=user_id, added_by=added_by)
                    for user_id in to_add
                ],
                ignore_conflicts=True,
            )

    def create(self, validated_data):
        visible_users = validated_data.pop("visible_users", None)
        deal = super().create(validated_data)
        self._set_visible_users(deal, visible_users)
        return deal

    def update(self, instance, validated_data):
        visible_users = validated_data.pop("visible_users", None)
        deal = super().update(instance, validated_data)
        if visible_users is not None:
            self._set_visible_users(deal, visible_users)
        return deal

    @staticmethod
    def _get_user_display(user) -> str | None:
        if not user:
            return None
        full_name = f"{user.first_name} {user.last_name}".strip()
        return full_name or user.username

    def validate_status(self, value: str) -> str:
        if value is None:
            return value
        normalized = str(value).strip().lower()
        legacy_map = {
            "on-hold": Deal.DealStatus.ON_HOLD,
            "on hold": Deal.DealStatus.ON_HOLD,
            "onhold": Deal.DealStatus.ON_HOLD,
        }
        normalized = legacy_map.get(normalized, normalized)
        if normalized not in Deal.DealStatus.values:
            raise serializers.ValidationError(
                f"Unsupported status '{value}'. Allowed: {', '.join(Deal.DealStatus.values)}."
            )
        return normalized


class DealMergeSerializer(serializers.Serializer):
    """Валидация данных для объединения сделок."""

    target_deal_id = serializers.UUIDField(
        help_text="ID сделки, в которую перенесутся все связанные записи."
    )
    source_deal_ids = serializers.ListField(
        child=serializers.UUIDField(),
        allow_empty=False,
        help_text="Список ID сделок, которые будут объединены в целевую.",
    )

    final_deal = serializers.DictField(
        child=serializers.JSONField(allow_null=True),
        required=True,
        help_text="Итоговые поля новой объединенной сделки.",
    )
    include_deleted = serializers.BooleanField(
        required=False,
        default=True,
        help_text="Учитывать soft-deleted связанные записи.",
    )
    preview_snapshot_id = serializers.CharField(
        required=False,
        allow_blank=True,
        help_text="Идентификатор снапшота предпросмотра.",
    )

    def validate(self, attrs):
        target_id = attrs["target_deal_id"]
        source_ids = attrs["source_deal_ids"]
        if target_id in source_ids:
            raise serializers.ValidationError(
                "Целевая сделка не может быть частью списка исходных."
            )
        if len(source_ids) != len(set(source_ids)):
            raise serializers.ValidationError(
                "Список исходных сделок содержит дубликаты."
            )
        return attrs


class DealMergePreviewSerializer(serializers.Serializer):
    target_deal_id = serializers.UUIDField(
        help_text="ID сделки, в которую перенесутся все связанные записи."
    )
    source_deal_ids = serializers.ListField(
        child=serializers.UUIDField(),
        allow_empty=False,
        help_text="Список ID сделок, которые будут объединены в целевую.",
    )
    include_deleted = serializers.BooleanField(
        required=False,
        default=True,
        help_text="Учитывать soft-deleted связанные записи.",
    )

    def validate(self, attrs):
        target_id = attrs["target_deal_id"]
        source_ids = attrs["source_deal_ids"]
        if target_id in source_ids:
            raise serializers.ValidationError(
                "Целевая сделка не может быть частью списка исходных."
            )
        if len(source_ids) != len(set(source_ids)):
            raise serializers.ValidationError(
                "Список исходных сделок содержит дубликаты."
            )
        return attrs


class DealSimilarSerializer(serializers.Serializer):
    target_deal_id = serializers.UUIDField(
        help_text="ID сделки, для которой ищутся похожие."
    )
    limit = serializers.IntegerField(
        required=False,
        default=30,
        min_value=1,
        max_value=100,
        help_text="Максимальное количество кандидатов в выдаче.",
    )
    include_self = serializers.BooleanField(
        required=False,
        default=False,
        help_text="Включать ли целевую сделку в список кандидатов.",
    )
    include_closed = serializers.BooleanField(
        required=False,
        default=False,
        help_text="Включать ли закрытые сделки (won/lost).",
    )
    include_deleted = serializers.BooleanField(
        required=False,
        default=False,
        help_text="Включать ли soft-deleted сделки.",
    )
