"""Explicit MCP capability descriptions; no arbitrary HTTP or model access."""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Callable

from rest_framework import serializers

Handler = Callable[[dict, Any], Any]
RESERVED_WRITE_FIELDS = {
    "owner",
    "author",
    "author_name",
    "created_by",
    "completed_by",
    "file",
    "drive_folder_id",
    "source_file_id",
    "source_file_ids",
    "attachments",
    "checksum",
    "file_size",
}


@dataclass(frozen=True)
class ToolSpec:
    name: str
    description: str
    input_schema: dict
    handler: Handler
    scopes: frozenset[str] = frozenset({"crm.read"})
    mutating: bool = False
    risky: bool | Callable[[dict, Any], bool] = False
    previewer: Handler | None = None
    meta: dict | None = None
    replay_guard: Callable[[dict, Any, dict], None] | None = None

    def requires_preview(self, arguments, principal):
        return self.risky(arguments, principal) if callable(self.risky) else self.risky


def object_schema(properties=None, required=()):
    return {
        "type": "object",
        "properties": properties or {},
        "required": list(required),
        "additionalProperties": False,
    }


def _field_schema(field):
    if isinstance(field, serializers.ManyRelatedField):
        result = {"type": "array", "items": _field_schema(field.child_relation)}
    elif isinstance(field, (serializers.ListSerializer, serializers.ListField)):
        result = {"type": "array", "items": _field_schema(field.child)}
    elif isinstance(field, serializers.BaseSerializer):
        result = serializer_schema(field)
    elif isinstance(field, serializers.BooleanField):
        result = {"type": "boolean"}
    elif isinstance(field, serializers.IntegerField):
        result = {"type": "integer"}
    elif isinstance(field, serializers.FloatField):
        result = {"type": "number"}
    elif isinstance(field, serializers.DecimalField):
        result = {
            "type": "string",
            "description": "Decimal amount, for example 1250.00.",
        }
    elif isinstance(field, serializers.JSONField):
        result = {}
    elif isinstance(field, serializers.DictField):
        result = {"type": "object"}
    elif isinstance(field, serializers.PrimaryKeyRelatedField):
        model = getattr(getattr(field, "queryset", None), "model", None)
        result = {
            "type": (
                "integer"
                if model
                and model._meta.pk.get_internal_type() in {"AutoField", "BigAutoField"}
                else "string"
            )
        }
    else:
        result = {"type": "string"}
    if isinstance(field, serializers.ChoiceField):
        result = {"enum": list(field.choices)}
    if getattr(field, "max_length", None) and result.get("type") == "string":
        result["maxLength"] = field.max_length
    if getattr(field, "help_text", None):
        result["description"] = str(field.help_text)
    if field.allow_null:
        result = {"anyOf": [result, {"type": "null"}]}
    return result


def serializer_schema(serializer_class, *, partial=False):
    serializer = (
        serializer_class() if isinstance(serializer_class, type) else serializer_class
    )
    fields = {
        name: field
        for name, field in serializer.fields.items()
        if not field.read_only and name not in RESERVED_WRITE_FIELDS
    }
    return object_schema(
        {name: _field_schema(field) for name, field in fields.items()},
        [name for name, field in fields.items() if field.required and not partial],
    )
