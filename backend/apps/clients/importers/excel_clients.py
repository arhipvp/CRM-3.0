from __future__ import annotations

from datetime import date, datetime
from typing import Any, Mapping, MutableMapping, Optional

from django.contrib.auth import get_user_model
from django.db import models
from openpyxl.worksheet.worksheet import Worksheet

HEADER_TO_FIELD = {
    "name": "name",
    "client": "name",
    "client name": "name",
    "phone": "phone",
    "phone number": "phone",
    "mobile": "phone",
    "email": "email",
    "e-mail": "email",
    "email address": "email",
    "contact email": "email",
    "birth date": "birth_date",
    "birthday": "birth_date",
    "date of birth": "birth_date",
    "notes": "notes",
    "comment": "notes",
    "description": "notes",
}


def _normalize_header(header: Optional[str]) -> Optional[str]:
    return header.strip().lower() if isinstance(header, str) else None


def _parse_date(value: Any) -> Optional[date]:
    if value is None or value == "":
        return None

    if isinstance(value, date):
        return value

    if isinstance(value, datetime):
        return value.date()

    text = str(value).strip()
    if not text:
        return None

    for fmt in ("%Y-%m-%d", "%d.%m.%Y", "%d/%m/%Y"):
        try:
            return datetime.strptime(text, fmt).date()
        except ValueError:
            continue

    raise ValueError(f"Не удалось разобрать дату: {text}")


def read_client_rows(sheet: Worksheet) -> list[tuple[int, Mapping[str, Any]]]:
    header_row = next(sheet.iter_rows(min_row=1, max_row=1, values_only=True))
    headers: list[str] = []
    for raw in header_row:
        normalized = _normalize_header(raw)
        headers.append(normalized or "")

    mapped_headers: list[str] = [HEADER_TO_FIELD.get(header, "") for header in headers]

    parsed: list[tuple[int, Mapping[str, object]]] = []
    for idx, row in enumerate(sheet.iter_rows(min_row=2, values_only=True), start=2):
        row_dict: MutableMapping[str, Any] = {}
        any_value = False
        for header, value in zip(mapped_headers, row):
            if header:
                row_dict[header] = value
            if value not in (None, "", False):
                any_value = True

        if any_value:
            parsed.append((idx, row_dict))

    return parsed


def build_client_payload(
    data: Mapping[str, Any], creator: models.Model | None
) -> dict[str, Any]:
    name = data.get("name")
    if not name or not str(name).strip():
        raise ValueError("поле 'Name' обязательно для заполнения")

    payload: dict[str, object] = {
        "name": str(name).strip(),
        "phone": str(data.get("phone", "") or "").strip(),
        "notes": str(data.get("notes", "") or "").strip(),
    }

    birth_value = data.get("birth_date")
    if birth_value not in (None, "", False):
        payload["birth_date"] = _parse_date(birth_value)

    email_value = str(data.get("email", "") or "").strip()
    if email_value:
        payload["email"] = email_value

    if creator:
        payload["created_by"] = creator

    return payload


def resolve_creator(identifier: Optional[str]) -> models.Model | None:
    if not identifier:
        return None

    User = get_user_model()
    lookup = {"pk": identifier} if identifier.isdigit() else {"email": identifier}
    creator = User.objects.filter(**lookup).first()
    if creator:
        return creator

    creator = User.objects.filter(username=identifier).first()
    if creator:
        return creator

    raise ValueError(f"Пользователь '{identifier}' не найден.")
