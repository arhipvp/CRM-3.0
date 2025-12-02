from pathlib import Path
from typing import Optional

PLACEHOLDER_CHECKS = [
    ("backend/apps/deals/serializers.py", "????"),
    ("scripts/import_business_data.py", "????"),
    (
        "frontend/src/components/views/dealsView/tabs/QuotesTab.tsx",
        "??? ???????",
    ),
]

ROOT_DIR = Path(__file__).resolve().parents[2]


def _read_text(path: str) -> str:
    last_error: Optional[UnicodeDecodeError] = None
    for encoding in ("utf-8", "cp1251", "latin-1"):
        try:
            return (ROOT_DIR / path).read_text(encoding=encoding)
        except UnicodeDecodeError as exc:
            last_error = exc
    assert last_error is not None  # for mypy
    raise last_error


def test_no_placeholder_text():
    for path, placeholder in PLACEHOLDER_CHECKS:
        content = _read_text(path)
        assert (
            placeholder not in content
        ), f"{path} contains placeholder text {placeholder!r}"
