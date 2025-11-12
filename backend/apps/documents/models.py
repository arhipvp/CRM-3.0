from apps.common.models import SoftDeleteModel
from django.conf import settings
from django.db import models


def document_upload_path(instance, filename):
    return f"documents/{instance.deal_id}/{filename}"


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
    status = models.CharField(max_length=50, default="draft", help_text="Статус")
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
