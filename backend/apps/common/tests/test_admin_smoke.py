from __future__ import annotations

from dataclasses import dataclass
from importlib import import_module
from typing import Iterable

from django.apps import apps
from django.contrib import admin
from django.contrib.admin.sites import site
from django.core.exceptions import FieldDoesNotExist
from django.db import models
from django.test import RequestFactory, SimpleTestCase


class _PermissiveUser:
    is_active = True
    is_staff = True
    is_superuser = True

    @property
    def is_authenticated(self) -> bool:
        return True

    def has_perm(self, perm: str, obj=None) -> bool:  # noqa: ARG002
        return True

    def has_perms(self, perm_list: Iterable[str], obj=None) -> bool:  # noqa: ARG002
        return True


@dataclass(frozen=True)
class _AdminIssue:
    location: str
    message: str


def _iter_field_names_from_fieldsets(fieldsets) -> Iterable[str]:
    for _name, opts in fieldsets or ():
        fields = opts.get("fields") if isinstance(opts, dict) else None
        if not fields:
            continue
        for item in fields:
            if isinstance(item, (list, tuple)):
                yield from item
            else:
                yield item


def _normalize_search_field(name: str) -> str:
    return name.lstrip("^=@")


def _resolve_field_path(model: type[models.Model], path: str) -> None:
    current = model
    for part in path.split("__"):
        field = current._meta.get_field(part)
        if getattr(field, "remote_field", None) and getattr(
            field.remote_field, "model", None
        ):
            current = field.remote_field.model
        else:
            current = field  # type: ignore[assignment]


def _check_attr_or_field(
    model_admin: admin.ModelAdmin, model: type[models.Model], name: str
) -> None:
    if hasattr(model_admin, name) or hasattr(model, name):
        return
    model._meta.get_field(name)


class AdminSmokeTests(SimpleTestCase):
    def test_registered_admins_reference_existing_fields(self):
        for app_config in apps.get_app_configs():
            try:
                import_module(f"{app_config.name}.admin")
            except ModuleNotFoundError:
                continue

        rf = RequestFactory()
        request = rf.get("/admin/")
        request.user = _PermissiveUser()

        issues: list[_AdminIssue] = []

        for model, model_admin in site._registry.items():
            admin_label = f"{model._meta.app_label}.{model.__name__}"

            try:
                model_admin.get_form(request)
            except Exception as exc:  # noqa: BLE001
                issues.append(
                    _AdminIssue(
                        location=f"{admin_label}.get_form",
                        message=f"{type(exc).__name__}: {exc}",
                    )
                )

            for attr in ("fields", "readonly_fields"):
                value = getattr(model_admin, attr, None)
                if not value:
                    continue
                for name in value:
                    if isinstance(name, (list, tuple)):
                        continue
                    try:
                        _check_attr_or_field(model_admin, model, name)
                    except (FieldDoesNotExist, Exception) as exc:  # noqa: BLE001
                        issues.append(
                            _AdminIssue(
                                location=f"{admin_label}.{attr}",
                                message=f"{name}: {type(exc).__name__}: {exc}",
                            )
                        )

            for name in _iter_field_names_from_fieldsets(
                getattr(model_admin, "fieldsets", None)
            ):
                try:
                    _check_attr_or_field(model_admin, model, name)
                except (FieldDoesNotExist, Exception) as exc:  # noqa: BLE001
                    issues.append(
                        _AdminIssue(
                            location=f"{admin_label}.fieldsets",
                            message=f"{name}: {type(exc).__name__}: {exc}",
                        )
                    )

            for name in getattr(model_admin, "list_display", ()) or ():
                if callable(name):
                    continue
                try:
                    _check_attr_or_field(model_admin, model, str(name))
                except (FieldDoesNotExist, Exception) as exc:  # noqa: BLE001
                    issues.append(
                        _AdminIssue(
                            location=f"{admin_label}.list_display",
                            message=f"{name}: {type(exc).__name__}: {exc}",
                        )
                    )

            for raw in getattr(model_admin, "search_fields", ()) or ():
                name = _normalize_search_field(str(raw))
                if not name:
                    continue
                try:
                    _resolve_field_path(model, name)
                except (FieldDoesNotExist, Exception) as exc:  # noqa: BLE001
                    issues.append(
                        _AdminIssue(
                            location=f"{admin_label}.search_fields",
                            message=f"{raw}: {type(exc).__name__}: {exc}",
                        )
                    )

            for item in getattr(model_admin, "list_filter", ()) or ():
                if not isinstance(item, str):
                    continue
                try:
                    _resolve_field_path(model, item)
                except (FieldDoesNotExist, Exception) as exc:  # noqa: BLE001
                    issues.append(
                        _AdminIssue(
                            location=f"{admin_label}.list_filter",
                            message=f"{item}: {type(exc).__name__}: {exc}",
                        )
                    )

            try:
                inline_instances = model_admin.get_inline_instances(request)
            except Exception as exc:  # noqa: BLE001
                issues.append(
                    _AdminIssue(
                        location=f"{admin_label}.get_inline_instances",
                        message=f"{type(exc).__name__}: {exc}",
                    )
                )
                inline_instances = []

            for inline in inline_instances:
                inline_label = f"{admin_label}.{inline.__class__.__name__}"
                try:
                    inline.get_formset(request)
                except Exception as exc:  # noqa: BLE001
                    issues.append(
                        _AdminIssue(
                            location=f"{inline_label}.get_formset",
                            message=f"{type(exc).__name__}: {exc}",
                        )
                    )

        if issues:
            rendered = "\n".join(f"- {i.location}: {i.message}" for i in issues)
            self.fail(f"Найдены проблемы в админке:\n{rendered}")
