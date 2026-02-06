from django.contrib.auth.models import User
from django.db import models


class Mailbox(models.Model):
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name="mailboxes")
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
