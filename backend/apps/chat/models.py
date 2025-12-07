from apps.common.models import SoftDeleteModel
from django.conf import settings
from django.db import models


class ChatMessage(SoftDeleteModel):
    """Message linked to a deal conversation."""

    deal = models.ForeignKey(
        "deals.Deal",
        related_name="chat_messages",
        on_delete=models.CASCADE,
        help_text="Deal reference",
    )

    author_name = models.CharField(
        max_length=255, default="Anonymous", help_text="Author display name"
    )

    author = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        related_name="chat_messages",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        help_text="Optional user who posted the message",
    )

    body = models.TextField(help_text="Message body")

    class Meta:
        ordering = ["created_at"]
        verbose_name = "Chat message"
        verbose_name_plural = "Chat messages"

    def __str__(self) -> str:
        return f"{self.author_name}: {self.body[:50]}"

    @property
    def author_display_name(self) -> str:
        """Получить удобочитаемое имя автора с запасным вариантом."""
        name = (self.author_name or "").strip()
        if name:
            return name

        author = self.author
        if author:
            full_name_raw = author.get_full_name()
            full_name = full_name_raw.strip() if full_name_raw else ""
            username = (author.username or "").strip()
            if full_name:
                return full_name
            if username:
                return username

        return "Пользователь"
