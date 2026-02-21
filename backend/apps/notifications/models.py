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
    next_contact_lead_days = models.PositiveSmallIntegerField(
        default=90,
        help_text="Days before event for next contact",
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


class TelegramInboundMessage(models.Model):
    class Status(models.TextChoices):
        RECEIVED = "received", "Received"
        WAITING_DECISION = "waiting_decision", "Waiting decision"
        LINKED_EXISTING = "linked_existing", "Linked existing deal"
        CREATED_NEW_DEAL = "created_new_deal", "Created new deal"
        CANCELED = "canceled", "Canceled"
        EXPIRED = "expired", "Expired"
        FAILED = "failed", "Failed"

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        related_name="telegram_inbound_messages",
        on_delete=models.CASCADE,
        help_text="CRM user",
    )
    linked_deal = models.ForeignKey(
        "deals.Deal",
        related_name="telegram_inbound_messages",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        help_text="Linked deal",
    )
    chat_id = models.BigIntegerField(help_text="Telegram chat id")
    message_id = models.BigIntegerField(help_text="Telegram message id")
    update_id = models.BigIntegerField(help_text="Telegram update id")
    text = models.TextField(blank=True, help_text="Extracted source text")
    payload = models.JSONField(
        default=dict, blank=True, help_text="Raw Telegram payload"
    )
    status = models.CharField(
        max_length=32,
        choices=Status.choices,
        default=Status.RECEIVED,
        help_text="Processing status",
    )
    processed_at = models.DateTimeField(
        null=True,
        blank=True,
        help_text="When message processing was completed",
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "Telegram inbound message"
        verbose_name_plural = "Telegram inbound messages"
        constraints = [
            models.UniqueConstraint(
                fields=["chat_id", "message_id"],
                name="notifications_unique_tg_chat_message",
            )
        ]
        indexes = [
            models.Index(fields=["user", "status"]),
            models.Index(fields=["processed_at"]),
        ]

    def __str__(self) -> str:
        return f"{self.chat_id}:{self.message_id} ({self.status})"


class TelegramDealRoutingSession(models.Model):
    class State(models.TextChoices):
        PENDING = "pending", "Pending"
        LINKED_EXISTING = "linked_existing", "Linked existing deal"
        CREATED_NEW_DEAL = "created_new_deal", "Created new deal"
        CANCELED = "canceled", "Canceled"
        EXPIRED = "expired", "Expired"
        FAILED = "failed", "Failed"

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        related_name="telegram_deal_routing_sessions",
        on_delete=models.CASCADE,
        help_text="CRM user",
    )
    inbound_message = models.OneToOneField(
        TelegramInboundMessage,
        related_name="routing_session",
        on_delete=models.CASCADE,
        help_text="Inbound message being routed",
    )
    state = models.CharField(
        max_length=32,
        choices=State.choices,
        default=State.PENDING,
        help_text="Session state",
    )
    expires_at = models.DateTimeField(help_text="Session expiration timestamp")
    extracted_data = models.JSONField(
        default=dict,
        blank=True,
        help_text="Parsed data from telegram message",
    )
    candidate_deal_ids = models.JSONField(
        default=list,
        blank=True,
        help_text="Ordered candidate deals",
    )
    selected_deal = models.ForeignKey(
        "deals.Deal",
        related_name="telegram_routing_selected_sessions",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        help_text="Deal picked by user",
    )
    created_client = models.ForeignKey(
        "clients.Client",
        related_name="telegram_routing_created_sessions",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        help_text="Client created during routing",
    )
    created_deal = models.ForeignKey(
        "deals.Deal",
        related_name="telegram_routing_created_sessions",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        help_text="Deal created during routing",
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "Telegram deal routing session"
        verbose_name_plural = "Telegram deal routing sessions"
        indexes = [
            models.Index(
                fields=["user", "state", "expires_at"],
                name="notif_tg_route_idx",
            )
        ]

    def __str__(self) -> str:
        return f"Session {self.id} ({self.state}) for {self.user}"

    @property
    def is_expired(self) -> bool:
        return timezone.now() >= self.expires_at
