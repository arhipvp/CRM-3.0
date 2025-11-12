from apps.common.models import SoftDeleteModel
from django.conf import settings
from django.db import models


class ChatMessage(SoftDeleteModel):
    """Сообщение в чате сделки"""

    deal = models.ForeignKey(
        "deals.Deal",
        related_name="chat_messages",
        on_delete=models.CASCADE,
        help_text="Сделка",
    )

    author_name = models.CharField(
        max_length=255, default="Anonymous", help_text="Имя автора сообщения"
    )

    author = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        related_name="chat_messages",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        help_text="Пользователь (опционально)",
    )

    body = models.TextField(help_text="Текст сообщения")

    class Meta:
        ordering = ["created_at"]
        verbose_name = "Сообщение чата"
        verbose_name_plural = "Сообщения чата"

    def __str__(self) -> str:
        return f"{self.author_name}: {self.body[:50]}"
