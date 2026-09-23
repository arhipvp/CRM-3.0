"""Django/PostgreSQL + Qdrant hybrid retrieval for shared insurance sources."""

from __future__ import annotations

import re
from functools import lru_cache
from pathlib import Path
from uuid import UUID, uuid4

from django.conf import settings
from django.contrib.postgres.search import SearchQuery, SearchRank, SearchVector
from django.db import connection
from django.db.models import Case, IntegerField, Q, Value, When
from django.utils import timezone

from .rag_extractors import extract
from .rag_polza import embed


def _models():
    from .models import AiChunk, AiDocument

    return AiDocument, AiChunk


def _collection() -> str:
    return getattr(
        settings, "AI_ASSISTANT_QDRANT_COLLECTION", "crm_insurance_documents_v2"
    )


@lru_cache(maxsize=1)
def _client():
    from qdrant_client import QdrantClient

    return QdrantClient(
        url=getattr(settings, "AI_ASSISTANT_QDRANT_URL", "http://qdrant:6333"),
        timeout=30,
    )


def _batches(items: list, size: int):
    for start in range(0, len(items), size):
        yield items[start : start + size]


def _chunks(text: str, size: int = 900, overlap: int = 150):
    text = " ".join(text.split())
    start = 0
    while start < len(text):
        end = min(len(text), start + size)
        if end < len(text):
            boundary = max(
                text.rfind(". ", start, end) + 1, text.rfind(" ", start, end)
            )
            if boundary > start + size // 2:
                end = boundary
        value = text[start:end].strip()
        if value:
            yield value
        if end >= len(text):
            break
        start = max(end - overlap, start + 1)


def _classification(document) -> dict[str, str]:
    return {
        key: value
        for key in (
            "insurer",
            "insurance_kind",
            "product",
            "document_type",
            "effective_from",
            "effective_to",
        )
        if (value := getattr(document, key, None))
    }


def _ensure_collection(dimension: int) -> None:
    from qdrant_client.models import Distance, VectorParams

    if not _client().collection_exists(_collection()):
        _client().create_collection(
            _collection(),
            vectors_config=VectorParams(size=dimension, distance=Distance.COSINE),
        )


def delete_document_index(document_id) -> None:
    """Delete both indexes. The document row and uploaded file remain untouched."""
    from qdrant_client.models import FieldCondition, Filter, MatchValue

    _, AiChunk = _models()
    if _client().collection_exists(_collection()):
        _client().delete(
            _collection(),
            points_selector=Filter(
                must=[
                    FieldCondition(
                        key="document_id", match=MatchValue(value=str(document_id))
                    )
                ]
            ),
            wait=True,
        )
    AiChunk.objects.filter(document_id=document_id).delete()


def index_document(document_id) -> int:
    """Extract and index one document; called by the separate index worker."""
    from qdrant_client.models import PointStruct

    AiDocument, AiChunk = _models()
    document = AiDocument.objects.get(pk=document_id)
    document.status = "processing"
    document.error = ""
    document.save(update_fields=["status", "error"])
    try:
        parts = extract(Path(document.file.path), document.filename)
        payloads = [
            (part.filename, part.location, content)
            for part in parts
            for content in _chunks(part.text)
        ]
        # Perform the paid embedding call before replacing the old index.
        vectors = embed([item[2] for item in payloads]) if payloads else []
        delete_document_index(document_id)
        if vectors:
            _ensure_collection(len(vectors[0]))
        chunks = [
            AiChunk(
                id=uuid4(),
                document=document,
                text=text,
                location=location,
                page=location.get("page"),
                chunk_index=index,
            )
            for index, (_, location, text) in enumerate(payloads)
        ]
        AiChunk.objects.bulk_create(chunks, batch_size=256)
        if connection.vendor == "postgresql" and chunks:
            AiChunk.objects.filter(document=document).update(
                search_vector=SearchVector("text", config="simple")
            )
        classification = _classification(document)
        points = [
            PointStruct(
                id=str(chunk.id),
                vector=vector,
                payload={
                    "document_id": str(document.id),
                    "filename": filename,
                    "location": location,
                    "classification": classification,
                },
            )
            for chunk, vector, (filename, location, _) in zip(
                chunks, vectors, payloads, strict=True
            )
        ]
        for batch in _batches(points, 128):
            _client().upsert(_collection(), points=batch, wait=True)
        document.status = "ready"
        document.chunks_count = len(chunks)
        document.error = ""
        document.indexed_at = timezone.now()
        document.save(update_fields=["status", "chunks_count", "error", "indexed_at"])
        return len(chunks)
    except Exception:
        # Never expose provider exception bodies or a Docker volume path to users.
        try:
            delete_document_index(document_id)
        finally:
            document.status = "error"
            document.chunks_count = 0
            document.error = "Не удалось обработать документ. Проверьте формат файла и повторите загрузку."
            document.save(update_fields=["status", "chunks_count", "error"])
        raise


def _scoped_documents(scope: list[dict]):
    AiDocument, _ = _models()
    documents = AiDocument.objects.filter(status="ready")
    if not scope:
        return documents
    union = Q(pk__in=[])
    for branch in scope:
        if branch.get("unclassified"):
            union |= (
                (Q(insurer="") | Q(insurer__isnull=True))
                & (Q(insurance_kind="") | Q(insurance_kind__isnull=True))
                & (Q(product="") | Q(product__isnull=True))
            )
            continue
        branch_filter = Q()
        has_field = False
        for field in ("insurer", "insurance_kind", "product"):
            value = branch.get(field)
            if value:
                branch_filter &= Q(**{field: value})
                has_field = True
        if has_field:
            union |= branch_filter
    return documents.filter(union)


def _expand_query(question: str) -> str:
    normalized = " ".join(question.lower().split())
    if "без справок" in normalized and any(
        term in normalized for term in ("каско", "ремонт", "урегули", "поврежд")
    ):
        return (
            f"{question} 11.2.4.1 без предоставления документов при повреждении "
            "застрахованного транспортного средства"
        )
    return question


def _lexical_candidates(question: str, document_ids: list[UUID], limit: int):
    _, AiChunk = _models()
    if not document_ids:
        return []
    clauses = re.findall(r"\d+(?:\.\d+)+", question)
    words = [
        word
        for word in re.findall(r"[a-zа-яё]{3,}", question.lower())
        if word
        not in {"для", "или", "как", "при", "про", "что", "это", "есть", "сейчас"}
    ]
    terms = list(dict.fromkeys([*clauses, *words]))
    if not terms:
        return []
    exact_filter = Q()
    for clause in clauses:
        exact_filter |= Q(text__icontains=clause)
    if connection.vendor == "postgresql":
        search_query = None
        for term in terms:
            item = SearchQuery(term, config="simple", search_type="plain")
            search_query = item if search_query is None else search_query | item
        return list(
            AiChunk.objects.filter(document_id__in=document_ids)
            .annotate(
                search_rank=SearchRank("search_vector", search_query),
                exact_match=(
                    Case(
                        When(exact_filter, then=Value(1)),
                        default=Value(0),
                        output_field=IntegerField(),
                    )
                    if clauses
                    else Value(0)
                ),
            )
            .filter(Q(search_vector=search_query) | exact_filter)
            .order_by("-exact_match", "-search_rank", "id")[:limit]
        )
    word_filter = exact_filter
    for word in words:
        word_filter |= Q(text__icontains=word)
    return list(
        AiChunk.objects.filter(document_id__in=document_ids).filter(word_filter)[:limit]
    )


def _citation(chunk, score: float) -> dict:
    return {
        "id": str(chunk.id),
        "document_id": str(chunk.document_id),
        "filename": chunk.document.filename,
        "location": chunk.location,
        "excerpt": chunk.text,
        "score": score,
        "classification": _classification(chunk.document),
    }


def search(question: str, scope: list[dict], top_k: int = 8) -> list[dict]:
    """Filter scope before RRF so excluded insurers cannot leak into citations."""
    _, AiChunk = _models()
    document_ids = list(_scoped_documents(scope).values_list("id", flat=True))
    if not document_ids:
        return []
    candidate_limit = max(
        top_k * 4, int(getattr(settings, "AI_ASSISTANT_RETRIEVAL_CANDIDATES", 32))
    )
    expanded = _expand_query(question)
    lexical = _lexical_candidates(expanded, document_ids, candidate_limit)
    semantic_ids: list[str] = []
    try:
        semantic_available = _client().collection_exists(_collection())
    except Exception:
        semantic_available = False
    if semantic_available:
        from qdrant_client.models import FieldCondition, Filter, MatchAny

        try:
            vector = embed([expanded])[0]
            result = _client().query_points(
                _collection(),
                query=vector,
                limit=candidate_limit,
                query_filter=Filter(
                    must=[
                        FieldCondition(
                            key="document_id",
                            match=MatchAny(any=[str(value) for value in document_ids]),
                        )
                    ]
                ),
            )
            semantic_ids = [str(item.id) for item in result.points]
        except Exception:
            # PostgreSQL lexical evidence remains usable during a vector outage.
            semantic_ids = []
    scores: dict[str, float] = {}
    for weight, sequence in (
        (float(getattr(settings, "AI_ASSISTANT_SEMANTIC_WEIGHT", 1.0)), semantic_ids),
        (
            float(getattr(settings, "AI_ASSISTANT_LEXICAL_WEIGHT", 1.0)),
            [str(item.id) for item in lexical],
        ),
    ):
        for rank, chunk_id in enumerate(sequence, 1):
            scores[chunk_id] = scores.get(chunk_id, 0) + weight / (60 + rank)
    if not scores:
        return []
    ranked = sorted(scores, key=scores.__getitem__, reverse=True)
    chunk_map = {
        str(item.id): item
        for item in AiChunk.objects.filter(
            id__in=ranked, document_id__in=document_ids
        ).select_related("document")
    }
    result = []
    counts: dict[str, int] = {}
    max_per_document = max(
        1, int(getattr(settings, "AI_ASSISTANT_MAX_PER_DOCUMENT", 3))
    )
    deferred = []
    for chunk_id in ranked:
        chunk = chunk_map.get(chunk_id)
        if chunk is None:
            continue
        document_id = str(chunk.document_id)
        if counts.get(document_id, 0) >= max_per_document:
            deferred.append(chunk_id)
            continue
        result.append(_citation(chunk, scores[chunk_id]))
        counts[document_id] = counts.get(document_id, 0) + 1
        if len(result) >= top_k:
            break
    for chunk_id in deferred[: max(0, top_k - len(result))]:
        result.append(_citation(chunk_map[chunk_id], scores[chunk_id]))
    return result
