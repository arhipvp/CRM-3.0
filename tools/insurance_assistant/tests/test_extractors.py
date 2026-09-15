from pathlib import Path

from app.extractors import ExtractedPart, extract
from app.rag import _location_payload


def test_extracts_utf8_text(tmp_path: Path):
    source = tmp_path / "условия.txt"
    source.write_text("Страховой случай подтверждён.", encoding="utf-8")
    assert extract(source) == [
        ExtractedPart("Страховой случай подтверждён.", "текст", source.name)
    ]


def test_extracts_eml_body(tmp_path: Path):
    source = tmp_path / "mail.eml"
    source.write_text(
        "Subject: Продление\nContent-Type: text/plain; charset=utf-8\n\nНаправить предложение.",
        encoding="utf-8",
    )
    assert "Направить предложение" in extract(source)[0].text


def test_location_payload_keeps_pdf_page_for_citation():
    assert _location_payload("страница 7") == {"page": 7}
