from apps.common.models import SoftDeleteModel
from django.conf import settings
from django.db import models
from django.utils import timezone


class Notification(SoftDeleteModel):
    """Уведомление для пользователя"""

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        related_name="notifications",
        on_delete=models.CASCADE,
        help_text="Пользователь",
    )
    type = models.CharField(max_length=120, help_text="Тип уведомления")
    payload = models.JSONField(default=dict, blank=True, help_text="Данные уведомления")
    is_read = models.BooleanField(default=False, help_text="Прочитано")
    read_at = models.DateTimeField(null=True, blank=True, help_text="Время прочтения")

    class Meta:
        ordering = ["-created_at"]
        verbose_name = "Уведомление"
        verbose_name_plural = "Уведомления"

    def mark_as_read(self):
        """Отметить как прочитано"""
        if not self.is_read:
            self.is_read = True
            self.read_at = timezone.now()
            self.save(update_fields=["is_read", "read_at"])

    def __str__(self) -> str:
        return f"{self.type} для {self.user}"


def _default_remind_days() -> list[int]:
    return [5, 3, 1]


class TelegramProfile(models.Model):
    user = models.OneToOneField(
        settings.AUTH_USER_MODEL,
        related_name="telegram_profile",
        on_delete=models.CASCADE,
        help_text="User",
    )
    chat_id = models.BigIntegerField(
        unique=True,
        null=True,
        blank=True,
        help_text="Telegram chat id",
    )
    linked_at = models.DateTimeField(
        null=True,
        blank=True,
        help_text="Linked at",
    )
    link_code = models.CharField(
        max_length=64,
        blank=True,
        help_text="One-time link code for /start",
    )
    link_code_expires_at = models.DateTimeField(
        null=True,
        blank=True,
        help_text="Link code expiry",
    )

    class Meta:
        verbose_name = "Telegram profile"
        verbose_name_plural = "Telegram profiles"

    def __str__(self) -> str:
        return f"Telegram {self.user}"


class NotificationSettings(models.Model):
    user = models.OneToOneField(
        settings.AUTH_USER_MODEL,
        related_name="notification_settings",
        on_delete=models.CASCADE,
        help_text="User",
    )
    telegram_enabled = models.BooleanField(default=False, help_text="Telegram enabled")
    notify_tasks = models.BooleanField(default=True, help_text="New tasks")
    notify_deal_events = models.BooleanField(default=True, help_text="Deal events")
    notify_deal_expected_close = models.BooleanField(
        default=True, help_text="Deal expected close reminders"
    )
    notify_payment_due = models.BooleanField(
        default=True, help_text="Payment due reminders"
    )
    notify_policy_expiry = models.BooleanField(
        default=True, help_text="Policy expiry reminders"
    )
    remind_days = models.JSONField(
        default=_default_remind_days,
        help_text="Reminder days before deadline",
    )

    class Meta:
        verbose_name = "Notification settings"
        verbose_name_plural = "Notification settings"

    def __str__(self) -> str:
        return f"Settings {self.user}"


class NotificationDelivery(models.Model):
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        related_name="notification_deliveries",
        on_delete=models.CASCADE,
        help_text="User",
    )
    event_type = models.CharField(max_length=120, help_text="Notification type")
    object_type = models.CharField(
        max_length=120,
        blank=True,
        help_text="Object type",
    )
    object_id = models.CharField(
        max_length=120,
        blank=True,
        help_text="Object id",
    )
    trigger_date = models.DateField(
        help_text="Trigger date",
    )
    sent_at = models.DateTimeField(auto_now_add=True, help_text="Sent at")
    metadata = models.JSONField(default=dict, blank=True, help_text="Metadata")

    class Meta:
        verbose_name = "Notification delivery"
        verbose_name_plural = "Notification deliveries"
        constraints = [
            models.UniqueConstraint(
                fields=[
                    "user",
                    "event_type",
                    "object_type",
                    "object_id",
                    "trigger_date",
                ],
                name="notifications_unique_delivery",
            )
        ]

    def __str__(self) -> str:
        return f"{self.event_type} -> {self.user}"
