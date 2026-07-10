import uuid

from apps.common.indexes import PostgresTrigramIndex
from apps.common.models import SoftDeleteModel
from django.conf import settings
from django.db import models
from django.utils import timezone


class Client(SoftDeleteModel):
    """Клиент - страхователь"""

    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        related_name="created_clients",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        help_text="Пользователь, создавший клиента",
    )

    name = models.CharField(max_length=255, help_text="Имя клиента")
    phone = models.CharField(max_length=20, blank=True, help_text="Контактный телефон")
    email = models.EmailField(
        blank=True,
        null=True,
        help_text="Client email address",
    )
    birth_date = models.DateField(null=True, blank=True, help_text="Дата рождения")
    notes = models.TextField(blank=True, help_text="Примечание о клиенте")
    is_counterparty = models.BooleanField(
        default=False,
        help_text="Клиент является контрагентом",
    )
    drive_folder_id = models.CharField(
        max_length=255, blank=True, null=True, help_text="Google Drive folder ID"
    )

    class Meta:
        ordering = ["name"]
        indexes = [
            PostgresTrigramIndex(
                "name",
                name="client_name_trgm_idx",
            )
        ]

    def __str__(self) -> str:
        return self.name


class ClientSimilarityExclusion(models.Model):
    """Pair of clients marked as definitely different."""

    first_client = models.ForeignKey(
        Client,
        related_name="similarity_exclusions_as_first",
        on_delete=models.CASCADE,
    )
    second_client = models.ForeignKey(
        Client,
        related_name="similarity_exclusions_as_second",
        on_delete=models.CASCADE,
    )
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        related_name="client_similarity_exclusions",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-created_at"]
        constraints = [
            models.UniqueConstraint(
                fields=["first_client", "second_client"],
                name="unique_client_similarity_exclusion_pair",
            ),
            models.CheckConstraint(
                check=~models.Q(first_client=models.F("second_client")),
                name="client_similarity_exclusion_distinct_clients",
            ),
        ]
        indexes = [
            models.Index(fields=["first_client", "second_client"]),
            models.Index(fields=["second_client", "first_client"]),
        ]

    @staticmethod
    def ordered_pair(first_client_id, second_client_id) -> tuple[str, str]:
        first = str(first_client_id)
        second = str(second_client_id)
        if first == second:
            raise ValueError("Clients in similarity exclusion must be different.")
        return (first, second) if first < second else (second, first)

    def save(self, *args, **kwargs):
        first_id, second_id = self.ordered_pair(
            self.first_client_id,
            self.second_client_id,
        )
        self.first_client_id = first_id
        self.second_client_id = second_id
        super().save(*args, **kwargs)

    def __str__(self) -> str:
        return f"{self.first_client_id} != {self.second_client_id}"


class ClientMergeSession(models.Model):
    class Status(models.TextChoices):
        MOVING_DRIVE = "moving_drive", "Moving Drive"
        READY_TO_FINALIZE = "ready_to_finalize", "Ready to finalize"
        SUCCEEDED = "succeeded", "Succeeded"
        FAILED = "failed", "Failed"
        CANCELED = "canceled", "Canceled"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    target_client_id = models.UUIDField(db_index=True)
    source_client_ids = models.JSONField(default=list)
    include_deleted = models.BooleanField(default=True)
    preview_snapshot_id = models.CharField(max_length=255, blank=True, default="")
    field_overrides = models.JSONField(default=dict, blank=True)
    requested_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        related_name="client_merge_sessions",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
    )
    status = models.CharField(
        max_length=32,
        choices=Status.choices,
        default=Status.MOVING_DRIVE,
        db_index=True,
    )
    drive_items = models.JSONField(default=list, blank=True)
    moved_items = models.PositiveIntegerField(default=0)
    total_items = models.PositiveIntegerField(default=0)
    retryable = models.BooleanField(default=False)
    failed_item = models.JSONField(default=dict, blank=True)
    last_error = models.TextField(blank=True, default="")
    warnings = models.JSONField(default=list, blank=True)
    result = models.JSONField(default=dict, blank=True)
    log = models.JSONField(default=list, blank=True)
    started_at = models.DateTimeField(null=True, blank=True)
    finished_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["requested_by", "-created_at"]),
            models.Index(fields=["status", "-updated_at"]),
        ]

    def append_log(self, message: str, *, level: str = "info") -> None:
        entries = list(self.log or [])
        entries.append(
            {
                "timestamp": timezone.now().isoformat(),
                "level": level,
                "message": message,
            }
        )
        self.log = entries
