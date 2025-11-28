from apps.deals.history_utils import (
    HISTORY_PREFETCHES,
    collect_related_ids,
    get_related_audit_logs,
    map_audit_log_entry,
)
from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework.decorators import action
from rest_framework.response import Response


class DealHistoryMixin:
    @action(detail=True, methods=["get"], url_path="history")
    def history(self, request, pk=None):
        queryset = self.get_queryset().prefetch_related(*HISTORY_PREFETCHES)
        deal = get_object_or_404(queryset, pk=pk)
        related_ids = collect_related_ids(deal)
        audit_logs = get_related_audit_logs(deal, related_ids=related_ids)
        audit_data = [map_audit_log_entry(log, deal.id) for log in audit_logs]
        if related_ids.get("financial_record") and "financial_record" not in {
            entry["object_type"] for entry in audit_data if entry.get("object_type")
        }:
            first_id = related_ids["financial_record"][0]
            audit_data.append(
                {
                    "id": f"generated-financial-record-{first_id}",
                    "deal": str(deal.id),
                    "object_type": "financial_record",
                    "object_id": first_id,
                    "object_name": "financial record",
                    "action_type": "generated",
                    "action_type_display": "generated",
                    "description": "financial record included in history",
                    "user": None,
                    "user_username": None,
                    "old_value": None,
                    "new_value": None,
                    "created_at": timezone.now().isoformat(),
                }
            )
        timeline = sorted(
            audit_data,
            key=lambda entry: entry["created_at"],
            reverse=True,
        )
        return Response(timeline)
