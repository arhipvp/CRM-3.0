"""Pure change previews and connection-scoped durable mutation deduplication."""

from __future__ import annotations

import uuid

from django.core import signing
from django.db import IntegrityError, transaction

from .bridge import (
    BridgeError,
    audit_context,
    digest,
    json_value,
    redact,
    replay_access,
)
from .models import McpMutation

PREVIEW_SALT = "crm3-mcp-preview-v1"
PREVIEW_SECONDS = 1800


def _access(principal, scopes):
    from .auth import require_access

    return require_access(principal, scopes)


def preview_change(spec, arguments, principal):
    principal = _access(principal, spec.scopes | {"crm.destructive"})
    if not spec.mutating or spec.previewer is None:
        raise BridgeError("preview_unavailable", "This tool has no mutation preview.")
    prepared = spec.previewer(arguments, principal)
    payload = {
        "user": str(principal.user.pk),
        "client": principal.client_id,
        "tool": spec.name,
        "body": digest(arguments),
        "fingerprint": digest(prepared["fingerprint"]),
    }
    return {
        "committed": False,
        "tool_name": spec.name,
        "changes": redact(json_value(prepared.get("changes", {}))),
        "preview_token": signing.dumps(payload, salt=PREVIEW_SALT, compress=True),
        "expires_in": PREVIEW_SECONDS,
        "confirmation": "Show these changes to the user and obtain their explicit confirmation in ChatGPT before crm_apply_change.",
    }


def _validate_preview(spec, arguments, principal, preview_token, confirmed):
    if confirmed is not True:
        raise BridgeError(
            "confirmation_required",
            "Explicit user confirmation in ChatGPT is required.",
        )
    try:
        saved = signing.loads(preview_token, salt=PREVIEW_SALT, max_age=PREVIEW_SECONDS)
    except (signing.BadSignature, TypeError, ValueError):
        raise BridgeError(
            "preview_expired",
            "Preview is invalid or expired; preview again.",
            status=409,
        ) from None
    expected = {
        "user": str(principal.user.pk),
        "client": principal.client_id,
        "tool": spec.name,
        "body": digest(arguments),
    }
    if not isinstance(saved, dict) or any(
        saved.get(key) != value for key, value in expected.items()
    ):
        raise BridgeError(
            "preview_mismatch",
            "Preview belongs to another user, connection, tool or payload.",
            status=409,
        )
    prepared = spec.previewer(arguments, principal)
    if saved.get("fingerprint") != digest(prepared["fingerprint"]):
        raise BridgeError(
            "sources_changed", "Source data changed; preview again.", status=409
        )


def mutate(
    spec, arguments, principal, request_id, *, preview_token=None, confirmed=False
):
    required = spec.scopes | (
        {"crm.destructive"}
        if preview_token is not None or spec.requires_preview(arguments, principal)
        else set()
    )
    principal = _access(principal, required)
    try:
        request_uuid = uuid.UUID(str(request_id))
    except (ValueError, TypeError, AttributeError):
        raise BridgeError(
            "invalid_request_id", "A UUID request_id is required for every write."
        ) from None
    body_hash = digest({"tool": spec.name, "arguments": arguments})
    lookup = {
        "user": principal.user,
        "client_id": principal.client_id,
        "request_id": request_uuid,
    }

    def replay(record):
        if record.body_hash != body_hash or record.tool_name != spec.name:
            raise BridgeError(
                "idempotency_conflict",
                "This request_id was used for a different operation.",
                status=409,
            )
        if record.status == "completed":
            # A replay must not disclose a stored response after ownership changes.
            if spec.previewer:
                with replay_access():
                    spec.previewer(arguments, principal)
            if spec.replay_guard:
                spec.replay_guard(arguments, principal, record.result)
            return {**record.result, "replayed": True}
        raise BridgeError(
            "operation_pending" if record.status == "pending" else "operation_failed",
            "This operation is pending or needs review; do not retry with a new request_id.",
            status=409,
        )

    existing = McpMutation.objects.filter(**lookup).first()
    if existing:
        return replay(existing)
    risky = spec.requires_preview(arguments, principal) or preview_token is not None
    if risky:
        if spec.previewer is None or preview_token is None:
            raise BridgeError(
                "preview_required",
                "Use crm_preview_change and crm_apply_change for this operation.",
                status=409,
            )
        _validate_preview(spec, arguments, principal, preview_token, confirmed)
    elif spec.previewer:
        spec.previewer(arguments, principal)
    # A reservation commits before external work. A crashed/uncertain operation is
    # deliberately not retried automatically: Mailcow/Drive may already have acted.
    with transaction.atomic():
        try:
            with transaction.atomic():
                record, created = McpMutation.objects.get_or_create(
                    **lookup, defaults={"tool_name": spec.name, "body_hash": body_hash}
                )
        except IntegrityError:
            record, created = McpMutation.objects.get(**lookup), False
        record = McpMutation.objects.select_for_update().get(pk=record.pk)
        if not created:
            return replay(record)
    try:
        with transaction.atomic(), audit_context(principal.user):
            if risky:
                # The bridge's preflight locks roots and related records while
                # recomputing the fingerprint; locks remain through the handler.
                _validate_preview(spec, arguments, principal, preview_token, confirmed)
            result = spec.handler(arguments, principal)
        if not isinstance(result, dict):
            raise BridgeError(
                "invalid_mutation_result",
                "Mutation handlers must return a JSON object.",
            )
        result = redact(json_value(result))
        from apps.users.models import AuditLog

        AuditLog.objects.create(
            actor=principal.user,
            object_type="mcp",
            object_id=str(record.pk),
            object_name=spec.name,
            action="update",
            description=f"[ChatGPT] {spec.name}",
            new_value={
                "channel": "ChatGPT",
                "tool": spec.name,
                "request_id": str(request_uuid),
            },
        )
        McpMutation.objects.filter(pk=record.pk).update(
            status="completed", result=result
        )
        return {**result, "replayed": False}
    except Exception as exc:
        # Validation/authorization failures are safe to correct using a fresh
        # request UUID. Unknown external failures must be checked before retrying.
        code = exc.code if isinstance(exc, BridgeError) else "operation_failed"
        McpMutation.objects.filter(pk=record.pk).update(
            status="failed", result={"error": {"code": code}}
        )
        raise
