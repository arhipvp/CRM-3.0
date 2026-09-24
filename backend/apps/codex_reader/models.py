import hashlib
import secrets
import uuid

from django.db import models
from django.utils import timezone


class CodexReadKey(models.Model):
    """Revocable credential scoped to the Codex read-only API."""

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name = models.CharField(max_length=120)
    prefix = models.CharField(max_length=24, unique=True)
    token_hash = models.CharField(max_length=64)
    created_at = models.DateTimeField(auto_now_add=True)
    revoked_at = models.DateTimeField(null=True, blank=True)

    @classmethod
    def issue(cls, name):
        secret = secrets.token_urlsafe(48)
        prefix = secrets.token_hex(8)
        token = f"crm3_{prefix}_{secret}"
        instance = cls.objects.create(
            name=name,
            prefix=prefix,
            token_hash=hashlib.sha256(token.encode("utf-8")).hexdigest(),
        )
        return instance, token

    def revoke(self):
        self.revoked_at = timezone.now()
        self.save(update_fields=["revoked_at"])
