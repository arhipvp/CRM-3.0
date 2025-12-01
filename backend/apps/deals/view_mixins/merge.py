from apps.clients.models import Client
from apps.deals.models import Deal
from apps.deals.serializers import DealMergeSerializer
from apps.deals.services import DealMergeService
from apps.users.models import AuditLog
from rest_framework.decorators import action
from rest_framework.exceptions import PermissionDenied, ValidationError
from rest_framework.response import Response


class DealMergeMixin:
    @action(detail=False, methods=["post"], url_path="merge")
    def merge(self, request):
        serializer = DealMergeSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        target_id = str(serializer.validated_data["target_deal_id"])
        source_ids = [
            str(value) for value in serializer.validated_data["source_deal_ids"]
        ]
        combined_ids = {target_id, *source_ids}

        deals_qs = (
            Deal.objects.with_deleted()
            .select_related("client")
            .filter(id__in=combined_ids)
        )
        deals = list(deals_qs)
        if len(deals) != len(combined_ids):
            found_ids = {str(deal.id) for deal in deals}
            missing = sorted(combined_ids - found_ids)
            raise ValidationError(
                {"detail": f"Some deals were not found: {', '.join(missing)}"}
            )

        deals_by_id = {str(deal.id): deal for deal in deals}
        target_deal = deals_by_id.get(target_id)
        if not target_deal:
            raise ValidationError({"target_deal_id": "Target deal not found."})
        if target_deal.deleted_at is not None:
            raise ValidationError({"target_deal_id": "Target deal is deleted."})

        source_deals = [deals_by_id[source_id] for source_id in source_ids]
        resulting_client_id = serializer.validated_data.get("resulting_client_id")
        resulting_client = None
        if resulting_client_id:
            resulting_client = Client.objects.filter(id=resulting_client_id).first()
            if not resulting_client:
                raise ValidationError({"resulting_client_id": "Client not found."})
        elif target_deal.client:
            resulting_client = target_deal.client
        for deal in source_deals:
            if deal.deleted_at is not None:
                raise ValidationError(
                    {"source_deal_ids": "Source deals must not be deleted."}
                )
        for deal in (target_deal, *source_deals):
            if not hasattr(self, "_can_merge") or not self._can_merge(
                request.user, deal
            ):
                raise PermissionDenied("Only deal owner or admin can merge deals.")

        actor = request.user if request.user and request.user.is_authenticated else None
        merge_result = DealMergeService(
            target_deal=target_deal,
            source_deals=source_deals,
            resulting_client=resulting_client,
            actor=actor,
        ).merge()

        source_titles = sorted({deal.title for deal in source_deals})
        AuditLog.objects.create(
            actor=actor,
            object_type="deal",
            object_id=str(target_deal.id),
            object_name=target_deal.title,
            action="merge",
            description=(
                f"Merged deals ({', '.join(source_titles)}) into '{target_deal.title}'"
            ),
            new_value={
                "merged_deals": merge_result["merged_deal_ids"],
                "moved_counts": merge_result["moved_counts"],
            },
        )

        refreshed_target = self._base_queryset().filter(pk=target_deal.pk).first()
        target_instance = refreshed_target or target_deal
        return Response(
            {
                "target_deal": self.get_serializer(target_instance).data,
                "merged_deal_ids": merge_result["merged_deal_ids"],
                "moved_counts": merge_result["moved_counts"],
            }
        )
