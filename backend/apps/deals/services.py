from __future__ import annotations

import logging
import time
from datetime import date, datetime
from typing import Sequence

from apps.chat.models import ChatMessage
from apps.clients.models import Client
from apps.common.drive import (
    DriveError,
    delete_drive_folder,
    ensure_deal_folder,
    move_drive_folder_contents,
)
from apps.documents.models import Document
from apps.finances.models import Payment
from apps.notes.models import Note
from apps.policies.models import Policy
from apps.tasks.models import Task
from apps.users.models import User
from django.db import transaction

from .models import Deal, DealPin, DealTimeTick, DealViewer, Quote

logger = logging.getLogger(__name__)
_DRIVE_RETRY_ATTEMPTS = 3
_DRIVE_RETRY_DELAY_SECONDS = 0.5


def _retry_drive_operation(action, *, description: str):
    last_error: DriveError | None = None
    for attempt in range(1, _DRIVE_RETRY_ATTEMPTS + 1):
        try:
            return action()
        except DriveError as exc:
            last_error = exc
            if attempt < _DRIVE_RETRY_ATTEMPTS:
                logger.warning(
                    "Drive operation failed (%s). Attempt %s/%s.",
                    description,
                    attempt,
                    _DRIVE_RETRY_ATTEMPTS,
                )
                time.sleep(_DRIVE_RETRY_DELAY_SECONDS * attempt)
                continue
            logger.exception(
                "Drive operation failed after %s attempts (%s).",
                _DRIVE_RETRY_ATTEMPTS,
                description,
            )
            raise
    if last_error:
        raise last_error


class DealMergeService:
    """Service that relocates related objects when deals are merged."""

    _RELATED_MODELS: tuple[tuple[str, type], ...] = (
        ("tasks", Task),
        ("notes", Note),
        ("documents", Document),
        ("policies", Policy),
        ("payments", Payment),
        ("quotes", Quote),
        ("chat_messages", ChatMessage),
    )

    def __init__(
        self,
        *,
        target_deal: Deal,
        source_deals: Sequence[Deal],
        final_deal_data: dict | None = None,
        actor: User | None = None,
        include_deleted: bool = True,
    ) -> None:
        if not source_deals:
            raise ValueError("At least one source deal is required to merge deals.")
        self.target_deal = target_deal
        self.source_deals = list(source_deals)
        self.actor = actor
        self.final_deal_data = final_deal_data or {}
        self.include_deleted = include_deleted
        self._source_ids = [deal.pk for deal in self.source_deals]
        self._all_merge_ids = [self.target_deal.pk, *self._source_ids]
        self._all_deals = [self.target_deal, *self.source_deals]

    def _get_earliest_date(self, field_name: str) -> date | None:
        values: list[date] = []
        for deal in self._all_deals:
            value = getattr(deal, field_name, None)
            if not value:
                continue
            if isinstance(value, datetime):
                values.append(value.date())
            elif isinstance(value, date):
                values.append(value)
        if not values:
            return None
        return min(values)

    def _get_combined_description(self) -> str:
        parts: list[str] = []
        for deal in self._all_deals:
            text = (deal.description or "").strip()
            if text:
                parts.append(text)
        return "\n".join(parts)

    def _manager_for(self, model):
        base_manager = getattr(model, "objects", None)
        with_deleted = getattr(base_manager, "with_deleted", None)
        if self.include_deleted and callable(with_deleted):
            return with_deleted()
        return base_manager

    def build_preview(self) -> dict:
        moved_counts: dict[str, int] = {}
        items: dict[str, list[dict]] = {}
        for alias, model in self._RELATED_MODELS:
            manager = self._manager_for(model)
            queryset = manager.filter(deal_id__in=self._all_merge_ids)
            moved_counts[alias] = queryset.count()
            items[alias] = [
                {
                    "id": str(record["id"]),
                    "deleted_at": record.get("deleted_at"),
                }
                for record in queryset.values("id", "deleted_at")[:200]
            ]

        merged_pinned_user_ids = set(
            DealPin.objects.filter(deal_id__in=self._all_merge_ids).values_list(
                "user_id", flat=True
            )
        )
        merged_viewer_ids = set(
            DealViewer.objects.filter(deal_id__in=self._all_merge_ids).values_list(
                "user_id", flat=True
            )
        )
        merged_time_seconds = (
            DealTimeTick.objects.filter(deal_id__in=self._all_merge_ids)
            .values_list("seconds", flat=True)
            .iterator()
        )

        warnings: list[str] = []
        if not self.target_deal.drive_folder_id:
            warnings.append(
                "У целевой сделки нет папки Drive. Она будет создана при merge."
            )

        drive_plan = [
            {
                "source_deal_id": str(deal.id),
                "source_folder_id": deal.drive_folder_id,
                "target_folder_id": self.target_deal.drive_folder_id,
                "will_move": bool(deal.drive_folder_id),
            }
            for deal in self.source_deals
        ]

        return {
            "target_deal_id": str(self.target_deal.id),
            "source_deal_ids": [str(deal.id) for deal in self.source_deals],
            "include_deleted": self.include_deleted,
            "resulting_client_id": str(self.target_deal.client_id),
            "moved_counts": moved_counts,
            "items": items,
            "warnings": warnings,
            "drive_plan": drive_plan,
            "final_deal_draft": {
                "title": self.target_deal.title,
                "description": self._get_combined_description(),
                "client_id": str(self.target_deal.client_id),
                "expected_close": self._get_earliest_date("expected_close"),
                "executor_id": (
                    str(self.target_deal.executor_id)
                    if self.target_deal.executor_id
                    else None
                ),
                "seller_id": (
                    str(self.target_deal.seller_id)
                    if self.target_deal.seller_id
                    else None
                ),
                "source": self.target_deal.source or "",
                "next_contact_date": self._get_earliest_date("next_contact_date"),
                "visible_user_ids": [
                    str(value)
                    for value in self.target_deal.visible_users.values_list(
                        "id", flat=True
                    )
                ],
            },
            "service_rules_preview": {
                "pin_will_be_set": bool(merged_pinned_user_ids),
                "visible_users_count_after": len(merged_viewer_ids),
                "time_ticks_seconds_after": sum(merged_time_seconds),
            },
        }

    def merge(self) -> dict:
        """Merge related objects from target+source deals into a new deal."""

        moved_counts: dict[str, int] = {}

        # Drive-first: если упадем на Drive, транзакция БД не стартует.
        self._prepare_drive_folders(self.target_deal.client)

        with transaction.atomic():
            result_deal = Deal.objects.create(
                title=self.final_deal_data.get("title") or self.target_deal.title,
                description=self.final_deal_data.get("description", ""),
                client_id=self.target_deal.client_id,
                seller_id=(
                    self.final_deal_data.get("seller_id") or self.target_deal.seller_id
                ),
                executor_id=self.final_deal_data.get("executor_id"),
                status=Deal.DealStatus.OPEN,
                stage_name=self.target_deal.stage_name or "",
                expected_close=self.final_deal_data.get("expected_close"),
                next_contact_date=self.final_deal_data.get("next_contact_date"),
                next_review_date=self.target_deal.next_review_date,
                source=self.final_deal_data.get("source") or "",
                loss_reason="",
                closing_reason="",
                drive_folder_id=self.target_deal.drive_folder_id,
            )

            for alias, model in self._RELATED_MODELS:
                manager = self._manager_for(model)
                # Важно: при merge сделок переносим только связь с deal.
                # Поля Policy.client / Policy.insured_client не изменяем,
                # т.к. страхователь полиса может отличаться от контактного лица сделки.
                moved_counts[alias] = manager.filter(
                    deal_id__in=self._all_merge_ids
                ).update(deal=result_deal)

            pinned_user_ids = set(
                DealPin.objects.filter(deal_id__in=self._all_merge_ids).values_list(
                    "user_id", flat=True
                )
            )
            DealPin.objects.filter(deal_id__in=self._all_merge_ids).delete()
            DealPin.objects.bulk_create(
                [
                    DealPin(user_id=user_id, deal=result_deal)
                    for user_id in pinned_user_ids
                ],
                ignore_conflicts=True,
            )
            moved_counts["deal_pins"] = len(pinned_user_ids)

            viewer_user_ids = set(
                DealViewer.objects.filter(deal_id__in=self._all_merge_ids).values_list(
                    "user_id", flat=True
                )
            )
            for raw_user_id in self.final_deal_data.get("visible_user_ids") or []:
                try:
                    viewer_user_ids.add(int(raw_user_id))
                except (TypeError, ValueError):
                    continue
            normalized_viewer_ids = [value for value in viewer_user_ids if value]
            DealViewer.objects.bulk_create(
                [
                    DealViewer(
                        deal=result_deal,
                        user_id=user_id,
                        added_by=self.actor,
                    )
                    for user_id in normalized_viewer_ids
                ],
                ignore_conflicts=True,
            )
            moved_counts["deal_viewers"] = len(normalized_viewer_ids)

            moved_counts["time_ticks"] = DealTimeTick.objects.filter(
                deal_id__in=self._all_merge_ids
            ).update(deal=result_deal)

            for deal in [self.target_deal, *self.source_deals]:
                if self.actor:
                    deal._audit_actor = self.actor
                deal.delete()

        return {
            "result_deal": result_deal,
            "merged_deal_ids": [
                str(deal.id) for deal in [self.target_deal, *self.source_deals]
            ],
            "moved_counts": moved_counts,
        }

    def _prepare_drive_folders(self, target_client: Client | None) -> None:
        if not target_client:
            return

        _retry_drive_operation(
            lambda: ensure_deal_folder(self.target_deal),
            description=f"ensure target deal folder {self.target_deal.pk}",
        )

        target_folder_id = self.target_deal.drive_folder_id
        if not target_folder_id:
            return

        for deal in self.source_deals:
            _retry_drive_operation(
                lambda deal=deal: ensure_deal_folder(deal),
                description=f"ensure source deal folder {deal.pk}",
            )
            source_folder_id = deal.drive_folder_id
            if not source_folder_id or source_folder_id == target_folder_id:
                continue
            _retry_drive_operation(
                lambda source_folder_id=source_folder_id: move_drive_folder_contents(
                    source_folder_id, target_folder_id
                ),
                description=f"move deal folder contents from {source_folder_id}",
            )
            _retry_drive_operation(
                lambda source_folder_id=source_folder_id: delete_drive_folder(
                    source_folder_id
                ),
                description=f"delete deal folder {source_folder_id}",
            )
