from pathlib import Path
from typing import Iterable

from django.test import TestCase

REPO_ROOT = Path(__file__).resolve().parent.parent
EXCLUDED_PARTS = {".venv", "__pycache__", "migrations", "node_modules"}
PYTHON_EXTENSIONS = {".py"}
FRONTEND_EXTENSIONS = {
    ".ts",
    ".tsx",
    ".js",
    ".jsx",
    ".json",
    ".css",
    ".scss",
    ".html",
}

ASCII_PRINTABLE = {chr(code) for code in range(0x20, 0x7F)}
WHITESPACE_CHARS = {"\n", "\r", "\t"}
ALLOWED_EXTRA_CHARS = {
    "«",
    "»",
    "—",
    "–",
    "‘",
    "’",
    "“",
    "”",
    "…",
    "·",
    "₽",
    "№",
    "•",
    "\u00a0",
}
RUSSIAN_LETTERS = set(
    "абвгдеёжзийклмнопрстуфхцчшщъыьэюяАБВГДЕЁЖЗИЙКЛМНОПРСТУФХЦЧШЩЪЫЬЭЮЯ"
)
FORM_DIRECTORIES = (
    REPO_ROOT / "frontend" / "src" / "components" / "forms",
    REPO_ROOT / "frontend" / "src" / "components" / "app",
)


def iter_files(root: Path, extensions: Iterable[str]) -> Iterable[Path]:
    lower_extensions = {ext.lower() for ext in extensions}
    for path in root.rglob("*"):
        if path.is_dir():
            continue
        if path.suffix.lower() not in lower_extensions:
            continue
        if any(part in EXCLUDED_PARTS for part in path.parts):
            continue
        yield path


def iter_form_files() -> Iterable[Path]:
    for directory in FORM_DIRECTORIES:
        if not directory.exists():
            continue
        yield from iter_files(directory, FRONTEND_EXTENSIONS)


def is_supported_text_char(char: str) -> bool:
    if char in WHITESPACE_CHARS:
        return True
    if char in ASCII_PRINTABLE:
        return True
    if char in ALLOWED_EXTRA_CHARS:
        return True
    if char == "\ufeff":
        return True
    return char in RUSSIAN_LETTERS


class SourceEncodingTestCase(TestCase):
    REPLACEMENT_CHAR = chr(0xFFFD)

    def assert_no_replacement_char(self, paths: Iterable[Path]) -> None:
        failures: list[str] = []
        for path in paths:
            text = path.read_text(encoding="utf-8", errors="ignore")
            if self.REPLACEMENT_CHAR in text:
                failures.append(str(path))
        if failures:
            self.fail(
                f"Found unicode replacement character '{self.REPLACEMENT_CHAR}' in source files:\n"
                + "\n".join(failures)
            )

    def assert_only_supported_characters(self, paths: Iterable[Path]) -> None:
        failures: list[str] = []
        for path in paths:
            text = path.read_text(encoding="utf-8", errors="ignore")
            for line_no, line in enumerate(text.splitlines(), start=1):
                for char in line:
                    if not is_supported_text_char(char):
                        snippet = line.strip()
                        if not snippet:
                            snippet = "<empty line>"
                        if len(snippet) > 120:
                            snippet = snippet[:120] + "..."
                        failures.append(
                            f"{path}:{line_no} contains {repr(char)} (U+{ord(char):04X}) in {snippet!r}"
                        )
                        break
                else:
                    continue
                break
        if failures:
            self.fail(
                "Found characters outside of the allowed English/Russian set in source files:\n"
                + "\n".join(failures)
            )

    def test_no_replacement_symbol_in_python_source(self):
        self.assert_no_replacement_char(iter_files(REPO_ROOT, PYTHON_EXTENSIONS))

    def test_no_replacement_symbol_in_frontend_source(self):
        frontend_dir = REPO_ROOT / "frontend"
        if not frontend_dir.exists():
            self.skipTest("Frontend directory is missing in this checkout")
        self.assert_no_replacement_char(iter_files(frontend_dir, FRONTEND_EXTENSIONS))

    def test_python_has_only_supported_characters(self):
        self.assert_only_supported_characters(iter_files(REPO_ROOT, PYTHON_EXTENSIONS))

    def test_frontend_has_only_supported_characters(self):
        frontend_dir = REPO_ROOT / "frontend"
        if not frontend_dir.exists():
            self.skipTest("Frontend directory is missing in this checkout")
        paths = list(iter_files(frontend_dir, FRONTEND_EXTENSIONS))
        self.assert_only_supported_characters(paths)

    def test_forms_use_only_english_or_russian(self):
        paths = list(iter_form_files())
        if not paths:
            self.skipTest("Form directories are missing in this checkout")
        self.assert_only_supported_characters(paths)
