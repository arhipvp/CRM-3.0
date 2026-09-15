from __future__ import annotations

import math
import json
import re
import sqlite3
import uuid
from dataclasses import asdict, dataclass
from functools import cached_property
from typing import Iterable

from .config import Settings
from .extractors import ExtractedPart


@dataclass(frozen=True)
class Citation:
    document_id: str
    filename: str
    location: dict[str, str | int]
    excerpt: str
    score: float = 0.0

    def json(self) -> dict:
        return asdict(self)


def chunks(text: str, size: int = 900, overlap: int = 150) -> Iterable[str]:
    text = " ".join(text.split())
    start = 0
    while start < len(text):
        end = min(len(text), start + size)
        if end < len(text):
            boundary = max(
                text.rfind(". ", start, end) + 1,
                text.rfind(" ", start, end),
            )
            # A delimiter directly after start would create one-character chunks
            # indefinitely when overlap is enabled.  Only use a natural boundary
            # from the latter half of the intended window.
            if boundary > start + size // 2:
                end = boundary
        value = text[start:end].strip()
        if value:
            yield value
        if end >= len(text):
            break
        start = max(end - overlap, start + 1)


class RagIndex:
    def __init__(self, settings: Settings) -> None:
        self.settings = settings

    @cached_property
    def client(self):
        from qdrant_client import QdrantClient

        return QdrantClient(url=self.settings.qdrant_url, timeout=10)

    @cached_property
    def model(self):
        if self.settings.embedding_provider != "local":
            raise RuntimeError("Локальная модель не выбрана для эмбеддингов.")
        from sentence_transformers import SentenceTransformer

        return SentenceTransformer(
            self.settings.embedding_model,
            cache_folder=str(self.settings.data_dir / "models"),
        )

    def _lexical_connection(self) -> sqlite3.Connection:
        self.settings.data_dir.mkdir(parents=True, exist_ok=True)
        connection = sqlite3.connect(self.settings.sqlite_path)
        connection.execute(
            """
            CREATE VIRTUAL TABLE IF NOT EXISTS rag_chunks_fts USING fts5(
              point_id UNINDEXED,
              document_id UNINDEXED,
              filename,
              location UNINDEXED,
              text,
              tokenize='unicode61'
            )
            """
        )
        return connection

    def _delete_lexical_document(self, document_id: str) -> None:
        with self._lexical_connection() as connection:
            connection.execute(
                "DELETE FROM rag_chunks_fts WHERE document_id = ?", (document_id,)
            )

    def _index_lexical_chunks(self, rows: list[tuple[str, dict]]) -> None:
        if not rows:
            return
        with self._lexical_connection() as connection:
            connection.executemany(
                """
                INSERT INTO rag_chunks_fts
                  (point_id, document_id, filename, location, text)
                VALUES (?, ?, ?, ?, ?)
                """,
                [
                    (
                        point_id,
                        payload["document_id"],
                        payload["filename"],
                        json.dumps(payload["location"], ensure_ascii=False),
                        payload["text"],
                    )
                    for point_id, payload in rows
                ],
            )

    def _lexical_search(self, question: str, limit: int) -> list[dict]:
        query = _fts_query(question)
        if not query:
            return []
        with self._lexical_connection() as connection:
            rows = connection.execute(
                """
                SELECT point_id, document_id, filename, location, text
                FROM rag_chunks_fts
                WHERE rag_chunks_fts MATCH ?
                ORDER BY bm25(rag_chunks_fts)
                LIMIT ?
                """,
                (query, limit),
            ).fetchall()
        return [
            {
                "point_id": row[0],
                "document_id": row[1],
                "filename": row[2],
                "location": json.loads(row[3]),
                "text": row[4],
            }
            for row in rows
        ]

    def _seed_lexical_index(self) -> None:
        """Backfill FTS5 once for documents indexed before hybrid retrieval."""
        with self._lexical_connection() as connection:
            existing = connection.execute(
                "SELECT COUNT(*) FROM rag_chunks_fts"
            ).fetchone()[0]
        if existing or not self.client.collection_exists(self.settings.collection):
            return

        offset = None
        while True:
            points, offset = self.client.scroll(
                self.settings.collection,
                limit=256,
                offset=offset,
                with_payload=True,
                with_vectors=False,
            )
            rows = []
            for point in points:
                payload = point.payload or {}
                if {"document_id", "filename", "location", "text"} <= payload.keys():
                    rows.append((str(point.id), payload))
            self._index_lexical_chunks(rows)
            if offset is None:
                break

    def _embed(self, texts: list[str]) -> list[list[float]]:
        if self.settings.embedding_provider == "local":
            vectors = self.model.encode(
                texts, normalize_embeddings=True, show_progress_bar=False
            )
            return [vector.tolist() for vector in vectors]
        if self.settings.embedding_provider != "polza":
            raise RuntimeError(
                "Неизвестный провайдер эмбеддингов. Используйте 'polza' или 'local'."
            )
        if not self.settings.polza_api_key:
            raise RuntimeError("Не задан POLZA_AI_API_KEY для эмбеддингов Polza.ai.")

        import httpx

        vectors: list[list[float]] = []
        for batch in _batches(texts, self.settings.embedding_batch_size):
            response = httpx.post(
                f"{self.settings.polza_base_url.rstrip('/')}/embeddings",
                headers={"Authorization": f"Bearer {self.settings.polza_api_key}"},
                json={
                    "input": batch,
                    "model": self.settings.embedding_model,
                    "encoding_format": "float",
                },
                timeout=60,
            )
            response.raise_for_status()
            payload = response.json()
            response_vectors = [
                item["embedding"]
                for item in sorted(payload["data"], key=lambda item: item["index"])
            ]
            if len(response_vectors) != len(batch):
                raise RuntimeError("Polza.ai вернула неполный набор эмбеддингов.")
            vectors.extend(_normalize(vector) for vector in response_vectors)
        return vectors

    def healthy(self) -> bool:
        try:
            self.client.get_collections()
            return True
        except Exception:
            return False

    def _ensure_collection(self) -> None:
        from qdrant_client.models import Distance, VectorParams

        if self.client.collection_exists(self.settings.collection):
            return
        dimension = len(self._embed(["проверка"])[0])
        self.client.create_collection(
            self.settings.collection,
            vectors_config=VectorParams(size=dimension, distance=Distance.COSINE),
        )

    def index(self, document_id: str, parts: list[ExtractedPart]) -> int:
        from qdrant_client.models import PointStruct

        self._ensure_collection()
        self.delete_document(document_id)
        texts: list[str] = []
        payloads: list[dict] = []
        for part in parts:
            for ordinal, content in enumerate(chunks(part.text)):
                texts.append(content)
                payloads.append(
                    {
                        "document_id": document_id,
                        "filename": part.filename,
                        "location": _location_payload(part.location),
                        "text": content,
                        "ordinal": ordinal,
                    }
                )
        if not texts:
            return 0
        vectors = self._embed(texts)
        points = [
            PointStruct(
                id=_point_id(document_id, index),
                vector=vector,
                payload=payload,
            )
            for index, (vector, payload) in enumerate(
                zip(vectors, payloads, strict=True)
            )
        ]
        for batch in _batches(points, self.settings.embedding_batch_size):
            self.client.upsert(self.settings.collection, points=batch, wait=True)
        self._index_lexical_chunks(
            [
                (_point_id(document_id, index), payload)
                for index, payload in enumerate(payloads)
            ]
        )
        return len(points)

    def delete_document(self, document_id: str) -> None:
        from qdrant_client.models import FieldCondition, Filter, MatchValue

        if self.client.collection_exists(self.settings.collection):
            self.client.delete(
                self.settings.collection,
                points_selector=Filter(
                    must=[
                        FieldCondition(
                            key="document_id", match=MatchValue(value=document_id)
                        )
                    ]
                ),
                wait=True,
            )
        self._delete_lexical_document(document_id)

    def search(self, question: str, limit: int | None = None) -> list[Citation]:
        if not self.client.collection_exists(self.settings.collection):
            return []
        # Users often say “без справок”, while the rules use the formal
        # wording “без предоставления документов” and point 11.2.4.1.
        # Add that legal vocabulary before embedding so semantic retrieval
        # does not miss the exact clause.
        expanded_question = _expand_query(question)
        vector = self._embed([expanded_question])[0]
        result_limit = limit or self.settings.top_k
        candidate_limit = max(
            result_limit * 4, self.settings.retrieval_candidates, result_limit
        )
        results = self.client.query_points(
            self.settings.collection, query=vector, limit=candidate_limit
        ).points
        self._seed_lexical_index()
        lexical = self._lexical_search(expanded_question, candidate_limit)
        candidates: dict[str, dict] = {}
        scores: dict[str, float] = {}
        rrf_constant = 60
        for rank, item in enumerate(results, start=1):
            point_id = str(item.id)
            candidates[point_id] = {
                "document_id": item.payload["document_id"],
                "filename": item.payload["filename"],
                "location": _location_payload(item.payload["location"]),
                "text": item.payload["text"],
            }
            scores[point_id] = scores.get(point_id, 0.0) + (
                self.settings.retrieval_semantic_weight / (rrf_constant + rank)
            )
        for rank, item in enumerate(lexical, start=1):
            point_id = item["point_id"]
            candidates.setdefault(point_id, item)
            scores[point_id] = scores.get(point_id, 0.0) + (
                self.settings.retrieval_lexical_weight / (rrf_constant + rank)
            )

        ranked = sorted(
            candidates,
            key=lambda point_id: scores[point_id],
            reverse=True,
        )
        selected: list[Citation] = []
        deferred: list[str] = []
        document_counts: dict[str, int] = {}
        max_per_document = max(1, self.settings.retrieval_max_per_document)
        for point_id in ranked:
            document_id = candidates[point_id]["document_id"]
            if document_counts.get(document_id, 0) >= max_per_document:
                deferred.append(point_id)
                continue
            selected.append(_citation(candidates[point_id], scores[point_id]))
            document_counts[document_id] = document_counts.get(document_id, 0) + 1
            if len(selected) >= result_limit:
                break
        if len(selected) < result_limit:
            for point_id in deferred:
                selected.append(_citation(candidates[point_id], scores[point_id]))
                if len(selected) >= result_limit:
                    break
        return selected


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


def _fts_query(question: str) -> str:
    normalized = " ".join(question.lower().split())
    clauses = re.findall(r"\d+(?:\.\d+)+", normalized)
    words = re.findall(r"[a-zа-яё]{2,}", normalized, flags=re.IGNORECASE)
    stop_words = {
        "без",
        "для",
        "или",
        "как",
        "при",
        "про",
        "что",
        "это",
        "есть",
        "проверь",
        "сейчас",
    }
    terms = [word for word in words if word not in stop_words]
    phrases = re.findall(
        r"(?:без\s+предоставления\s+документов|без\s+справок)",
        normalized,
        flags=re.IGNORECASE,
    )
    values: list[str] = []
    for value in [*clauses, *phrases, *terms]:
        escaped = value.replace('"', '""')
        quoted = f'"{escaped}"'
        if quoted not in values:
            values.append(quoted)
    return " OR ".join(values)


def _citation(item: dict, score: float) -> Citation:
    return Citation(
        document_id=item["document_id"],
        filename=item["filename"],
        location=_location_payload(item["location"]),
        excerpt=item["text"],
        score=score,
    )


def _point_id(document_id: str, ordinal: int) -> str:
    return str(
        uuid.uuid5(uuid.NAMESPACE_URL, f"insurance-assistant:{document_id}:{ordinal}")
    )


def _normalize(vector: list[float]) -> list[float]:
    length = math.sqrt(sum(value * value for value in vector))
    if not length:
        raise RuntimeError("Провайдер вернул нулевой вектор эмбеддинга.")
    return [value / length for value in vector]


def _batches(items: list, size: int) -> Iterable[list]:
    if size < 1:
        raise ValueError("Размер пакета эмбеддингов должен быть положительным.")
    for start in range(0, len(items), size):
        yield items[start : start + size]


def _location_payload(location: str | dict[str, str | int]) -> dict[str, str | int]:
    """Turn extractor labels into the browser's stable citation contract."""
    if isinstance(location, dict):
        return location
    if match := re.fullmatch(r"страница (\d+)", location):
        return {"page": int(match.group(1))}
    if match := re.fullmatch(r"лист (.+)", location):
        return {"sheet": match.group(1)}
    if match := re.fullmatch(r"слайд (\d+)", location):
        return {"slide": int(match.group(1))}
    if match := re.match(r"вложение ([^;]+)", location):
        return {"attachment_name": match.group(1)}
    return {"label": location}
