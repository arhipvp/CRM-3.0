from pathlib import Path
from typing import Iterable

from django.test import TestCase


def iter_source_files() -> Iterable[Path]:
    root = Path(__file__).resolve().parent.parent
    for path in root.rglob("*.py"):
        if (
            ".venv" in path.parts
            or "migrations" in path.parts
            or "__pycache__" in path.parts
        ):
            continue
        yield path


class SourceEncodingTestCase(TestCase):
    REPLACEMENT_CHAR = "\ufffd"

    def test_no_replacement_symbol_in_source(self):
        failures: list[str] = []
        for path in iter_source_files():
            text = path.read_text(encoding="utf-8", errors="ignore")
            if self.REPLACEMENT_CHAR in text:
                failures.append(str(path))
        if failures:
            self.fail(
                f"Found unicode replacement character '{self.REPLACEMENT_CHAR}' in source files:\n"
                + "\n".join(failures)
            )
