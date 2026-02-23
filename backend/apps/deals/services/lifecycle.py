from __future__ import annotations

from apps.deals.models import Deal
from rest_framework import status
from rest_framework.response import Response

CLOSED_STATUSES = {Deal.DealStatus.WON, Deal.DealStatus.LOST}


def close_deal(*, deal: Deal, reason: str, status_value: str) -> Response | None:
    if deal.status in CLOSED_STATUSES:
        return Response(
            {"detail": "Deal is already closed."},
            status=status.HTTP_400_BAD_REQUEST,
        )

    normalized_status = str(status_value or Deal.DealStatus.WON).lower()
    if normalized_status not in CLOSED_STATUSES:
        return Response(
            {"status": "Status must be either 'won' or 'lost'."},
            status=status.HTTP_400_BAD_REQUEST,
        )

    closing_reason = str(reason or "").strip()
    if not closing_reason:
        return Response(
            {"reason": "Reason is required when closing a deal."},
            status=status.HTTP_400_BAD_REQUEST,
        )

    deal.status = normalized_status
    deal.closing_reason = closing_reason
    deal.save(update_fields=["status", "closing_reason"])
    return None


def reopen_deal(*, deal: Deal) -> Response | None:
    if deal.status not in CLOSED_STATUSES:
        return Response(
            {"detail": "Only closed deals can be reopened."},
            status=status.HTTP_400_BAD_REQUEST,
        )

    deal.status = Deal.DealStatus.OPEN
    deal.closing_reason = ""
    deal.save(update_fields=["status", "closing_reason"])
    return None
