from __future__ import annotations

from typing import Sequence

from django.db import transaction

from apps.chat.models import ChatMessage
from apps.documents.models import Document
from apps.finances.models import Payment
from apps.notes.models import Note
from apps.policies.models import Policy
from apps.tasks.models import Task
from apps.users.models import User

from .models import Deal, Quote


class DealMergeService:
    """Сервис для переноса связанных сущностей из одних сделок в другую."""

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
        actor: User | None = None,
    ) -> None:
        if not source_deals:
            raise ValueError("Для объединения нужна хотя бы одна исходная сделка.")
        self.target_deal = target_deal
        self.source_deals = list(source_deals)
        self.actor = actor
        self._source_ids = [deal.pk for deal in self.source_deals]

    def merge(self) -> dict:
        """Переносит все связанные записи и удаляет исходные сделки."""

        moved_counts: dict[str, int] = {}

        with transaction.atomic():
            for alias, model in self._RELATED_MODELS:
                moved_counts[alias] = model.objects.filter(deal_id__in=self._source_ids).update(
                    deal=self.target_deal
                )

            for deal in self.source_deals:
                if self.actor:
                    deal._audit_actor = self.actor
                deal.delete()

        return {
            "merged_deal_ids": [str(deal.id) for deal in self.source_deals],
            "moved_counts": moved_counts,
        }
