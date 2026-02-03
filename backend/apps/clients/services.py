from __future__ import annotations

import logging
import time
from typing import Sequence

from apps.common.drive import (
    DriveError,
    delete_drive_folder,
    ensure_client_folder,
    ensure_deal_folder,
    move_drive_folder_contents,
)
from apps.deals.models import Deal
from apps.policies.models import Policy
from apps.users.models import User
from django.db import transaction

from .models import Client

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
        target_folder_id = _retry_drive_operation(
            lambda: ensure_client_folder(self.target_client),
            description=f"ensure client folder for {self.target_client.pk}",
        )

        merged_ids: list[str] = []
        with transaction.atomic():
            for source in self.source_clients:
                source_deal_qs = Deal.objects.filter(client_id=source.id)
                source_deal_ids = list(source_deal_qs.values_list("id", flat=True))
                deals_moved = source_deal_qs.update(client=self.target_client)
                moved_counts["deals"] += deals_moved
                if source_deal_ids:
                    self._ensure_deal_folders(source_deal_ids)

                updated_policy_ids: set[str] = set()
                if source_deal_ids:
                    deal_policy_ids = list(
                        Policy.objects.filter(deal_id__in=source_deal_ids).values_list(
                            "id", flat=True
                        )
                    )
                    if deal_policy_ids:
                        Policy.objects.filter(id__in=deal_policy_ids).update(
                            client=self.target_client
                        )
                        updated_policy_ids.update(deal_policy_ids)

                insured_policy_ids = list(
                    Policy.objects.filter(insured_client_id=source.id).values_list(
                        "id", flat=True
                    )
                )
                if insured_policy_ids:
                    Policy.objects.filter(id__in=insured_policy_ids).update(
                        insured_client=self.target_client
                    )
                    updated_policy_ids.update(insured_policy_ids)

                moved_counts["policies"] += len(updated_policy_ids)

                if target_folder_id and source.drive_folder_id:
                    _retry_drive_operation(
                        lambda: move_drive_folder_contents(
                            source.drive_folder_id, target_folder_id
                        ),
                        description=f"move client folder contents from {source.pk}",
                    )
                    _retry_drive_operation(
                        lambda: delete_drive_folder(source.drive_folder_id),
                        description=f"delete client folder for {source.pk}",
                    )

                if self.actor:
                    source._audit_actor = self.actor
                source.delete()
                merged_ids.append(str(source.id))

        return {
            "target_client": self.target_client,
            "merged_client_ids": merged_ids,
            "moved_counts": moved_counts,
        }

    def _ensure_deal_folders(self, deal_ids: Sequence[str]) -> None:
        deals = Deal.objects.filter(id__in=deal_ids)
        for deal in deals:
            _retry_drive_operation(
                lambda deal=deal: ensure_deal_folder(deal),
                description=f"ensure deal folder for {deal.pk}",
            )
