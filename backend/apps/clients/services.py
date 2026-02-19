from __future__ import annotations

import logging
import re
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
from django.utils import timezone

from .models import Client

logger = logging.getLogger(__name__)
_DRIVE_RETRY_ATTEMPTS = 3
_DRIVE_RETRY_DELAY_SECONDS = 0.5


def _normalize_phone(value: str) -> str:
    return re.sub(r"\D+", "", value or "")


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
        include_deleted: bool = True,
        field_overrides: dict | None = None,
    ) -> None:
        if not source_clients:
            raise ValueError("At least one source client is required to merge.")
        self.target_client = target_client
        self.source_clients = list(source_clients)
        self.actor = actor
        self.include_deleted = include_deleted
        self.field_overrides = field_overrides or {}

    def _deal_manager(self):
        return Deal.objects.with_deleted() if self.include_deleted else Deal.objects

    def _policy_manager(self):
        return Policy.objects.with_deleted() if self.include_deleted else Policy.objects

    def _normalized(self, value: str | None) -> str:
        return " ".join((value or "").split()).strip().lower()

    def build_preview(self) -> dict:
        source_ids = [client.id for client in self.source_clients]
        deal_manager = self._deal_manager()
        policy_manager = self._policy_manager()

        deals = list(
            deal_manager.filter(client_id__in=source_ids).values(
                "id", "title", "client_id", "deleted_at"
            )
        )
        primary_policies = list(
            policy_manager.filter(client_id__in=source_ids).values(
                "id", "number", "deal_id", "client_id", "deleted_at"
            )
        )
        insured_policies = list(
            policy_manager.filter(insured_client_id__in=source_ids).values(
                "id", "number", "deal_id", "insured_client_id", "deleted_at"
            )
        )

        warnings: list[str] = []
        candidate_names = {
            (client.name or "").strip()
            for client in [self.target_client, *self.source_clients]
        }
        normalized_names = {
            self._normalized(value) for value in candidate_names if value
        }
        if len(normalized_names) > 1:
            warnings.append(
                "Обнаружены разные варианты ФИО. Проверьте итоговое имя в предпросмотре."
            )

        phones = {
            _normalize_phone(client.phone or "")
            for client in [self.target_client, *self.source_clients]
            if client.phone
        }
        if len(phones) > 1:
            warnings.append("Телефоны у дублей отличаются. Проверьте итоговый телефон.")

        emails = {
            (client.email or "").strip().lower()
            for client in [self.target_client, *self.source_clients]
            if client.email
        }
        if len(emails) > 1:
            warnings.append("Email у дублей отличается. Проверьте итоговый email.")

        drive_plan: list[dict] = []
        for source in self.source_clients:
            drive_plan.append(
                {
                    "source_client_id": str(source.id),
                    "source_folder_id": source.drive_folder_id,
                    "target_folder_id": self.target_client.drive_folder_id,
                    "will_move": bool(source.drive_folder_id),
                }
            )

        return {
            "target_client_id": str(self.target_client.id),
            "source_client_ids": [str(client.id) for client in self.source_clients],
            "include_deleted": self.include_deleted,
            "preview_snapshot_id": f"client-merge-preview-{timezone.now().isoformat()}",
            "moved_counts": {
                "deals": len(deals),
                "policies_primary": len(primary_policies),
                "policies_insured": len(insured_policies),
                "policies_unique": len(
                    {str(item["id"]) for item in [*primary_policies, *insured_policies]}
                ),
            },
            "items": {
                "deals": [
                    {
                        "id": str(item["id"]),
                        "title": item.get("title") or "",
                        "deleted_at": item.get("deleted_at"),
                    }
                    for item in deals
                ],
                "policies_primary": [
                    {
                        "id": str(item["id"]),
                        "number": item.get("number") or "",
                        "deal_id": (
                            str(item["deal_id"]) if item.get("deal_id") else None
                        ),
                        "deleted_at": item.get("deleted_at"),
                    }
                    for item in primary_policies
                ],
                "policies_insured": [
                    {
                        "id": str(item["id"]),
                        "number": item.get("number") or "",
                        "deal_id": (
                            str(item["deal_id"]) if item.get("deal_id") else None
                        ),
                        "deleted_at": item.get("deleted_at"),
                    }
                    for item in insured_policies
                ],
            },
            "canonical_profile": {
                "name": (self.target_client.name or "").strip(),
                "phone": self.target_client.phone or "",
                "email": self.target_client.email,
                "notes": self.target_client.notes or "",
                "candidates": {
                    "names": sorted([value for value in candidate_names if value]),
                    "phones": sorted([value for value in phones if value]),
                    "emails": sorted([value for value in emails if value]),
                },
            },
            "drive_plan": drive_plan,
            "warnings": warnings,
        }

    def _apply_field_overrides(self) -> None:
        name = self.field_overrides.get("name")
        if name is not None:
            self.target_client.name = str(name).strip()
        if not (self.target_client.name or "").strip():
            raise ValueError("Итоговое имя клиента не может быть пустым.")

        if "phone" in self.field_overrides:
            self.target_client.phone = str(
                self.field_overrides.get("phone") or ""
            ).strip()
        if "email" in self.field_overrides:
            email = self.field_overrides.get("email")
            normalized = str(email).strip() if email is not None else ""
            self.target_client.email = normalized or None
        if "notes" in self.field_overrides:
            self.target_client.notes = str(self.field_overrides.get("notes") or "")

    def _prepare_drive_folders(
        self, source_deal_ids_by_client: dict[str, list[str]]
    ) -> None:
        target_folder_id = _retry_drive_operation(
            lambda: ensure_client_folder(self.target_client),
            description=f"ensure client folder for {self.target_client.pk}",
        )

        for source in self.source_clients:
            source_deal_ids = source_deal_ids_by_client.get(str(source.id), [])
            if source_deal_ids:
                self._ensure_deal_folders(source_deal_ids)

            if target_folder_id and source.drive_folder_id:
                _retry_drive_operation(
                    lambda source_folder_id=source.drive_folder_id: move_drive_folder_contents(
                        source_folder_id, target_folder_id
                    ),
                    description=f"move client folder contents from {source.pk}",
                )
                _retry_drive_operation(
                    lambda source_folder_id=source.drive_folder_id: delete_drive_folder(
                        source_folder_id
                    ),
                    description=f"delete client folder for {source.pk}",
                )

    def merge(self) -> dict:
        self._apply_field_overrides()

        deal_manager = self._deal_manager()
        policy_manager = self._policy_manager()
        moved_counts = {"deals": 0, "policies": 0}
        source_deal_ids_by_client: dict[str, list[str]] = {}
        for source in self.source_clients:
            source_deal_ids = list(
                deal_manager.filter(client_id=source.id).values_list("id", flat=True)
            )
            source_deal_ids_by_client[str(source.id)] = [
                str(item) for item in source_deal_ids
            ]

        # Drive-first: если здесь упадём, в БД изменений не будет.
        self._prepare_drive_folders(source_deal_ids_by_client)

        merged_ids: list[str] = []
        with transaction.atomic():
            self.target_client.save()

            for source in self.source_clients:
                source_deal_qs = deal_manager.filter(client_id=source.id)
                source_deal_ids = list(source_deal_qs.values_list("id", flat=True))
                deals_moved = source_deal_qs.update(client=self.target_client)
                moved_counts["deals"] += deals_moved

                updated_policy_ids: set[str] = set()
                if source_deal_ids:
                    deal_policy_ids = list(
                        policy_manager.filter(deal_id__in=source_deal_ids).values_list(
                            "id", flat=True
                        )
                    )
                    if deal_policy_ids:
                        policy_manager.filter(id__in=deal_policy_ids).update(
                            client=self.target_client
                        )
                        updated_policy_ids.update(deal_policy_ids)

                insured_policy_ids = list(
                    policy_manager.filter(insured_client_id=source.id).values_list(
                        "id", flat=True
                    )
                )
                if insured_policy_ids:
                    policy_manager.filter(id__in=insured_policy_ids).update(
                        insured_client=self.target_client
                    )
                    updated_policy_ids.update(insured_policy_ids)

                moved_counts["policies"] += len(updated_policy_ids)

                if self.actor:
                    source._audit_actor = self.actor
                source.delete()
                merged_ids.append(str(source.id))

        return {
            "target_client": self.target_client,
            "merged_client_ids": merged_ids,
            "moved_counts": moved_counts,
            "warnings": [],
            "details": {
                "include_deleted": self.include_deleted,
                "field_overrides": self.field_overrides,
            },
        }

    def _ensure_deal_folders(self, deal_ids: Sequence[str]) -> None:
        deals = self._deal_manager().filter(id__in=deal_ids)
        for deal in deals:
            _retry_drive_operation(
                lambda deal=deal: ensure_deal_folder(deal),
                description=f"ensure deal folder for {deal.pk}",
            )
