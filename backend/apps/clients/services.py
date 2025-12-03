from __future__ import annotations

import logging
from typing import Sequence

from apps.common.drive import (
    DriveError,
    delete_drive_folder,
    ensure_client_folder,
    move_drive_folder_contents,
)
from apps.deals.models import Deal
from apps.policies.models import Policy
from apps.users.models import User
from django.db import transaction

from .models import Client

logger = logging.getLogger(__name__)


class ClientMergeService:
    """Handles merging duplicate clients and moving related data."""

    def __init__(
        self,
        *,
        target_client: Client,
        source_clients: Sequence[Client],
        actor: User | None = None,
    ) -> None:
        if not source_clients:
            raise ValueError("At least one source client is required to merge.")
        self.target_client = target_client
        self.source_clients = list(source_clients)
        self.actor = actor

    def merge(self) -> dict:
        moved_counts = {"deals": 0, "policies": 0}
        target_folder_id: str | None = None
        try:
            target_folder_id = ensure_client_folder(self.target_client)
        except DriveError:
            logger.exception("Failed to ensure Drive folder for target client %s", self.target_client.pk)

        merged_ids: list[str] = []
        with transaction.atomic():
            for source in self.source_clients:
                source_deal_qs = Deal.objects.filter(client_id=source.id)
                source_deal_ids = list(source_deal_qs.values_list("id", flat=True))
                deals_moved = source_deal_qs.update(client=self.target_client)
                moved_counts["deals"] += deals_moved

                policies_moved = 0
                if source_deal_ids:
                    policies_moved = Policy.objects.filter(deal_id__in=source_deal_ids).update(
                        client=self.target_client
                    )
                moved_counts["policies"] += policies_moved

                if target_folder_id and source.drive_folder_id:
                    try:
                        move_drive_folder_contents(source.drive_folder_id, target_folder_id)
                        delete_drive_folder(source.drive_folder_id)
                    except DriveError:
                        logger.exception("Failed to merge Drive folder from client %s", source.pk)

                if self.actor:
                    source._audit_actor = self.actor
                source.delete()
                merged_ids.append(str(source.id))

        return {
            "target_client": self.target_client,
            "merged_client_ids": merged_ids,
            "moved_counts": moved_counts,
        }
