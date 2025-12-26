from apps.common.models import SoftDeleteModel
from django.conf import settings
from django.db import models


class Note(SoftDeleteModel):
    """Заметка/комментарий к сделке"""

    deal = models.ForeignKey(
        "deals.Deal",
        related_name="notes",
        on_delete=models.CASCADE,
        help_text="Сделка",
        null=True,
        blank=True,
    )

    body = models.TextField(help_text="Текст заметки")
    author_name = models.CharField(max_length=120, blank=True, help_text="Имя автора")
    author = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="notes",
        help_text="Автор",
    )

    class Meta:
        ordering = ["-created_at"]
        verbose_name = "Заметка"
        verbose_name_plural = "Заметки"

    def __str__(self) -> str:
        return f"Заметка для {self.deal}"
