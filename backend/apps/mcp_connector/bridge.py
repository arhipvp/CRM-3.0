"""Production-only internal dispatch into a fixed set of user-authorized DRF views."""

from __future__ import annotations

import hashlib
import json
from contextlib import contextmanager
from contextvars import ContextVar
from dataclasses import dataclass, field
from io import BytesIO
from urllib.parse import urlencode, urlsplit

from django.conf import settings
from django.core.handlers.wsgi import WSGIRequest
from django.core.serializers.json import DjangoJSONEncoder
from django.db import connection, models
from django.db.models.fields.files import FieldFile
from django.db.models.signals import pre_save
from django.dispatch import receiver
from django.http import Http404
from rest_framework.authentication import BaseAuthentication
from rest_framework.exceptions import PermissionDenied, ValidationError

from .registry import RESERVED_WRITE_FIELDS

_TRUSTED = object()
_actor = ContextVar("mcp_audit_actor", default=None)
_replaying = ContextVar("mcp_replaying", default=False)
_WORK_APPS = {
    "clients",
    "deals",
    "tasks",
    "policies",
    "finances",
    "notes",
    "documents",
    "chat",
    "insurance_requests",
    "ai_assistant",
    "mailboxes",
}
_SECRET_NAMES = {
    "initial_password",
    "mailbox_initial_password",
    "password",
    "token_hash",
    "access_token",
    "refresh_token",
    "client_secret",
    "imap_password",
}


class BridgeError(Exception):
    def __init__(self, code, message, *, status=400, details=None):
        super().__init__(message)
        self.code, self.status, self.details = code, status, details


def json_value(value):
    def encode(item):
        if isinstance(item, FieldFile):
            return item.name
        return DjangoJSONEncoder().default(item)

    return json.loads(json.dumps(value, default=encode, ensure_ascii=False))


def redact(value):
    if isinstance(value, dict):
        return {
            key: redact(item)
            for key, item in value.items()
            if key.casefold() not in _SECRET_NAMES
        }
    if isinstance(value, (list, tuple)):
        return [redact(item) for item in value]
    return value


def digest(value):
    return hashlib.sha256(
        json.dumps(
            json_value(value), ensure_ascii=False, sort_keys=True, separators=(",", ":")
        ).encode("utf-8")
    ).hexdigest()


@receiver(pre_save, dispatch_uid="mcp_connector.audit_context")
def _attach_audit_actor(sender, instance, **kwargs):
    user = _actor.get()
    if user is None:
        return
    if sender._meta.app_label in _WORK_APPS:
        instance._audit_actor = user
    if sender._meta.label_lower == "users.auditlog":
        if instance.actor_id is None:
            instance.actor = user
        if "[ChatGPT]" not in instance.description:
            instance.description = f"[ChatGPT] {instance.description}"
    if sender._meta.label_lower == "insurance_requests.recordhistory":
        instance.actor = user
        instance.snapshot = {**(instance.snapshot or {}), "channel": "ChatGPT"}


@contextmanager
def audit_context(user):
    token = _actor.set(user)
    try:
        yield
    finally:
        _actor.reset(token)


@contextmanager
def replay_access():
    token = _replaying.set(True)
    try:
        yield
    finally:
        _replaying.reset(token)


class _TrustedPrincipalAuthentication(BaseAuthentication):
    def authenticate(self, request):
        raw = request._request
        if getattr(raw, "_mcp_trusted", None) is not _TRUSTED:
            raise PermissionDenied("Internal MCP request required.")
        return raw._mcp_user, None


@dataclass(frozen=True)
class Route:
    view: type
    action: str
    method: str = "GET"
    params: dict = field(default_factory=dict)
    serializer: type | None = None
    guard: str = "edit"


def _request(route, arguments, principal):
    body = json.dumps(arguments.get("data", {}), cls=DjangoJSONEncoder).encode("utf-8")
    base = urlsplit(getattr(settings, "MCP_PUBLIC_BASE_URL", "https://zoom78.com"))
    filters = arguments.get("filters", {})
    query = urlencode(
        {
            key: str(value).lower() if isinstance(value, bool) else value
            for key, value in filters.items()
        },
        doseq=True,
    )
    raw = WSGIRequest(
        {
            "REQUEST_METHOD": route.method,
            "PATH_INFO": "/api/v1/",
            "SCRIPT_NAME": "",
            "QUERY_STRING": query,
            "SERVER_NAME": base.hostname or "localhost",
            "SERVER_PORT": "443",
            "HTTP_HOST": base.netloc or "localhost",
            "wsgi.url_scheme": "https",
            "wsgi.input": BytesIO(body),
            "CONTENT_LENGTH": str(len(body)),
            "CONTENT_TYPE": "application/json",
        }
    )
    raw._mcp_trusted, raw._mcp_user = _TRUSTED, principal.user
    return raw


def _view_class(route):
    return type(
        f"Mcp{route.view.__name__}",
        (route.view,),
        {"authentication_classes": (_TrustedPrincipalAuthentication,)},
    )


def prepare_view(route, arguments, principal):
    kwargs = {target: arguments[source] for target, source in route.params.items()}
    view = _view_class(route)()
    if hasattr(view, "action_map") or hasattr(view, "get_extra_actions"):
        view.action_map = {route.method.lower(): route.action}
    raw = _request(route, arguments, principal)
    view.setup(raw, **kwargs)
    request = view.initialize_request(raw, **kwargs)
    view.request, view.args, view.kwargs, view.format_kwarg = request, (), kwargs, None
    view.initial(request, **kwargs)
    return view


def related_deal(instance):
    if instance is None:
        return None
    if instance._meta.label_lower == "deals.deal":
        return instance
    for name in (
        "deal",
        "vehicle",
        "mortgage",
        "insurance_request",
        "request_version",
        "payment",
        "policy",
    ):
        parent = getattr(instance, name, None)
        if isinstance(parent, models.Model):
            found = related_deal(parent)
            if found is not None:
                return found
    return None


def require_deal(user, deal, *, write=False):
    from apps.deals.models import Deal
    from apps.deals.permissions import build_deal_visibility_q, is_admin_user
    from apps.policies.permissions import user_can_modify_deal

    if deal.deleted_at is not None and not _replaying.get():
        raise PermissionDenied("The related deal is deleted.")
    if write:
        if not user_can_modify_deal(user, deal):
            raise PermissionDenied("No permission to modify the related deal.")
    elif (
        not is_admin_user(user)
        and not Deal.objects.with_deleted()
        .filter(pk=deal.pk)
        .filter(build_deal_visibility_q(user))
        .exists()
    ):
        raise PermissionDenied("No access to the related deal.")


def _walk_models(value):
    if isinstance(value, models.Model):
        yield value
    elif isinstance(value, dict):
        for item in value.values():
            yield from _walk_models(item)
    elif isinstance(value, (list, tuple)):
        for item in value:
            yield from _walk_models(item)


def _check_note_attachments(deal, attachments):
    from apps.common.drive import build_drive_file_tree_map

    if not attachments:
        return
    if deal is None:
        raise ValidationError("Attachments require a deal.")
    roots = {deal.drive_folder_id, getattr(deal.client, "drive_folder_id", None)}
    roots.update(deal.policies.values_list("drive_folder_id", flat=True))
    authorized = set()
    for root in roots - {None, ""}:
        authorized.update(build_drive_file_tree_map(root))
    if any(
        not isinstance(item, dict) or item.get("id") not in authorized
        for item in attachments
    ):
        raise PermissionDenied(
            "An attachment does not belong to this deal's authorized folders."
        )


def _snapshot(instance):
    result = {
        "model": instance._meta.label_lower,
        "fields": {
            f.attname: getattr(instance, f.attname)
            for f in instance._meta.concrete_fields
        },
    }
    result["relations"] = {}
    for relation in instance._meta.get_fields():
        if not relation.is_relation or (
            not relation.one_to_many and not relation.many_to_many
        ):
            continue
        name = relation.get_accessor_name() if relation.auto_created else relation.name
        manager = getattr(instance, name, None)
        if manager is None or not hasattr(manager, "all"):
            continue
        rows = manager.all()
        if connection.in_atomic_block:
            rows = rows.select_for_update()
        # Snapshot dependencies, including timestamps, without serializing file bytes.
        result["relations"][name] = sorted(
            (
                json_value(
                    {
                        f.attname: getattr(item, f.attname)
                        for f in item._meta.concrete_fields
                    }
                )
                for item in rows
            ),
            key=lambda item: str(item.get("id", "")),
        )
        if rows.model._meta.label_lower == "finances.financialrecord":
            from apps.finances.models import Payment

            payments = Payment.objects.filter(
                pk__in=rows.values_list("payment_id", flat=True)
            ).order_by("pk")
            if connection.in_atomic_block:
                payments = payments.select_for_update()
            result["relations"][name + "_payment_state"] = [
                json_value(
                    {
                        f.attname: getattr(payment, f.attname)
                        for f in payment._meta.concrete_fields
                    }
                )
                for payment in payments
            ]
    return json_value(result)


def preflight(route, arguments, principal):
    """Only permission checks, serializer validation and SELECTs; never dispatch actions."""
    if (
        route.method not in {"GET", "HEAD"}
        and set(arguments.get("data", {})) & RESERVED_WRITE_FIELDS
    ):
        raise ValidationError(
            "File attachments, storage paths and server-owned fields require their dedicated tools."
        )
    view = prepare_view(route, arguments, principal)
    instance = None
    session_clients = []
    if "session_id" in view.kwargs and hasattr(view, "_get_merge_session"):
        from apps.clients.models import Client

        instance = view._get_merge_session(principal.user, view.kwargs["session_id"])
        ids = [instance.target_client_id, *instance.source_client_ids]
        query = Client.objects.with_deleted().filter(pk__in=ids).order_by("pk")
        if connection.in_atomic_block and route.method != "GET":
            query = query.select_for_update()
        session_clients = list(query)
        if len(session_clients) != len(set(str(item) for item in ids)):
            raise ValidationError("A client in the merge session is unavailable.")
        if route.method != "GET" and any(
            not view._can_merge_client(principal.user, client)
            for client in session_clients
        ):
            raise PermissionDenied(
                "No permission to change a client in this merge session."
            )
    if "pk" in view.kwargs and hasattr(view, "get_object"):
        try:
            instance = view.get_object()
        except Http404:
            if not (_replaying.get() or route.action == "restore"):
                raise
            model = view.get_queryset().model
            manager = (
                model.objects.with_deleted()
                if hasattr(model.objects, "with_deleted")
                else model.objects.all()
            )
            instance = manager.get(pk=view.kwargs["pk"])
        if route.method not in {"GET", "HEAD"} and route.guard == "edit":
            allowed = getattr(view, "_can_modify", lambda user, obj: True)(
                principal.user, instance
            )
            executor_check = getattr(view, "_can_executor_update_status", None)
            if not allowed and not (
                executor_check and executor_check(view.request, instance)
            ):
                raise PermissionDenied("No permission to change this record.")
            if hasattr(view, "authorize"):
                view.authorize(instance)
    if route.view.__module__ == "apps.ai_assistant.views":
        from apps.ai_assistant.models import AiConversation, AiDocument
        from apps.ai_assistant.views import _can_manage_library
        from django.shortcuts import get_object_or_404

        if "conversation_id" in view.kwargs:
            instance = get_object_or_404(
                AiConversation, pk=view.kwargs["conversation_id"], owner=principal.user
            )
        if "document_id" in view.kwargs:
            instance = get_object_or_404(AiDocument, pk=view.kwargs["document_id"])
        if route.view.__name__ in {
            "DocumentDetailView",
            "DocumentClassificationView",
        } and not _can_manage_library(principal.user):
            raise PermissionDenied("No permission to manage the shared AI library.")
    if (
        instance is not None
        and route.method not in {"GET", "HEAD"}
        and connection.in_atomic_block
    ):
        instance = instance.__class__._base_manager.select_for_update().get(
            pk=instance.pk
        )
        view.check_object_permissions(view.request, instance)
        if route.guard == "edit" and not session_clients:
            allowed = getattr(view, "_can_modify", lambda user, obj: True)(
                principal.user, instance
            )
            executor_check = getattr(view, "_can_executor_update_status", None)
            if not allowed and not (
                executor_check and executor_check(view.request, instance)
            ):
                raise PermissionDenied("No permission to change this record.")
            if hasattr(view, "authorize"):
                view.authorize(instance)
    serializer = None
    if route.serializer is not None:
        serializer = route.serializer(
            instance=instance,
            data=arguments.get("data", {}),
            partial=route.action in {"partial_update", "draft_update"},
            context={"request": view.request, "view": view},
        )
        serializer.is_valid(raise_exception=True)
    elif route.action in {"create", "partial_update", "update"} and hasattr(
        view, "get_serializer"
    ):
        serializer = view.get_serializer(
            instance=instance,
            data=arguments.get("data", {}),
            partial=route.action == "partial_update",
        )
        serializer.is_valid(raise_exception=True)
    related = (
        list(_walk_models(serializer.validated_data)) if serializer else []
    ) + session_clients
    for index, obj in enumerate(related):
        if connection.in_atomic_block and route.method not in {"GET", "HEAD"}:
            obj = obj.__class__._base_manager.select_for_update().get(pk=obj.pk)
            related[index] = obj
        if getattr(obj, "deleted_at", None) is not None:
            raise ValidationError("A related record is deleted.")
        deal = related_deal(obj)
        if deal is not None:
            require_deal(
                principal.user, deal, write=route.method not in {"GET", "HEAD"}
            )
        if obj._meta.label_lower == "users.user" and not obj.is_active:
            raise ValidationError("The selected user is inactive.")
    if instance is not None:
        deal = related_deal(instance)
        own_deleted_root = instance is deal and (
            route.action == "restore"
            or (_replaying.get() and route.action == "destroy")
        )
        if deal is not None and not own_deleted_root:
            require_deal(principal.user, deal)
        if (
            instance._meta.label_lower == "notes.note"
            and route.action == "destroy"
            and instance.attachments
        ):
            from .auth import require_access

            require_access(principal, {"crm.files"})
            _check_note_attachments(deal, instance.attachments)
        if instance._meta.app_label == "insurance_requests":
            from apps.codex_reader.lifecycle import dependencies

            entities = {
                "dealparticipant": "participant",
                "clientpassport": "passport",
                "driverlicense": "driver_license",
                "vehicle": "vehicle",
                "vehicleregistration": "vehicle_registration",
                "vehicletitle": "vehicle_title",
                "mortgage": "mortgage",
                "mortgagebalance": "mortgage_balance",
            }
            entity = entities.get(instance._meta.model_name)
            if entity and (
                route.action == "destroy"
                or arguments.get("data", {}).get("is_current") is False
            ):
                blockers = dependencies(instance, entity)
                if blockers:
                    raise ValidationError(
                        {
                            "blockers": "The record is used by open insurance requests.",
                            "requests": blockers,
                        }
                    )
    if (
        serializer
        and hasattr(view, "_ensure_user_can_create_note")
        and instance is None
    ):
        view._ensure_user_can_create_note(serializer.validated_data.get("deal"))
    if (
        serializer
        and view.__class__.__name__ == "McpNoteViewSet"
        and "attachments" in serializer.validated_data
    ):
        _check_note_attachments(
            serializer.validated_data.get("deal", getattr(instance, "deal", None)),
            serializer.validated_data["attachments"],
        )
    if serializer and instance is None and hasattr(view, "authorize"):
        candidate = serializer.Meta.model(
            **{
                key: value
                for key, value in serializer.validated_data.items()
                if key != "drivers"
            }
        )
        view.authorize(candidate)
    return view, instance, related


def route_preview(route, arguments, principal):
    view, instance, related = preflight(route, arguments, principal)
    snapshots = [_snapshot(obj) for obj in ([instance] if instance else []) + related]
    # Resolve object IDs in custom actions through the view's authorized queryset.
    data = arguments.get("data", {})
    for field_name in (
        "target_deal_id",
        "source_deal_ids",
        "target_client_id",
        "source_client_ids",
        "candidate_client_id",
        "record_ids",
    ):
        identifiers = data.get(field_name, [])
        if not isinstance(identifiers, list):
            identifiers = [identifiers]
        for identifier in identifiers:
            if identifier is None:
                continue
            if "client" in field_name:
                from apps.clients.models import Client

                query = (
                    Client.objects.select_for_update()
                    if connection.in_atomic_block
                    else Client.objects
                )
                obj = query.get(pk=identifier)
                if not view._can_modify(principal.user, obj):
                    raise PermissionDenied("No permission to merge this client.")
            elif field_name == "record_ids":
                from apps.finances.models import FinancialRecord
                from apps.finances.permissions import user_has_deal_access

                query = (
                    FinancialRecord.objects.select_for_update()
                    if connection.in_atomic_block
                    else FinancialRecord.objects
                )
                obj = query.get(pk=identifier)
                if not user_has_deal_access(
                    principal.user, related_deal(obj), allow_executor=False
                ):
                    raise PermissionDenied(
                        "No permission to change the financial record."
                    )
            else:
                from apps.deals.models import Deal
                from apps.deals.permissions import can_merge_deals

                query = (
                    Deal.objects.select_for_update()
                    if connection.in_atomic_block
                    else Deal.objects
                )
                obj = query.get(pk=identifier)
                if not can_merge_deals(principal.user, obj):
                    raise PermissionDenied("No permission to merge this deal.")
            snapshots.append(_snapshot(obj))
    deactivated = []
    if hasattr(view, "get_queryset"):
        model = view.get_queryset().model
        owner_field = getattr(model, "current_owner_field", None)
        current = data.get("is_current", getattr(instance, "is_current", True))
        owner_id = data.get(owner_field) if owner_field else None
        if owner_field and instance is not None and owner_id is None:
            owner_id = getattr(instance, owner_field + "_id", None)
        if owner_field and current and owner_id:
            previous = (
                model.objects.filter(
                    **{owner_field + "_id": owner_id, "is_current": True}
                )
                .exclude(pk=instance.pk if instance is not None else None)
                .order_by("pk")
            )
            if connection.in_atomic_block:
                previous = previous.select_for_update()
            for document in previous:
                snapshots.append(_snapshot(document))
                deactivated.append(
                    {
                        "model": document._meta.label_lower,
                        "id": str(document.pk),
                        "is_current": {"before": True, "after": False},
                    }
                )
    return {
        "fingerprint": digest(snapshots),
        "changes": {
            "action": route.action,
            "record_id": str(instance.pk) if instance else None,
            "before": redact(snapshots[0]["fields"]) if instance else None,
            "requested": redact(data),
            **({"deactivated_records": deactivated} if deactivated else {}),
        },
    }


def call_route(route, arguments, principal):
    preflight(route, arguments, principal)
    view_class = _view_class(route)
    kwargs = {target: arguments[source] for target, source in route.params.items()}
    raw = _request(route, arguments, principal)
    callback = (
        view_class.as_view({route.method.lower(): route.action})
        if hasattr(view_class, "get_extra_actions")
        else view_class.as_view()
    )
    with audit_context(principal.user):
        response = callback(raw, **kwargs)
    if response.status_code >= 400:
        raise BridgeError(
            "crm_request_failed",
            "CRM rejected this operation.",
            status=response.status_code,
            details=redact(json_value(getattr(response, "data", {}))),
        )
    if not hasattr(response, "data"):
        raise BridgeError(
            "unsupported_response", "Use a dedicated file tool for binary content."
        )
    data = redact(json_value(response.data))
    if len(json.dumps(data, ensure_ascii=False).encode("utf-8")) > 5 * 1024 * 1024:
        raise BridgeError(
            "response_too_large",
            "Response exceeds 5 MiB; use narrower filters or pagination.",
            status=413,
        )
    return {"status": response.status_code, "data": data}
