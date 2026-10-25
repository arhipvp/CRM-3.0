"""One previewed policy import, with a durable, resumable Drive move phase."""

from __future__ import annotations

import copy
import re

from apps.common import drive
from apps.common.drive_sync import defer_folder_sync
from apps.finances.serializers import PaymentSerializer
from apps.insurance_requests.quote_links import validate_policy_link
from apps.policies.models import Policy
from apps.policies.serializers import PolicyDraftSerializer, PolicySerializer
from apps.policies.services.files import detach_source_files_from_notes
from apps.policies.services.finance import (
    _ensure_edit_allowed,
    _ensure_policy_number_is_available,
    apply_policy_draft,
)
from apps.policies.services.import_defaults import prepare_import_finances
from apps.policies.views import PolicyViewSet
from apps.users.models import AuditLog
from django.db import connection
from rest_framework.exceptions import PermissionDenied, ValidationError

from .auth import require_access
from .bridge import BridgeError, Route, digest, json_value, preflight, route_preview
from .files import MAX_CATALOG_FILES, _drive_file_id, _raw_drive_id
from .mutations import CONTINUATION_KEY
from .registry import ToolSpec, object_schema, serializer_schema

SCOPES = frozenset({"crm.read", "crm.write"})
_RAW_ID = re.compile(r"^[A-Za-z0-9_-]{1,256}$")


def _source_id(value):
    raw = _raw_drive_id(value) if value.startswith("d_") else value
    if not _RAW_ID.fullmatch(raw):
        raise ValidationError("Use a Drive file ID from the selected deal.")
    return raw


def _source_tree(deal):
    """Do not descend into trash, shortcuts or any existing policy folder."""
    excluded = set(
        Policy.objects.with_deleted()
        .exclude(drive_folder_id__isnull=True)
        .exclude(drive_folder_id="")
        .values_list("drive_folder_id", flat=True)
    )
    pending = [deal.drive_folder_id] if deal.drive_folder_id else []
    visited, result = set(), {}
    while pending:
        folder = pending.pop()
        if folder in visited or folder in excluded:
            continue
        visited.add(folder)
        for item in drive.list_drive_folder_contents(folder):
            if item["name"].strip().casefold() == drive.TRASH_FOLDER_NAME.casefold():
                continue
            if item["is_folder"]:
                pending.append(item["id"])
            elif item["mime_type"] != "application/vnd.google-apps.shortcut":
                result[item["id"]] = dict(item, parent_id=folder)
            if len(result) + len(visited) + len(pending) > MAX_CATALOG_FILES:
                raise ValidationError("File catalog exceeds 5000 entries.")
    return result


def _file_plan(deal, file_ids, principal):
    if not file_ids:
        return []
    require_access(principal, {"crm.files"})
    tree = _source_tree(deal)
    files = []
    for raw in dict.fromkeys(_source_id(value) for value in file_ids):
        item = tree.get(raw)
        if item is None:
            raise PermissionDenied("Source file is outside the deal's import folders.")
        metadata = drive.get_drive_file_metadata(raw)
        if not metadata.get("checksum"):
            raise ValidationError(
                "Import an original uploaded document with a Drive checksum; native Google documents and shortcuts are not supported."
            )
        if (
            metadata["id"] != raw
            or metadata["trashed"]
            or metadata["is_folder"]
            or metadata["parents"] != [item["parent_id"]]
        ):
            raise ValidationError("Source file location changed; preview again.")
        files.append(
            {
                "file_id": _drive_file_id(raw),
                "name": metadata["name"],
                "source_parent_id": _drive_file_id(item["parent_id"]),
                "expected": {
                    key: metadata.get(key)
                    for key in (
                        "name",
                        "size",
                        "mime_type",
                        "checksum",
                        "modified_at",
                        "version",
                    )
                },
                "status": "pending",
            }
        )
    return files


def _wire(value):
    if hasattr(value, "_meta"):
        return str(value.pk)
    if isinstance(value, dict):
        return {key: _wire(item) for key, item in value.items()}
    if isinstance(value, (tuple, list)):
        return [_wire(item) for item in value]
    return json_value(value)


def _lock(obj):
    if obj is not None and connection.in_atomic_block:
        return obj.__class__._base_manager.select_for_update().get(pk=obj.pk)
    return obj


def _prepare(arguments, principal):
    principal = require_access(principal, SCOPES)
    raw = copy.deepcopy(arguments["data"])
    source_ids = raw.pop("source_file_ids", [])
    route = Route(
        PolicyViewSet, "draft_create", "POST", serializer=PolicyDraftSerializer
    )
    # Reuse all section-specific permissions and related-object checks. Raw file
    # fields never reach the generic bridge or the legacy best-effort move path.
    base = route_preview(route, {"data": raw}, principal)
    serializer = PolicyDraftSerializer(data=raw)
    serializer.is_valid(raise_exception=True)
    data = serializer.validated_data.copy()
    deal = data.get("deal")
    if deal is None:
        raise ValidationError({"deal": "Укажите сделку для полиса."})
    deal = _lock(deal)
    data["deal"] = deal
    _ensure_edit_allowed(principal.user, None, deal)
    _ensure_policy_number_is_available(data["number"])
    data = validate_policy_link(data)
    for payment in data.get("payments", []):
        if payment.get("id") or any(
            item.get("id")
            for key in ("incomes", "expenses")
            for item in payment.get(key, [])
        ):
            raise ValidationError("A new policy cannot reuse existing financial IDs.")

    client = _lock(deal.client)
    referrer = _lock(client.referred_by) if client else None
    executor = _lock(deal.executor)
    if client:
        client.referred_by = referrer
    deal.client, deal.executor = client, executor
    data = prepare_import_finances(data)
    files = _file_plan(deal, source_ids, principal)
    requested = _wire(data)
    dependencies = {
        "client": (
            {"id": str(client.pk), "updated_at": str(client.updated_at)}
            if client
            else None
        ),
        "referrer": (
            {
                "id": str(referrer.pk),
                "updated_at": str(referrer.updated_at),
                "deleted_at": str(referrer.deleted_at),
            }
            if referrer
            else None
        ),
        "executor": (
            {
                "id": executor.pk,
                "name": executor.get_full_name(),
                "username": executor.username,
                "active": executor.is_active,
            }
            if executor
            else None
        ),
    }
    return {
        "data": data,
        "files": files,
        "fingerprint": digest(
            {
                "base": base["fingerprint"],
                "requested": requested,
                "defaults": dependencies,
                "files": files,
            }
        ),
        "changes": {
            "action": "draft_create",
            "requested": requested,
            "file_moves": [
                {
                    "file_id": item["file_id"],
                    "name": item["name"],
                    "source_parent_id": item["source_parent_id"],
                    "target_policy_number": data["number"],
                }
                for item in files
            ],
        },
    }


def preview_policy_import(arguments, principal):
    return _prepare(arguments, principal)


def create_policy_import(arguments, principal, prepared=None):
    prepared = prepared if prepared is not None else _prepare(arguments, principal)
    # Client resolution can also create a new client. Both signals must remain
    # database-only until the policy graph and continuation checkpoint commit.
    with defer_folder_sync():
        policy, payments = apply_policy_draft(
            user=principal.user, data=prepared["data"].copy()
        )
    return {
        "status": 200,
        "data": {
            "policy": PolicySerializer(policy).data,
            "payments": PaymentSerializer(payments, many=True).data,
        },
        CONTINUATION_KEY: {
            "policy_id": str(policy.pk),
            "deal_id": str(policy.deal_id),
            "deal_folder_id": policy.deal.drive_folder_id,
            "number": policy.number,
            "target_folder_id": None,
            "files": prepared["files"],
            "status": "files_pending" if prepared["files"] else "completed",
        },
    }


def _saved_policy(principal, result):
    state = result.get(CONTINUATION_KEY)
    if state is None:
        # Completed imports from before this release have no continuation. Their
        # exact retries remain read-only and must never initialize finances/files.
        saved = result.get("data", {}).get("policy", {})
        if not all(saved.get(key) for key in ("id", "deal", "number")):
            raise BridgeError(
                "operation_failed", "The saved import needs review.", status=409
            )
        state = {
            "policy_id": saved["id"],
            "deal_id": saved["deal"],
            "number": saved["number"],
            "files": [],
        }
    principal = require_access(
        principal, SCOPES | ({"crm.files"} if state["files"] else set())
    )
    route = Route(PolicyViewSet, "retrieve", params={"pk": "id"})
    _, policy, _ = preflight(route, {"id": state["policy_id"]}, principal)
    deal = _lock(policy.deal)
    policy = _lock(policy)
    _ensure_edit_allowed(principal.user, None, deal)
    if (
        policy.deleted_at is not None
        or policy.deal_id != deal.pk
        or str(policy.deal_id) != state["deal_id"]
        or policy.number != state["number"]
    ):
        raise BridgeError(
            "sources_changed", "The imported policy changed; review it.", status=409
        )
    if state["files"] and deal.drive_folder_id != state["deal_folder_id"]:
        raise BridgeError(
            "sources_changed", "The deal's file root changed; review it.", status=409
        )
    policy.deal = deal
    return policy


def replay_policy_import(arguments, principal, result):
    _saved_policy(principal, result)


def _check_file(item, metadata, tree, target):
    expected = item["expected"]
    if (
        metadata["id"] != _raw_drive_id(item["file_id"])
        or metadata["trashed"]
        or metadata["is_folder"]
        or any(
            metadata.get(key) != expected[key]
            for key in ("name", "size", "mime_type", "checksum")
        )
    ):
        raise BridgeError("sources_changed", "Source file content changed.", status=409)
    if target and metadata["parents"] == [target]:
        # A move may have succeeded before the process lost its checkpoint.
        # Changing parents can change Drive version/modifiedTime, not the bytes.
        return True
    source = _raw_drive_id(item["source_parent_id"])
    raw = _raw_drive_id(item["file_id"])
    if (
        item["status"] == "moved"
        or raw not in tree
        or tree[raw]["parent_id"] != source
        or metadata["parents"] != [source]
        or any(metadata.get(key) != expected[key] for key in ("modified_at", "version"))
    ):
        raise BridgeError(
            "sources_changed", "Source file location or revision changed.", status=409
        )
    return False


def _transfer_response(result):
    state = result[CONTINUATION_KEY]
    result["data"]["file_transfer"] = {
        "status": state["status"],
        "files": [
            {
                key: item[key]
                for key in ("file_id", "name", "status", "error")
                if key in item
            }
            for item in state["files"]
        ],
        **({"error": state["error"]} if state.get("error") else {}),
    }
    return result


def finish_policy_import(arguments, principal, saved_result):
    result = copy.deepcopy(saved_result)
    state = result[CONTINUATION_KEY]
    policy = _saved_policy(principal, result)
    if not state["files"]:
        state["status"] = "completed"
        return _transfer_response(result)
    require_access(principal, {"crm.files"})
    if (
        state["target_folder_id"]
        and policy.drive_folder_id != state["target_folder_id"]
    ):
        raise BridgeError(
            "sources_changed", "Policy destination changed; review it.", status=409
        )
    current_item = None
    preparing_target = state["target_folder_id"] is None
    try:
        tree = _source_tree(policy.deal)
        target = state["target_folder_id"] or policy.drive_folder_id
        # Validate every file before creating a destination or moving any file.
        for item in state["files"]:
            current_item = item
            metadata = drive.get_drive_file_metadata(_raw_drive_id(item["file_id"]))
            _check_file(item, metadata, tree, target)
        if not target:
            target = drive.ensure_policy_folder(policy)
        if not target:
            raise drive.DriveOperationError("Policy folder is unavailable.")
        folder = drive.get_drive_file_metadata(target)
        if (
            not folder["is_folder"]
            or folder["trashed"]
            or folder["parents"] != [policy.deal.drive_folder_id]
            or Policy.objects.with_deleted()
            .filter(drive_folder_id=target)
            .exclude(pk=policy.pk)
            .exists()
        ):
            raise BridgeError(
                "sources_changed",
                "Policy destination is outside this import.",
                status=409,
            )
        state["target_folder_id"] = target
        state.pop("error", None)
        if preparing_target:
            # This phase commits the target ID before moving any originals.
            # A process loss after a move can then reconcile the exact same ID.
            state["advance"] = True
            result["data"]["policy"]["drive_folder_id"] = policy.drive_folder_id
            return _transfer_response(result)
        for item in state["files"]:
            current_item = item
            raw = _raw_drive_id(item["file_id"])
            metadata = drive.get_drive_file_metadata(raw)
            arrived = _check_file(item, metadata, tree, target)
            if not arrived:
                drive.move_drive_item_between_folders(
                    raw,
                    _raw_drive_id(item["source_parent_id"]),
                    target,
                    expected_metadata=item["expected"],
                )
                metadata = drive.get_drive_file_metadata(raw)
                if not _check_file(item, metadata, tree, target):
                    raise drive.DriveOperationError("Drive did not confirm the move.")
            if item["status"] != "moved":
                detach_source_files_from_notes(policy.deal, [raw])
                AuditLog.objects.create(
                    actor=principal.user,
                    object_type="policy",
                    object_id=str(policy.pk),
                    object_name=policy.number,
                    action="update",
                    description=f"[ChatGPT] Перенесён исходный документ: {item['name']}",
                    new_value={
                        "channel": "ChatGPT",
                        "file_id": item["file_id"],
                        "target_folder_id": _drive_file_id(target),
                    },
                )
            item["status"] = "moved"
            item.pop("error", None)
        state["status"] = "completed"
    except (drive.DriveError, BridgeError) as exc:
        # Preserve the committed CRM graph and precise progress. Do not claim
        # success, erase links for unmoved files, or start a fresh creation.
        code = exc.code if isinstance(exc, BridgeError) else "drive_unavailable"
        state["status"] = "files_pending"
        state["error"] = {"code": code, "retry_with_same_request_id": True}
        if current_item is not None and current_item["status"] != "moved":
            current_item["error"] = {"code": code}
    result["data"]["policy"]["drive_folder_id"] = policy.drive_folder_id
    return _transfer_response(result)


def get_policy_import_spec():
    schema = serializer_schema(PolicyDraftSerializer)
    schema["required"] = list(dict.fromkeys([*schema["required"], "deal"]))
    schema["properties"]["source_file_ids"] = {
        "type": "array",
        "items": {"type": "string", "minLength": 1, "maxLength": 512},
        "description": "Existing deal document IDs (MCP d_ IDs or Drive IDs returned by recognition). Always supply these when importing a document: originals are moved, never copied.",
    }
    return ToolSpec(
        name="crm_create_policy_draft",
        description="Create a policy with all premium payments, commission/expense records and source document moves in one preview/apply. Empty income/expense lists get unpaid 1 RUB placeholders. Payment actual_date records payment of the insurance premium; it does not pay commission or expenses. paid_balance is the sum of dated financial records, not premium payment status. When importing existing deal documents, always pass data.source_file_ids. A files_pending result means the policy is saved but document transfer is incomplete; repeat the identical apply request and request_id to resume, never recreate the policy.",
        input_schema=object_schema({"data": schema}, ["data"]),
        handler=create_policy_import,
        scopes=SCOPES,
        mutating=True,
        risky=True,
        previewer=preview_policy_import,
        replay_guard=replay_policy_import,
        after_commit=finish_policy_import,
        prepared_handler=create_policy_import,
    )
