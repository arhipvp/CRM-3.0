from apps.deals.models import Deal
from apps.deals.permissions import is_admin_user
from apps.deals.serializers import DealSimilarSerializer
from apps.deals.services import DealSimilarityService
from django.db.models import Q
from rest_framework.decorators import action
from rest_framework.exceptions import ValidationError
from rest_framework.response import Response

_CLOSED_STATUSES = {Deal.DealStatus.WON, Deal.DealStatus.LOST}


class DealSimilarityMixin:
    @action(detail=False, methods=["post"], url_path="similar")
    def similar(self, request):
        serializer = DealSimilarSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data

        include_deleted = data.get("include_deleted", False)
        include_closed = data.get("include_closed", False)
        include_self = data.get("include_self", False)
        limit = data.get("limit", 30)

        user = request.user
        target_queryset = self._similarity_queryset(
            user=user,
            include_deleted=include_deleted,
            include_closed=True,
        )
        target_deal = target_queryset.filter(id=data["target_deal_id"]).first()
        if not target_deal:
            raise ValidationError(
                {"target_deal_id": "Сделка не найдена или недоступна."}
            )

        candidates_queryset = self._similarity_queryset(
            user=user,
            include_deleted=include_deleted,
            include_closed=include_closed,
        )
        result = DealSimilarityService().find_similar(
            target_deal=target_deal,
            queryset=candidates_queryset,
            limit=limit,
            include_self=include_self,
            include_closed=include_closed,
        )

        candidates_payload = []
        for item in result["candidates"]:
            candidates_payload.append(
                {
                    "deal": self.get_serializer(item["deal"]).data,
                    "score": item["score"],
                    "confidence": item["confidence"],
                    "reasons": item["reasons"],
                    "matched_fields": item["matched_fields"],
                    "merge_blockers": item["merge_blockers"],
                }
            )

        return Response(
            {
                "target_deal": self.get_serializer(target_deal).data,
                "candidates": candidates_payload,
                "meta": result["meta"],
            }
        )

    def _similarity_queryset(
        self, *, user, include_deleted: bool, include_closed: bool
    ):
        manager = Deal.objects.with_deleted() if include_deleted else Deal.objects
        queryset = (
            manager.select_related("client", "seller", "executor", "mailbox")
            .prefetch_related("quotes", "documents")
            .all()
        )

        if not include_closed:
            queryset = queryset.exclude(status__in=_CLOSED_STATUSES)

        if not user or not user.is_authenticated:
            return queryset
        if is_admin_user(user):
            return queryset

        access_filter = (
            Q(seller=user)
            | Q(executor=user)
            | Q(tasks__assignee=user)
            | Q(visible_users=user)
        )
        return queryset.filter(access_filter).distinct()
