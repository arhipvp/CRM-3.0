from django.conf import settings
from django.core.exceptions import ValidationError
from django.db import models

from .contracts import SCOPES, default_scopes


class McpAccessGrant(models.Model):
    user = models.OneToOneField(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="mcp_access"
    )
    enabled = models.BooleanField(default=True)
    scopes = models.JSONField(default=default_scopes)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def clean(self):
        super().clean()
        if not isinstance(self.scopes, list) or any(
            not isinstance(scope, str) or scope not in SCOPES for scope in self.scopes
        ):
            raise ValidationError({"scopes": "Use a list of supported MCP scopes."})

    def __str__(self):
        return f"MCP: {self.user}"


class McpMutation(models.Model):
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE)
    client_id = models.CharField(max_length=255)
    request_id = models.UUIDField()
    tool_name = models.CharField(max_length=128)
    body_hash = models.CharField(max_length=64)
    status = models.CharField(max_length=16, default="pending")
    result = models.JSONField(default=dict)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=("user", "client_id", "request_id"),
                name="mcp_mutation_user_client_request_unique",
            )
        ]
