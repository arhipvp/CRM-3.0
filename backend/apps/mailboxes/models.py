from django.contrib.auth.models import User
from django.db import models


class Mailbox(models.Model):
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name="mailboxes")
    deal = models.OneToOneField(
        "deals.Deal",
        on_delete=models.SET_NULL,
        related_name="mailbox",
        null=True,
        blank=True,
    )
    email = models.EmailField(unique=True)
    local_part = models.CharField(max_length=100)
    domain = models.CharField(max_length=255)
    display_name = models.CharField(max_length=255, blank=True)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["user", "email"]),
            models.Index(fields=["domain", "local_part"]),
        ]

    def __str__(self) -> str:
        return self.email


class MailboxProcessedMessage(models.Model):
    mailbox = models.ForeignKey(
        Mailbox,
        on_delete=models.CASCADE,
        related_name="processed_messages",
    )
    uid = models.CharField(max_length=255)
    message_id = models.CharField(max_length=512, blank=True)
    subject = models.CharField(max_length=512, blank=True)
    sender = models.CharField(max_length=512, blank=True)
    processed_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-processed_at"]
        constraints = [
            models.UniqueConstraint(fields=["mailbox", "uid"], name="uniq_mailbox_uid"),
        ]
        indexes = [
            models.Index(fields=["mailbox", "message_id"]),
        ]

    def __str__(self) -> str:
        return f"{self.mailbox.email}: {self.uid}"
