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


class KnowledgeDocument(SoftDeleteModel):
    """Общие документы, доступные всей команде."""

    title = models.CharField(max_length=255, help_text="Название файла")
    description = models.TextField(blank=True, help_text="Краткое описание")
    file_name = models.CharField(max_length=255, help_text="Оригинальное имя файла")
    file = models.FileField(
        upload_to=knowledge_document_upload_path,
        null=True,
        blank=True,
        help_text="Файл документа",
    )
    drive_file_id = models.CharField(
        max_length=128,
        blank=True,
        null=True,
        help_text="ID файла в Google Drive (legacy)",
    )
    web_view_link = models.URLField(
        max_length=512,
        blank=True,
        help_text="Ссылка для просмотра файла (legacy)",
    )
    mime_type = models.CharField(max_length=120, blank=True, help_text="MIME тип файла")
    file_size = models.PositiveBigIntegerField(
        null=True, blank=True, help_text="Размер файла в байтах"
    )
    insurance_type = models.ForeignKey(
        "deals.InsuranceType",
        related_name="knowledge_documents",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        help_text="Вид страхования",
    )
    open_notebook_source_id = models.CharField(
        max_length=128,
        blank=True,
        help_text="ID источника в Open Notebook",
    )
    open_notebook_status = models.CharField(
        max_length=32,
        blank=True,
        help_text="Статус синхронизации с Open Notebook",
    )
    open_notebook_error = models.TextField(
        blank=True,
        help_text="Текст последней ошибки синхронизации",
    )

    owner = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="knowledge_documents",
        help_text="Пользователь, загрузивший документ",
    )

    class Meta:
        ordering = ["-created_at"]
        verbose_name = "Библиотечный документ"
        verbose_name_plural = "Библиотечные документы"

    def __str__(self) -> str:
        return self.title


class KnowledgeNotebook(SoftDeleteModel):
    """Связь вида страхования с блокнотом Open Notebook."""

    insurance_type = models.OneToOneField(
        "deals.InsuranceType",
        related_name="knowledge_notebook",
        on_delete=models.CASCADE,
        help_text="Вид страхования",
    )
    notebook_id = models.CharField(
        max_length=128,
        unique=True,
        help_text="ID блокнота в Open Notebook",
    )
    notebook_name = models.CharField(
        max_length=255,
        help_text="Имя блокнота в Open Notebook",
    )

    class Meta:
        ordering = ["-created_at"]
        verbose_name = "Блокнот Open Notebook"
        verbose_name_plural = "Блокноты Open Notebook"

    def __str__(self) -> str:
        return f"{self.insurance_type_id}: {self.notebook_name}"


class KnowledgeChatSession(SoftDeleteModel):
    """Сессия чата Open Notebook для пользователя и вида страхования."""

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="knowledge_chat_sessions",
        help_text="Пользователь",
    )
    insurance_type = models.ForeignKey(
        "deals.InsuranceType",
        on_delete=models.CASCADE,
        related_name="knowledge_chat_sessions",
        help_text="Вид страхования",
    )
    session_id = models.CharField(
        max_length=128,
        help_text="ID сессии чата в Open Notebook",
    )

    class Meta:
        ordering = ["-created_at"]
        verbose_name = "Сессия чата Open Notebook"
        verbose_name_plural = "Сессии чата Open Notebook"
        constraints = [
            models.UniqueConstraint(
                fields=["user", "insurance_type"],
                name="unique_knowledge_chat_session",
            )
        ]

    def __str__(self) -> str:
        return f"{self.user_id}: {self.insurance_type_id}"


class KnowledgeSavedAnswer(SoftDeleteModel):
    """Сохраненные ответы пользователя по виду страхования."""

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="knowledge_saved_answers",
        help_text="Пользователь",
    )
    insurance_type = models.ForeignKey(
        "deals.InsuranceType",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="knowledge_saved_answers",
        help_text="Вид страхования",
    )
    question = models.TextField(help_text="Вопрос пользователя")
    answer = models.TextField(help_text="Ответ Open Notebook")
    citations = models.JSONField(
        blank=True,
        default=list,
        help_text="Источники ответа",
    )

    class Meta:
        ordering = ["-created_at"]
        verbose_name = "Сохраненный ответ"
        verbose_name_plural = "Сохраненные ответы"

    def __str__(self) -> str:
        return f"{self.user_id}: {self.question[:40]}"
