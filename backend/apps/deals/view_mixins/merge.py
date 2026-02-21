from apps.common.drive import DriveError
from apps.deals.models import Deal
from apps.deals.serializers import DealMergePreviewSerializer, DealMergeSerializer
from apps.deals.services import DealMergeService
from apps.users.models import AuditLog
from rest_framework import status
from rest_framework.decorators import action
from rest_framework.exceptions import PermissionDenied, ValidationError
from rest_framework.response import Response


class DealMergeMixin:
    @action(detail=False, methods=["post"], url_path="merge/preview")
    def merge_preview(self, request):
        serializer = DealMergePreviewSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        target_deal, source_deals = self._resolve_deals_for_merge(
            serializer.validated_data
        )
        include_deleted = serializer.validated_data.get("include_deleted", True)

        for deal in (target_deal, *source_deals):
            if not hasattr(self, "_can_merge") or not self._can_merge(
                request.user, deal
            ):
                raise PermissionDenied("Only deal owner or admin can merge deals.")

        preview = DealMergeService(
            target_deal=target_deal,
            source_deals=source_deals,
            include_deleted=include_deleted,
        ).build_preview()
        return Response(preview)

    @action(detail=False, methods=["post"], url_path="merge")
    def merge(self, request):
        serializer = DealMergeSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        target_deal, source_deals = self._resolve_deals_for_merge(
            serializer.validated_data
        )
        final_deal_data = self._validate_final_deal_payload(
            serializer.validated_data.get("final_deal") or {},
            target_deal=target_deal,
        )
        include_deleted = serializer.validated_data.get("include_deleted", True)
        preview_snapshot_id = serializer.validated_data.get("preview_snapshot_id", "")
        for deal in (target_deal, *source_deals):
            if not hasattr(self, "_can_merge") or not self._can_merge(
                request.user, deal
            ):
                raise PermissionDenied("Only deal owner or admin can merge deals.")

        actor = request.user if request.user and request.user.is_authenticated else None
        try:
            merge_result = DealMergeService(
                target_deal=target_deal,
                source_deals=source_deals,
                final_deal_data=final_deal_data,
                actor=actor,
                include_deleted=include_deleted,
            ).merge()
        except DriveError as exc:
            return Response(
                {
                    "detail": str(exc),
                    "warning": (
                        "Ошибка Google Drive: часть папок могла быть не перенесена."
                    ),
                },
                status=status.HTTP_503_SERVICE_UNAVAILABLE,
            )

        source_titles = sorted({deal.title for deal in source_deals})
        result_deal = merge_result["result_deal"]
        AuditLog.objects.create(
            actor=actor,
            object_type="deal",
            object_id=str(result_deal.id),
            object_name=result_deal.title,
            action="merge",
            description=(
                f"Merged deals ({', '.join(source_titles)}, {target_deal.title}) into '{result_deal.title}'"
            ),
            new_value={
                "merged_deals": merge_result["merged_deal_ids"],
                "moved_counts": merge_result["moved_counts"],
                "preview_snapshot_id": preview_snapshot_id or None,
                "include_deleted": include_deleted,
                "new_deal_id": str(result_deal.id),
                "same_client_enforced": True,
                "final_deal": final_deal_data,
            },
        )

        refreshed_result = self._base_queryset().filter(pk=result_deal.pk).first()
        result_instance = refreshed_result or result_deal
        return Response(
            {
                "result_deal": self.get_serializer(result_instance).data,
                "merged_deal_ids": merge_result["merged_deal_ids"],
                "moved_counts": merge_result["moved_counts"],
                "warnings": merge_result.get("warnings", []),
                "details": {
                    "include_deleted": include_deleted,
                    "new_deal_id": str(result_deal.id),
                    "same_client_enforced": True,
                },
            }
        )

    def _resolve_deals_for_merge(self, data):
        target_id = str(data["target_deal_id"])
        source_ids = [str(value) for value in data["source_deal_ids"]]
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
        for deal in source_deals:
            if deal.deleted_at is not None:
                raise ValidationError(
                    {"source_deal_ids": "Source deals must not be deleted."}
                )
            if deal.client_id != target_deal.client_id:
                raise ValidationError(
                    {
                        "source_deal_ids": (
                            "Можно объединять только сделки одного клиента."
                        )
                    }
                )
        return target_deal, source_deals

    def _validate_final_deal_payload(self, final_deal, *, target_deal):
        title = str(final_deal.get("title") or "").strip()
        if not title:
            raise ValidationError(
                {"final_deal": {"title": "Название итоговой сделки обязательно."}}
            )

        client_id = str(final_deal.get("client_id") or "").strip()
        if client_id and client_id != str(target_deal.client_id):
            raise ValidationError(
                {
                    "final_deal": {
                        "client_id": (
                            "Итоговая сделка должна сохранять исходного клиента."
                        )
                    }
                }
            )

        return {
            "title": title,
            "description": str(final_deal.get("description") or "").strip(),
            "client_id": target_deal.client_id,
            "expected_close": (final_deal.get("expected_close") or None),
            "executor_id": (final_deal.get("executor_id") or None),
            "seller_id": (final_deal.get("seller_id") or target_deal.seller_id),
            "source": str(final_deal.get("source") or "").strip(),
            "next_contact_date": (final_deal.get("next_contact_date") or None),
            "visible_user_ids": [
                str(user_id)
                for user_id in (final_deal.get("visible_user_ids") or [])
                if str(user_id).strip()
            ],
        }
