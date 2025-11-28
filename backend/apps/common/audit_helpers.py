"""
Помощники для логирования аудита через Django signals.
"""

import json
from typing import Any, Dict, Optional

from django.db.models import Model
from django.http import HttpRequest
from django.utils.html import escape


def serialize_model_fields(instance, exclude_fields=None):
    """Преобразовать поля модели в JSON-совместимый формат"""
    exclude_fields = exclude_fields or []
    result = {}

    for field in instance._meta.fields:
        if field.name in exclude_fields:
            continue

        value = getattr(instance, field.name, None)

        # Преобразование специальных типов
        if value is None:
            result[field.name] = None
        elif hasattr(value, "isoformat"):  # DateTime, Date
            result[field.name] = value.isoformat()
        elif isinstance(value, (int, str, bool, float)):
            result[field.name] = value
        else:
            # Fallback: преобразовать в строку
            result[field.name] = str(value)

    return result


def get_changed_fields(instance, old_values: Optional[Dict] = None) -> Dict[str, Any]:
    """
    Получить изменённые поля с 'было - стало' формат.

    Args:
        instance: Экземпляр модели
        old_values: Словарь со старыми значениями {field_name: old_value}

    Returns:
        Словарь формата {field_name: {'old': old_value, 'new': new_value}}
    """
    if not old_values:
        return {}

    changes = {}
    for field in instance._meta.fields:
        field_name = field.name
        if field_name not in old_values:
            continue

        old_value = old_values.get(field_name)
        new_value = getattr(instance, field_name, None)

        # Преобразовать DateTime/Date значения в строку для сравнения
        if old_value is not None and hasattr(old_value, "isoformat"):
            old_value = old_value.isoformat()
        if new_value is not None and hasattr(new_value, "isoformat"):
            new_value = new_value.isoformat()

        # Добавить только если значение действительно изменилось
        if old_value != new_value:
            changes[field_name] = {
                "old": old_value,
                "new": new_value,
            }

    return changes


def store_old_values(instance):
    """
    Сохранить текущие значения полей в instance._old_value для последующего использования в post_save.
    Должен быть вызван в pre_save сигнале.
    """
    old_values = {}
    for field in instance._meta.fields:
        old_values[field.name] = getattr(instance, field.name, None)
    instance._old_value = old_values


def get_request_user(request: Optional[HttpRequest]):
    """Безопасно получить пользователя из request"""
    if request and hasattr(request, "user"):
        return request.user if request.user.is_authenticated else None
    return None
