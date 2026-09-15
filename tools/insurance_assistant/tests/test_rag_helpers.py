from dataclasses import replace
from types import SimpleNamespace

import pytest

from app.config import Settings
from app.rag import (
    RagIndex,
    _batches,
    _expand_query,
    _fts_query,
    _normalize,
    _point_id,
    chunks,
)


def test_normalize_returns_unit_vector():
    assert _normalize([3.0, 4.0]) == [0.6, 0.8]


def test_normalize_rejects_zero_vector():
    with pytest.raises(RuntimeError, match="нулевой"):
        _normalize([0.0, 0.0])


def test_batches_preserve_every_item():
    assert list(_batches([1, 2, 3, 4, 5], 2)) == [[1, 2], [3, 4], [5]]


def test_point_id_is_deterministic_uuid():
    assert _point_id("document", 1) == _point_id("document", 1)
    assert len(_point_id("document", 1)) == 36


def test_chunks_do_not_degenerate_into_single_characters():
    text = "Начало. " + "условие страхования " * 120
    values = list(chunks(text, size=100, overlap=20))
    assert len(values) < 40
    assert all(len(value) > 50 for value in values)


def test_expand_query_maps_colloquial_no_documents_wording_to_rule_clause():
    expanded = _expand_query("ремонт без справок по КАСКО")

    assert "11.2.4.1" in expanded
    assert "без предоставления документов" in expanded


def test_expand_query_keeps_unrelated_questions_unchanged():
    question = "Как подать заявление на выплату?"

    assert _expand_query(question) == question


def test_fts_query_preserves_clause_number_and_legal_phrase():
    query = _fts_query("ремонт без справок по КАСКО 11.2.4.1")

    assert '"11.2.4.1"' in query
    assert '"без справок"' in query


def test_fts_index_finds_and_deletes_exact_clause(tmp_path):
    settings = replace(Settings(), data_dir=tmp_path)
    rag = RagIndex(settings)
    payload = {
        "document_id": "doc-1",
        "filename": "rules.pdf",
        "location": {"page": 28},
        "text": "Пункт 11.2.4.1: без предоставления документов при повреждении.",
    }

    rag._index_lexical_chunks([("point-1", payload)])

    assert rag._lexical_search("11.2.4.1", 5)[0]["point_id"] == "point-1"
    rag._delete_lexical_document("doc-1")
    assert rag._lexical_search("11.2.4.1", 5) == []


def test_empty_fts_index_is_backfilled_from_existing_qdrant_points(tmp_path):
    settings = replace(Settings(), data_dir=tmp_path)
    rag = RagIndex(settings)

    class FakeClient:
        def collection_exists(self, _collection):
            return True

        def scroll(self, *_args, **_kwargs):
            return (
                [
                    SimpleNamespace(
                        id="legacy-point",
                        payload={
                            "document_id": "legacy-doc",
                            "filename": "legacy.pdf",
                            "location": {"page": 4},
                            "text": "11.2.4.1 без предоставления документов",
                        },
                    )
                ],
                None,
            )

    rag.__dict__["client"] = FakeClient()
    rag._seed_lexical_index()

    assert rag._lexical_search("11.2.4.1", 5)[0]["point_id"] == "legacy-point"


def test_hybrid_search_fuses_candidates_and_caps_document_duplicates(tmp_path):
    settings = replace(Settings(), data_dir=tmp_path, top_k=3)
    rag = RagIndex(settings)
    payloads = [
        ("semantic", "doc-a", "semantic text"),
        ("exact", "doc-a", "11.2.4.1 без предоставления документов"),
        ("other", "doc-b", "другой документ"),
    ]
    rag._index_lexical_chunks(
        [
            (
                point_id,
                {
                    "document_id": document_id,
                    "filename": f"{document_id}.pdf",
                    "location": {"page": 1},
                    "text": text,
                },
            )
            for point_id, document_id, text in payloads
        ]
    )

    class FakeClient:
        def collection_exists(self, _collection):
            return True

        def query_points(self, _collection, query, limit):
            return SimpleNamespace(
                points=[
                    SimpleNamespace(
                        id="semantic",
                        score=0.9,
                        payload={
                            "document_id": "doc-a",
                            "filename": "doc-a.pdf",
                            "location": {"page": 1},
                            "text": "semantic text",
                        },
                    ),
                    SimpleNamespace(
                        id="exact",
                        score=0.8,
                        payload={
                            "document_id": "doc-a",
                            "filename": "doc-a.pdf",
                            "location": {"page": 1},
                            "text": "11.2.4.1 без предоставления документов",
                        },
                    ),
                ]
            )

    rag.__dict__["client"] = FakeClient()
    rag._embed = lambda texts: [[1.0, 0.0]]
    results = rag.search("11.2.4.1", limit=3)

    assert results[0].document_id == "doc-a"
    assert results[0].excerpt == "11.2.4.1 без предоставления документов"
    assert len({item.excerpt for item in results}) == len(results)
