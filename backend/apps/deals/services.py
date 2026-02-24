from __future__ import annotations

import logging
import re
import time
from collections import defaultdict
from datetime import date, datetime
from difflib import SequenceMatcher
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
_CLOSED_DEAL_STATUSES = {Deal.DealStatus.WON, Deal.DealStatus.LOST}


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


class DealSimilarityService:
    SCORE_VERSION = "deal-sim-v1"

    TITLE_NORM_SCORE = 40
    TITLE_FUZZY_MAX_SCORE = 20
    TITLE_FUZZY_THRESHOLD = 0.88
    POLICY_OVERLAP_SCORE = 20
    REFERENCE_OVERLAP_SCORE = 10
    SAME_SOURCE_SCORE = 4
    SAME_SELLER_SCORE = 3
    SAME_EXECUTOR_SCORE = 3
    NEXT_CONTACT_CLOSE_SCORE = 3
    DESCRIPTION_FUZZY_SCORE = 2

    _ALNUM_RE = re.compile(r"[^a-zа-я0-9]+", flags=re.IGNORECASE)
    _REFERENCE_RE = re.compile(r"[a-zа-я0-9][a-zа-я0-9/_-]{4,}", flags=re.IGNORECASE)

    @classmethod
    def _normalize_text(cls, value: str | None) -> str:
        raw = (value or "").strip().lower().replace("ё", "е")
        return cls._ALNUM_RE.sub("", raw)

    @classmethod
    def _normalize_simple(cls, value: str | None) -> str:
        return " ".join((value or "").split()).strip().lower()

    @classmethod
    def _extract_references(cls, *values: str | None) -> set[str]:
        refs: set[str] = set()
        for value in values:
            if not value:
                continue
            for match in cls._REFERENCE_RE.findall(value.lower().replace("ё", "е")):
                normalized = re.sub(r"[^a-zа-я0-9]+", "", match, flags=re.IGNORECASE)
                if len(normalized) < 6:
                    continue
                if not any(ch.isdigit() for ch in normalized):
                    continue
                refs.add(normalized)
        return refs

    @staticmethod
    def _confidence(score: int) -> str:
        if score >= 75:
            return "high"
        if score >= 50:
            return "medium"
        return "low"

    @staticmethod
    def _safe_ratio(left: str, right: str) -> float:
        if not left or not right:
            return 0.0
        return SequenceMatcher(None, left, right).ratio()

    @classmethod
    def _fuzzy_score(cls, ratio: float) -> float:
        if ratio < cls.TITLE_FUZZY_THRESHOLD:
            return 0.0
        if ratio >= 1:
            return float(cls.TITLE_FUZZY_MAX_SCORE)
        span = 1 - cls.TITLE_FUZZY_THRESHOLD
        progress = (ratio - cls.TITLE_FUZZY_THRESHOLD) / span if span else 0.0
        progress = max(0.0, min(progress, 1.0))
        return cls.TITLE_FUZZY_MAX_SCORE * progress

    @staticmethod
    def _date_distance_days(left: date | None, right: date | None) -> int | None:
        if not left or not right:
            return None
        if isinstance(left, datetime):
            left = left.date()
        if isinstance(right, datetime):
            right = right.date()
        return abs((left - right).days)

    def _policy_numbers_map(self, deal_ids: Sequence) -> dict[str, set[str]]:
        if not deal_ids:
            return {}
        result: dict[str, set[str]] = defaultdict(set)
        queryset = (
            Policy.objects.with_deleted()
            .filter(deal_id__in=deal_ids)
            .values("deal_id", "number")
        )
        for row in queryset:
            number = self._normalize_text(row.get("number"))
            if number:
                result[str(row["deal_id"])].add(number)
        return result

    def _payment_references_map(self, deal_ids: Sequence) -> dict[str, set[str]]:
        if not deal_ids:
            return {}
        result: dict[str, set[str]] = defaultdict(set)
        queryset = (
            Payment.objects.with_deleted()
            .filter(deal_id__in=deal_ids)
            .values("deal_id", "description")
        )
        for row in queryset:
            refs = self._extract_references(row.get("description"))
            if refs:
                result[str(row["deal_id"])].update(refs)
        return result

    def _score_pair(
        self,
        *,
        target_deal: Deal,
        candidate: Deal,
        target_policy_numbers: set[str],
        candidate_policy_numbers: set[str],
        target_payment_refs: set[str],
        candidate_payment_refs: set[str],
    ) -> dict:
        score = 0.0
        reasons: list[str] = []
        matched_fields: dict[str, object] = {
            "title_norm_exact": False,
            "title_fuzzy": 0.0,
            "policy_number_overlap": False,
            "payment_reference_overlap": False,
            "same_source": False,
            "same_seller": False,
            "same_executor": False,
            "next_contact_close_days": None,
            "description_fuzzy": 0.0,
        }

        target_norm_title = self._normalize_text(target_deal.title)
        candidate_norm_title = self._normalize_text(candidate.title)
        title_ratio = self._safe_ratio(target_norm_title, candidate_norm_title)
        matched_fields["title_fuzzy"] = round(title_ratio, 4)
        if target_norm_title and target_norm_title == candidate_norm_title:
            score += self.TITLE_NORM_SCORE
            matched_fields["title_norm_exact"] = True
            reasons.append("same_norm_title")
        fuzzy_score = self._fuzzy_score(title_ratio)
        if fuzzy_score > 0:
            score += fuzzy_score
            reasons.append("similar_title")

        shared_policy_numbers = target_policy_numbers & candidate_policy_numbers
        if shared_policy_numbers:
            score += self.POLICY_OVERLAP_SCORE
            matched_fields["policy_number_overlap"] = True
            reasons.append("shared_policy_number")

        target_refs = (
            self._extract_references(target_deal.title, target_deal.description)
            | target_payment_refs
        )
        candidate_refs = (
            self._extract_references(candidate.title, candidate.description)
            | candidate_payment_refs
        )
        shared_refs = target_refs & candidate_refs
        if shared_refs:
            score += self.REFERENCE_OVERLAP_SCORE
            reasons.append("shared_reference")
        if target_payment_refs & candidate_payment_refs:
            matched_fields["payment_reference_overlap"] = True

        target_source = self._normalize_simple(target_deal.source)
        candidate_source = self._normalize_simple(candidate.source)
        if target_source and target_source == candidate_source:
            score += self.SAME_SOURCE_SCORE
            matched_fields["same_source"] = True
            reasons.append("same_source")

        if target_deal.seller_id and target_deal.seller_id == candidate.seller_id:
            score += self.SAME_SELLER_SCORE
            matched_fields["same_seller"] = True
            reasons.append("same_seller")

        if target_deal.executor_id and target_deal.executor_id == candidate.executor_id:
            score += self.SAME_EXECUTOR_SCORE
            matched_fields["same_executor"] = True
            reasons.append("same_executor")

        next_contact_days = self._date_distance_days(
            target_deal.next_contact_date,
            candidate.next_contact_date,
        )
        matched_fields["next_contact_close_days"] = next_contact_days
        if next_contact_days is not None and next_contact_days <= 3:
            score += self.NEXT_CONTACT_CLOSE_SCORE
            reasons.append("close_next_contact_date")

        description_ratio = self._safe_ratio(
            self._normalize_simple(target_deal.description),
            self._normalize_simple(candidate.description),
        )
        matched_fields["description_fuzzy"] = round(description_ratio, 4)
        if description_ratio >= 0.9:
            score += self.DESCRIPTION_FUZZY_SCORE
            reasons.append("similar_description")

        clamped_score = int(max(0, min(round(score), 100)))
        merge_blockers: list[str] = []
        if candidate.deleted_at is not None:
            merge_blockers.append("deleted_candidate")
        if candidate.client_id != target_deal.client_id:
            merge_blockers.append("different_client")

        return {
            "score": clamped_score,
            "confidence": self._confidence(clamped_score),
            "reasons": reasons,
            "matched_fields": matched_fields,
            "merge_blockers": merge_blockers,
        }

    def find_similar(
        self,
        *,
        target_deal: Deal,
        queryset,
        limit: int = 30,
        include_self: bool = False,
        include_closed: bool = False,
    ) -> dict:
        candidates_qs = queryset.filter(client_id=target_deal.client_id)
        if not include_self:
            candidates_qs = candidates_qs.exclude(pk=target_deal.pk)
        if not include_closed:
            candidates_qs = candidates_qs.exclude(status__in=_CLOSED_DEAL_STATUSES)

        candidates_qs = candidates_qs.select_related(
            "client", "seller", "executor", "mailbox"
        ).prefetch_related("quotes", "documents")
        candidates = list(candidates_qs)
        if not candidates:
            return {
                "candidates": [],
                "meta": {
                    "total_checked": 0,
                    "returned": 0,
                    "scoring_version": self.SCORE_VERSION,
                },
            }

        all_ids = [target_deal.id, *[deal.id for deal in candidates]]
        policy_map = self._policy_numbers_map(all_ids)
        payment_ref_map = self._payment_references_map(all_ids)
        target_policy_numbers = policy_map.get(str(target_deal.id), set())
        target_payment_refs = payment_ref_map.get(str(target_deal.id), set())

        scored: list[dict] = []
        for candidate in candidates:
            score_result = self._score_pair(
                target_deal=target_deal,
                candidate=candidate,
                target_policy_numbers=target_policy_numbers,
                candidate_policy_numbers=policy_map.get(str(candidate.id), set()),
                target_payment_refs=target_payment_refs,
                candidate_payment_refs=payment_ref_map.get(str(candidate.id), set()),
            )
            if score_result["score"] <= 0:
                continue
            scored.append({"deal": candidate, **score_result})

        scored.sort(
            key=lambda item: (
                int(item["score"]),
                getattr(item["deal"], "updated_at", datetime.min),
            ),
            reverse=True,
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

    def _merge_ids_in_order(self) -> list[str]:
        return [str(deal.id) for deal in self._all_deals]

    def _merge_ids_block(self) -> str:
        ids_text = ", ".join(self._merge_ids_in_order())
        return f"Предыдущие ID сделок: {ids_text}"

    def _append_merge_ids_block(self, description: str | None) -> str:
        base_description = (description or "").strip()
        ids_block = self._merge_ids_block()
        if base_description.endswith(ids_block):
            return base_description
        if not base_description:
            return ids_block
        return f"{base_description}\n\n{ids_block}"

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
                "description": self._append_merge_ids_block(
                    self._get_combined_description()
                ),
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
                description=self._append_merge_ids_block(
                    self.final_deal_data.get("description", "")
                ),
                client_id=self.target_deal.client_id,
                seller_id=(
                    self.final_deal_data.get("seller_id") or self.target_deal.seller_id
                ),
                executor_id=self.final_deal_data.get("executor_id"),
                status=Deal.DealStatus.OPEN,
                stage_name=self.target_deal.stage_name or "",
                expected_close=self.final_deal_data.get("expected_close"),
                next_contact_date=(
                    self.final_deal_data.get("next_contact_date")
                    or self.target_deal.next_contact_date
                ),
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
