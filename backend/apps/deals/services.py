from __future__ import annotations

import logging
import time
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

from .models import Deal, Quote

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
        resulting_client: Client | None = None,
        actor: User | None = None,
        include_deleted: bool = True,
    ) -> None:
        if not source_deals:
            raise ValueError("At least one source deal is required to merge deals.")
        self.target_deal = target_deal
        self.source_deals = list(source_deals)
        self.actor = actor
        self.resulting_client = resulting_client
        self.include_deleted = include_deleted
        self._source_ids = [deal.pk for deal in self.source_deals]

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
            queryset = manager.filter(deal_id__in=self._source_ids)
            moved_counts[alias] = queryset.count()
            items[alias] = [
                {
                    "id": str(record["id"]),
                    "deleted_at": record.get("deleted_at"),
                }
                for record in queryset.values("id", "deleted_at")[:200]
            ]

        client_ids = {
            str(deal.client_id) for deal in [self.target_deal, *self.source_deals]
        }
        warnings: list[str] = []
        if len(client_ids) > 1 and not self.resulting_client:
            warnings.append(
                "У объединяемых сделок разные клиенты. Укажите итогового клиента."
            )
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
            "resulting_client_id": (
                str(self.resulting_client.id)
                if self.resulting_client
                else (
                    str(self.target_deal.client_id)
                    if self.target_deal.client_id
                    else None
                )
            ),
            "moved_counts": moved_counts,
            "items": items,
            "warnings": warnings,
            "drive_plan": drive_plan,
        }

    def merge(self) -> dict:
        """Merge related objects from source deals into the target deal."""

        moved_counts: dict[str, int] = {}
        target_client = self.resulting_client or getattr(
            self.target_deal, "client", None
        )

        # Drive-first: если упадем на Drive, транзакция БД не стартует.
        self._prepare_drive_folders(target_client)

        with transaction.atomic():
            if target_client and self.target_deal.client_id != target_client.id:
                self.target_deal.client = target_client
                self.target_deal.save(update_fields=["client"])

            for alias, model in self._RELATED_MODELS:
                manager = self._manager_for(model)
                moved_counts[alias] = manager.filter(
                    deal_id__in=self._source_ids
                ).update(deal=self.target_deal)

            for deal in self.source_deals:
                if self.actor:
                    deal._audit_actor = self.actor
                deal.delete()

        return {
            "merged_deal_ids": [str(deal.id) for deal in self.source_deals],
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
