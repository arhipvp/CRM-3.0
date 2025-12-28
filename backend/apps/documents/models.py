from uuid import uuid4

from apps.common.models import SoftDeleteModel
from django.conf import settings
from django.db import models


def document_upload_path(instance, filename):
    return f"documents/{instance.deal_id}/{filename}"


def knowledge_document_upload_path(instance, filename):
    return f"knowledge_documents/{uuid4()}_{filename}"


class DocumentStatus(models.TextChoices):
    DRAFT = "draft", "Черновик"
    PENDING = "pending", "Ожидание"
    COMPLETED = "completed", "Завершено"
    ERROR = "error", "Ошибка"


class Document(SoftDeleteModel):
    """Документ, связанный со сделкой"""

    title = models.CharField(max_length=255, help_text="Название документа")
    file = models.FileField(upload_to=document_upload_path, help_text="Файл")
    file_size = models.PositiveIntegerField(
        default=0, help_text="Размер файла в байтах"
    )
    mime_type = models.CharField(max_length=120, blank=True, help_text="MIME тип")

    # Связь на сделку
    deal = models.ForeignKey(
        "deals.Deal",
        related_name="documents",
        on_delete=models.CASCADE,
        help_text="Сделка",
        null=True,
        blank=True,
    )

    # Владелец
    owner = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        related_name="documents",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        help_text="Владелец документа",
    )

    # Классификация
    doc_type = models.CharField(max_length=120, blank=True, help_text="Тип документа")
    status = models.CharField(
        max_length=50,
        choices=DocumentStatus.choices,
        default=DocumentStatus.DRAFT,
        help_text="Статус",
    )
    checksum = models.CharField(
        max_length=128, blank=True, help_text="Контрольная сумма"
    )

    class Meta:
        ordering = ["-created_at"]
        verbose_name = "Документ"
        verbose_name_plural = "Документы"

    def save(self, *args, **kwargs):
        if self.file and not self.file_size:
            self.file_size = self.file.size
        super().save(*args, **kwargs)

    def __str__(self) -> str:
        return self.title


class OpenNotebookSession(SoftDeleteModel):
    """Сохраненная сессия чата Open Notebook по блокноту."""

    notebook_id = models.CharField(
        max_length=128,
        unique=True,
        help_text="ID блокнота в Open Notebook",
    )
    chat_session_id = models.CharField(
        max_length=128,
        help_text="ID сессии чата в Open Notebook",
    )

    class Meta:
        ordering = ["-created_at"]
        verbose_name = "Сессия чата Open Notebook"
        verbose_name_plural = "Сессии чата Open Notebook"

    def __str__(self) -> str:
        return self.notebook_id
