from __future__ import annotations

import logging
import re
import time
from collections import defaultdict
from typing import Sequence

from apps.common.drive import (
    DriveConfigurationError,
    DriveError,
    delete_drive_folder,
    ensure_client_folder,
    ensure_deal_folder,
    is_drive_oauth_configured,
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
    digits = re.sub(r"\D+", "", value or "")
    if len(digits) == 11 and digits.startswith("8"):
        return f"7{digits[1:]}"
    return digits


def normalize_client_name(value: str | None) -> str:
    """Return a human-readable title-cased client name."""
    compacted = " ".join((value or "").split()).strip()

    def normalize_word(match: re.Match) -> str:
        word = match.group(0)
        return word[:1].upper() + word[1:].lower()

    return re.sub(r"[A-Za-zА-Яа-яЁё]+", normalize_word, compacted)


def _compact_text(value: str | None) -> str:
    return " ".join((value or "").split()).strip()


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


def _is_drive_configuration_error(exc: BaseException) -> bool:
    current: BaseException | None = exc
    while current is not None:
        if isinstance(current, DriveConfigurationError):
            return True
        current = current.__cause__ or current.__context__
    return False


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
        self._warnings: list[str] = []

    def _deal_manager(self):
        return Deal.objects.with_deleted() if self.include_deleted else Deal.objects

    def _policy_manager(self):
        return Policy.objects.with_deleted() if self.include_deleted else Policy.objects

    def _normalized(self, value: str | None) -> str:
        return " ".join((value or "").split()).strip().lower()

    def _canonical_name(self) -> str:
        target_name = _compact_text(self.target_client.name)
        best_name = target_name
        best_length = len(target_name)
        for source in self.source_clients:
            source_name = _compact_text(source.name)
            if len(source_name) > best_length:
                best_name = source_name
                best_length = len(source_name)
        return best_name

    def _deduped_display_values(self, values: list[str], normalize) -> list[str]:
        display_values: list[str] = []
        seen: set[str] = set()
        for value in values:
            display_value = _compact_text(value)
            if not display_value:
                continue
            normalized = normalize(display_value)
            if not normalized or normalized in seen:
                continue
            seen.add(normalized)
            display_values.append(display_value)
        return sorted(display_values)

    def _canonical_contact(
        self, target_value: str | None, candidates: list[str]
    ) -> str:
        target_display = _compact_text(target_value)
        if target_display:
            return target_display
        return candidates[0] if candidates else ""

    def _alternative_contact_notes(
        self,
        *,
        canonical_phone: str,
        canonical_email: str,
    ) -> str:
        canonical_phone_normalized = _normalize_phone(canonical_phone)
        canonical_email_normalized = canonical_email.strip().lower()
        seen_phones = (
            {canonical_phone_normalized} if canonical_phone_normalized else set()
        )
        seen_emails = (
            {canonical_email_normalized} if canonical_email_normalized else set()
        )
        lines: list[str] = []

        for source in self.source_clients:
            source_name = _compact_text(source.name) or str(source.id)
            source_phone = _compact_text(source.phone)
            normalized_phone = _normalize_phone(source_phone)
            if (
                source_phone
                and normalized_phone
                and normalized_phone not in seen_phones
            ):
                seen_phones.add(normalized_phone)
                lines.append(f"- Телефон: {source_phone} ({source_name})")

            source_email = _compact_text(source.email)
            normalized_email = source_email.lower()
            if (
                source_email
                and normalized_email
                and normalized_email not in seen_emails
            ):
                seen_emails.add(normalized_email)
                lines.append(f"- Email: {source_email} ({source_name})")

        if not lines:
            return self.target_client.notes or ""

        base_notes = (self.target_client.notes or "").rstrip()
        contact_block = "\n".join(["Контакты из объединённых клиентов:", *lines])
        return (
            f"{base_notes}\n\n{contact_block}".strip() if base_notes else contact_block
        )

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
        merge_clients = [self.target_client, *self.source_clients]
        candidate_names = {_compact_text(client.name) for client in merge_clients}
        normalized_names = {
            self._normalized(value) for value in candidate_names if value
        }
        if len(normalized_names) > 1:
            warnings.append(
                "Обнаружены разные варианты ФИО. Проверьте итоговое имя в предпросмотре."
            )

        phone_values = [client.phone or "" for client in merge_clients]
        phone_candidates = self._deduped_display_values(phone_values, _normalize_phone)
        phones = {_normalize_phone(value) for value in phone_candidates if value}
        if len(phones) > 1:
            warnings.append("Телефоны у дублей отличаются. Проверьте итоговый телефон.")

        email_values = [client.email or "" for client in merge_clients]
        email_candidates = self._deduped_display_values(
            email_values,
            lambda value: value.strip().lower(),
        )
        emails = {value.strip().lower() for value in email_candidates if value}
        if len(emails) > 1:
            warnings.append("Email у дублей отличается. Проверьте итоговый email.")

        canonical_phone = self._canonical_contact(
            self.target_client.phone,
            phone_candidates,
        )
        canonical_email = self._canonical_contact(
            self.target_client.email,
            email_candidates,
        )

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
                "name": self._canonical_name(),
                "phone": canonical_phone,
                "email": canonical_email or None,
                "notes": self._alternative_contact_notes(
                    canonical_phone=canonical_phone,
                    canonical_email=canonical_email,
                ),
                "candidates": {
                    "names": sorted([value for value in candidate_names if value]),
                    "phones": phone_candidates,
                    "emails": email_candidates,
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
        if not is_drive_oauth_configured():
            logger.info(
                "Skipping client merge Drive sync because Drive OAuth is not fully configured."
            )
            return
        try:
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
                    try:
                        delete_drive_folder(source.drive_folder_id)
                    except DriveError as exc:
                        warning = (
                            "Содержимое Drive перенесено, но исходную папку "
                            "не удалось удалить из-за прав доступа."
                        )
                        logger.warning(
                            "Unable to delete source client Drive folder after merge "
                            "content transfer. source_client_id=%s source_folder_id=%s "
                            "error=%s",
                            source.pk,
                            source.drive_folder_id,
                            exc,
                        )
                        if warning not in self._warnings:
                            self._warnings.append(warning)
        except DriveError as exc:
            if _is_drive_configuration_error(exc):
                logger.info(
                    "Skipping client merge Drive sync because Drive OAuth is not fully configured."
                )
                return
            raise

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
            "warnings": list(self._warnings),
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
    SAME_SURNAME_NAME_SCORE = 45
    SHORT_FULL_NAME_SCORE = 10
    NAME_PATRONYMIC_BIRTHDATE_SCORE = 55
    SAME_FULL_NAME_SCORE = 25
    SAME_BIRTH_DATE_ONLY_SCORE = 10
    MISSING_CONTACT_PENALTY = -10

    @staticmethod
    def _normalize_email(value: str | None) -> str:
        return (value or "").strip().lower()

    @staticmethod
    def _normalize_name(value: str | None) -> str:
        return (
            " ".join((value or "").split())
            .strip()
            .replace("Ё", "Е")
            .replace("ё", "е")
            .lower()
        )

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
    def _surname_name_key(tokens: list[str]) -> tuple[str, str]:
        if len(tokens) >= 2:
            return tokens[0], tokens[1]
        return "", ""

    def _duplicate_hint_index_keys(self, client: Client) -> list[tuple[str, object]]:
        keys: list[tuple[str, object]] = []

        phone = _normalize_phone(client.phone)
        if phone:
            keys.append(("phone", phone))

        email = self._normalize_email(client.email)
        if email:
            keys.append(("email", email))

        if client.birth_date:
            keys.append(("birth_date", client.birth_date))

        normalized_name = self._normalize_name(client.name)
        if normalized_name:
            keys.append(("full_name", normalized_name))

        surname_name = self._surname_name_key(self._name_tokens(client.name))
        if surname_name[0] and surname_name[1]:
            keys.append(("surname_name", surname_name))

        return keys

    @staticmethod
    def needs_name_normalization(client: Client) -> bool:
        return bool((client.name or "") != normalize_client_name(client.name))

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

        target_surname, target_given = self._surname_name_key(target_tokens)
        candidate_surname, candidate_given = self._surname_name_key(candidate_tokens)
        same_surname_name = bool(
            target_surname
            and target_given
            and target_surname == candidate_surname
            and target_given == candidate_given
        )
        if same_surname_name:
            score += self.SAME_SURNAME_NAME_SCORE
            reasons.append("same_surname_name")
            matched_fields["surname_name"] = True
            if len(target_tokens) != len(candidate_tokens) and (
                len(target_tokens) == 2 or len(candidate_tokens) == 2
            ):
                score += self.SHORT_FULL_NAME_SCORE
                reasons.append("short_full_name_match")
                matched_fields["missing_patronymic"] = True

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

    def build_duplicate_hints(
        self,
        *,
        clients: Sequence[Client],
        queryset,
        limit_per_client: int = 50,
    ) -> dict[str, dict]:
        candidate_pool = list(
            queryset.only(
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
        )
        candidate_indexes: dict[tuple[str, object], list[Client]] = defaultdict(list)
        for candidate in candidate_pool:
            for key in self._duplicate_hint_index_keys(candidate):
                candidate_indexes[key].append(candidate)

        hints: dict[str, dict] = {}
        for client in clients:
            candidate_ids: set[str] = set()
            candidate_matches: list[Client] = []
            for key in self._duplicate_hint_index_keys(client):
                for candidate in candidate_indexes.get(key, []):
                    candidate_id = str(candidate.id)
                    if candidate.id == client.id or candidate_id in candidate_ids:
                        continue
                    candidate_ids.add(candidate_id)
                    candidate_matches.append(candidate)

            candidates = []
            for candidate in candidate_matches:
                score_result = self._score_pair(client, candidate)
                if score_result["score"] <= 0:
                    continue
                candidates.append(
                    {
                        "client": candidate,
                        "score": score_result["score"],
                        "confidence": score_result["confidence"],
                        "reasons": score_result["reasons"],
                        "matched_fields": score_result["matched_fields"],
                    }
                )

            candidates.sort(
                key=lambda item: (
                    -int(item["score"]),
                    str(getattr(item["client"], "name", "")).lower(),
                )
            )
            candidates = candidates[:limit_per_client]
            reasons: list[str] = []
            seen_reasons: set[str] = set()
            for item in candidates:
                for reason in item["reasons"]:
                    if reason not in seen_reasons:
                        seen_reasons.add(reason)
                        reasons.append(reason)
            max_score = max([item["score"] for item in candidates], default=0)
            hints[str(client.id)] = {
                "client_id": str(client.id),
                "candidate_count": len(candidates),
                "max_score": max_score,
                "confidence": self._confidence(max_score),
                "reasons": reasons,
                "needs_name_normalization": self.needs_name_normalization(client),
                "normalized_name": normalize_client_name(client.name),
            }
        return hints
