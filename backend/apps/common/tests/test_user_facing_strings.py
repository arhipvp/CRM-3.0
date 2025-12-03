import importlib
import inspect
import unicodedata
from typing import Iterable

from django.apps import apps
from django.contrib import admin
from django.test import TestCase


def _collect_admin_strings() -> Iterable[str]:
    for app_config in apps.get_app_configs():
        module_name = f"{app_config.name}.admin"
        try:
            module = importlib.import_module(module_name)
        except ModuleNotFoundError:
            continue
        for attr_name in dir(module):
            attr = getattr(module, attr_name)
            if not inspect.isclass(attr) or not issubclass(attr, admin.ModelAdmin):
                continue

            fieldsets = getattr(attr, "fieldsets", None)
            for fieldset in fieldsets or ():
                if fieldset and isinstance(fieldset[0], str):
                    yield fieldset[0]

            for member in (getattr(attr, name) for name in dir(attr)):
                description = getattr(member, "short_description", None)
                if description is None:
                    continue
                if getattr(member, "__module__", "") != module.__name__:
                    continue
                yield str(description)


def _collect_model_strings() -> Iterable[str]:
    for model in apps.get_models():
        meta = model._meta
        yield str(meta.verbose_name)
        yield str(meta.verbose_name_plural)
        for field in meta.get_fields():
            verbose_name = getattr(field, "verbose_name", None)
            if verbose_name:
                yield str(verbose_name)
            help_text = getattr(field, "help_text", None)
            if help_text:
                yield str(help_text)


def _is_printable(value: str) -> bool:
    for ch in value:
        if ch == "\n":
            continue
        if unicodedata.category(ch).startswith("C"):
            return False
    return True


def _has_cyrillic_letter(value: str) -> bool:
    for ch in value:
        if not ch.isalpha():
            continue
        try:
            if "CYRILLIC" in unicodedata.name(ch):
                return True
        except ValueError:
            return False
    return False


def _has_latin_letters_only(value: str) -> bool:
    letters = [ch for ch in value if ch.isalpha()]
    if not letters:
        return True
    for ch in letters:
        try:
            if "LATIN" not in unicodedata.name(ch):
                return False
        except ValueError:
            return False
    return True


class UserFacingStringsTests(TestCase):
    def _assert_user_string(self, value: str) -> None:
        normalized = value.strip()
        self.assertTrue(normalized, "User-facing string is empty")
        self.assertTrue(
            _is_printable(normalized),
            "User-facing string contains control symbols",
        )
        if _has_cyrillic_letter(normalized) or _has_latin_letters_only(normalized):
            return
        self.fail(
            "User-facing string %r does not contain Cyrillic letters "
            "and is not pure Latin" % normalized
        )

    def test_admin_strings_are_readable(self):
        strings = list(_collect_admin_strings())
        self.assertTrue(strings, "No admin strings were collected for validation")
        for value in strings:
            self._assert_user_string(value)

    def test_model_strings_are_readable(self):
        strings = list(_collect_model_strings())
        self.assertTrue(strings, "No model strings were collected for validation")
        for value in strings:
            self._assert_user_string(value)
