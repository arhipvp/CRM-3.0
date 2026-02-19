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
from django.db.models import Q
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


class ClientSimilarityService:
    SCORE_VERSION = "v1"

    SAME_PHONE_SCORE = 70
    SAME_EMAIL_SCORE = 70
    NAME_PATRONYMIC_BIRTHDATE_SCORE = 55
    SAME_FULL_NAME_SCORE = 25
    SAME_BIRTH_DATE_ONLY_SCORE = 10
    MISSING_CONTACT_PENALTY = -10

    @staticmethod
    def _normalize_email(value: str | None) -> str:
        return (value or "").strip().lower()

    @staticmethod
    def _normalize_name(value: str | None) -> str:
        return " ".join((value or "").split()).strip().lower()

    @staticmethod
    def _name_tokens(value: str | None) -> list[str]:
        return [
            token
            for token in ClientSimilarityService._normalize_name(value).split()
            if token
        ]

    @staticmethod
    def _extract_first_and_patronymic(tokens: list[str]) -> tuple[str, str]:
        if len(tokens) >= 3:
            return tokens[1], tokens[2]
        if len(tokens) == 2:
            return tokens[0], tokens[1]
        return "", ""

    @staticmethod
    def _confidence(score: int) -> str:
        if score >= 80:
            return "high"
        if score >= 50:
            return "medium"
        return "low"

    def _candidate_window(self, target_client: Client, queryset):
        target_tokens = self._name_tokens(target_client.name)
        first_name = ""
        if len(target_tokens) >= 2:
            first_name = target_tokens[1]
        elif target_tokens:
            first_name = target_tokens[0]

        has_metadata = (
            ~Q(phone__exact="") | Q(email__isnull=False) | Q(birth_date__isnull=False)
        )
        name_hint = Q()
        if first_name:
            name_hint = Q(name__icontains=first_name)
        return queryset.filter(has_metadata | name_hint).only(
            "id",
            "name",
            "phone",
            "email",
            "birth_date",
            "notes",
            "created_at",
            "updated_at",
            "drive_folder_id",
        )

    def _score_pair(self, target_client: Client, candidate: Client) -> dict:
        target_phone = _normalize_phone(target_client.phone)
        candidate_phone = _normalize_phone(candidate.phone)
        target_email = self._normalize_email(target_client.email)
        candidate_email = self._normalize_email(candidate.email)
        target_name = self._normalize_name(target_client.name)
        candidate_name = self._normalize_name(candidate.name)
        target_tokens = self._name_tokens(target_client.name)
        candidate_tokens = self._name_tokens(candidate.name)
        target_first, target_patronymic = self._extract_first_and_patronymic(
            target_tokens
        )
        candidate_first, candidate_patronymic = self._extract_first_and_patronymic(
            candidate_tokens
        )
        same_birth_date = bool(
            target_client.birth_date
            and candidate.birth_date
            and target_client.birth_date == candidate.birth_date
        )

        score = 0
        reasons: list[str] = []
        matched_fields: dict[str, bool] = {}

        if target_phone and candidate_phone and target_phone == candidate_phone:
            score += self.SAME_PHONE_SCORE
            reasons.append("same_phone")
            matched_fields["phone"] = True

        if target_email and candidate_email and target_email == candidate_email:
            score += self.SAME_EMAIL_SCORE
            reasons.append("same_email")
            matched_fields["email"] = True

        if (
            same_birth_date
            and target_first
            and target_patronymic
            and target_first == candidate_first
            and target_patronymic == candidate_patronymic
        ):
            score += self.NAME_PATRONYMIC_BIRTHDATE_SCORE
            reasons.append("name_patronymic_birthdate_match")
            matched_fields["birth_date"] = True
            matched_fields["first_name"] = True
            matched_fields["patronymic"] = True
        elif same_birth_date:
            score += self.SAME_BIRTH_DATE_ONLY_SCORE
            reasons.append("same_birth_date_only")
            matched_fields["birth_date"] = True

        if target_name and candidate_name and target_name == candidate_name:
            score += self.SAME_FULL_NAME_SCORE
            reasons.append("same_full_name")
            matched_fields["full_name"] = True

        if (not target_phone and not target_email) or (
            not candidate_phone and not candidate_email
        ):
            score += self.MISSING_CONTACT_PENALTY
            reasons.append("phone_or_email_missing_penalty")

        score = max(0, min(100, score))

        return {
            "score": score,
            "confidence": self._confidence(score),
            "reasons": reasons,
            "matched_fields": matched_fields,
        }

    def find_similar(
        self,
        *,
        target_client: Client,
        queryset,
        limit: int = 50,
        include_self: bool = False,
    ) -> dict:
        base_queryset = queryset
        if not include_self:
            base_queryset = base_queryset.exclude(pk=target_client.pk)
        candidates_queryset = self._candidate_window(target_client, base_queryset)
        candidates = list(candidates_queryset)

        scored = []
        for candidate in candidates:
            score_result = self._score_pair(target_client, candidate)
            if score_result["score"] <= 0:
                continue
            scored.append(
                {
                    "client": candidate,
                    "score": score_result["score"],
                    "confidence": score_result["confidence"],
                    "reasons": score_result["reasons"],
                    "matched_fields": score_result["matched_fields"],
                }
            )

        scored.sort(
            key=lambda item: (
                -int(item["score"]),
                str(getattr(item["client"], "name", "")).lower(),
            )
        )
        limited = scored[:limit]
        return {
            "candidates": limited,
            "meta": {
                "total_checked": len(candidates),
                "returned": len(limited),
                "scoring_version": self.SCORE_VERSION,
            },
        }
