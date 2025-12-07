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


class SourceEncodingTestCase(TestCase):
    REPLACEMENT_CHAR = "\ufffd"

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

    def test_no_replacement_symbol_in_python_source(self):
        self.assert_no_replacement_char(iter_files(REPO_ROOT, PYTHON_EXTENSIONS))

    def test_no_replacement_symbol_in_frontend_source(self):
        frontend_dir = REPO_ROOT / "frontend"
        if not frontend_dir.exists():
            self.skipTest("Frontend directory is missing in this checkout")
        self.assert_no_replacement_char(iter_files(frontend_dir, FRONTEND_EXTENSIONS))
