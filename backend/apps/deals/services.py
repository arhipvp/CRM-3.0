from __future__ import annotations

import logging
from typing import Sequence

from apps.chat.models import ChatMessage
from apps.clients.models import Client
from apps.common.drive import (
    DriveError,
    delete_drive_folder,
    ensure_client_folder,
    ensure_deal_folder,
    move_drive_folder_contents,
    move_drive_folder_to_parent,
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
    ) -> None:
        if not source_deals:
            raise ValueError("At least one source deal is required to merge deals.")
        self.target_deal = target_deal
        self.source_deals = list(source_deals)
        self.actor = actor
        self.resulting_client = resulting_client
        self._source_ids = [deal.pk for deal in self.source_deals]
        self._source_folder_ids = [
            folder_id
            for folder_id in (deal.drive_folder_id for deal in self.source_deals)
            if folder_id
        ]

    def merge(self) -> dict:
        """Merge related objects from source deals into the target deal."""

        moved_counts: dict[str, int] = {}
        target_client = self.resulting_client or getattr(
            self.target_deal, "client", None
        )
        if target_client and self.target_deal.client_id != target_client.id:
            self.target_deal.client = target_client
            self.target_deal.save(update_fields=["client"])

        with transaction.atomic():
            for alias, model in self._RELATED_MODELS:
                moved_counts[alias] = model.objects.filter(
                    deal_id__in=self._source_ids
                ).update(deal=self.target_deal)

            self._prepare_drive_folders(target_client)

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

        target_folder_id = self.target_deal.drive_folder_id
        client_folder_id = None
        try:
            client_folder_id = ensure_client_folder(target_client)
        except DriveError:
            logger.exception(
                "Failed to ensure Drive folder for client %s", target_client.pk
            )

        if target_folder_id and client_folder_id:
            try:
                move_drive_folder_to_parent(target_folder_id, client_folder_id)
            except DriveError:
                logger.exception(
                    "Failed to move deal folder %s under client %s",
                    target_folder_id,
                    client_folder_id,
                )

        try:
            ensure_deal_folder(self.target_deal)
        except DriveError:
            logger.exception(
                "Failed to ensure Drive folder for target deal %s", self.target_deal.pk
            )

        target_folder_id = self.target_deal.drive_folder_id
        if not target_folder_id:
            return

        for source_folder_id in self._source_folder_ids:
            try:
                move_drive_folder_contents(source_folder_id, target_folder_id)
                delete_drive_folder(source_folder_id)
            except DriveError:
                logger.exception(
                    "Failed to merge Drive contents from %s into %s",
                    source_folder_id,
                    target_folder_id,
                )
