from pathlib import Path

PLACEHOLDER = "????"


def _read_text(path: str) -> str:
    # Try CP1251 first because some files still use legacy encoding.
    try:
        return Path(path).read_text(encoding="cp1251")
    except UnicodeDecodeError:
        return Path(path).read_text(encoding="latin-1")


def test_serializers_no_placeholder_text():
    content = _read_text("apps/deals/serializers.py")
    assert PLACEHOLDER not in content, "serializers.py contains placeholder text"


def test_scripts_no_placeholder_text():
    content = _read_text("scripts/import_business_data.py")
    assert (
        PLACEHOLDER not in content
    ), "import_business_data.py contains placeholder text"
