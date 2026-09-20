from __future__ import annotations

import json
import sqlite3
import uuid
from contextlib import contextmanager
from datetime import UTC, datetime
from pathlib import Path
from typing import Iterator


def now() -> str:
    return datetime.now(UTC).isoformat()


class Store:
    def __init__(self, path: Path) -> None:
        path.parent.mkdir(parents=True, exist_ok=True)
        self.path = path
        self._init()

    @contextmanager
    def connection(self) -> Iterator[sqlite3.Connection]:
        con = sqlite3.connect(self.path)
        con.row_factory = sqlite3.Row
        try:
            yield con
            con.commit()
        finally:
            con.close()

    def _init(self) -> None:
        with self.connection() as con:
            con.executescript(
                """
                CREATE TABLE IF NOT EXISTS documents (
                  id TEXT PRIMARY KEY, filename TEXT NOT NULL, path TEXT NOT NULL,
                  status TEXT NOT NULL, error TEXT, created_at TEXT NOT NULL,
                  indexed_at TEXT, chunks INTEGER NOT NULL DEFAULT 0,
                  insurer TEXT, insurance_kind TEXT, product TEXT,
                  document_type TEXT, effective_from TEXT, effective_to TEXT
                );
                CREATE TABLE IF NOT EXISTS conversations (
                  id TEXT PRIMARY KEY, title TEXT NOT NULL, created_at TEXT NOT NULL,
                  owner_id TEXT
                );
                CREATE TABLE IF NOT EXISTS messages (
                  id TEXT PRIMARY KEY, conversation_id TEXT NOT NULL, role TEXT NOT NULL,
                  content TEXT NOT NULL, citations TEXT NOT NULL DEFAULT '[]', created_at TEXT NOT NULL,
                  provider TEXT, model TEXT, input_tokens INTEGER, output_tokens INTEGER,
                  total_tokens INTEGER, cost_rub REAL, request_status TEXT,
                  FOREIGN KEY(conversation_id) REFERENCES conversations(id)
                );
                """
            )
            columns = {
                row[1] for row in con.execute("PRAGMA table_info(messages)").fetchall()
            }
            additions = {
                "provider": "TEXT",
                "model": "TEXT",
                "input_tokens": "INTEGER",
                "output_tokens": "INTEGER",
                "total_tokens": "INTEGER",
                "cost_rub": "REAL",
                "request_status": "TEXT",
            }
            for name, kind in additions.items():
                if name not in columns:
                    con.execute(f"ALTER TABLE messages ADD COLUMN {name} {kind}")
            conversation_columns = {
                row[1] for row in con.execute("PRAGMA table_info(conversations)").fetchall()
            }
            if "owner_id" not in conversation_columns:
                con.execute("ALTER TABLE conversations ADD COLUMN owner_id TEXT")

            document_columns = {
                row[1] for row in con.execute("PRAGMA table_info(documents)").fetchall()
            }
            document_additions = {
                "insurer": "TEXT",
                "insurance_kind": "TEXT",
                "product": "TEXT",
                "document_type": "TEXT",
                "effective_from": "TEXT",
                "effective_to": "TEXT",
            }
            for name, kind in document_additions.items():
                if name not in document_columns:
                    con.execute(f"ALTER TABLE documents ADD COLUMN {name} {kind}")

    def create_document(
        self, filename: str, path: Path, classification: dict[str, str | None] | None = None
    ) -> str:
        ident = str(uuid.uuid4())
        classification = classification or {}
        with self.connection() as con:
            con.execute(
                """INSERT INTO documents
                (id, filename, path, status, created_at, insurer, insurance_kind, product,
                 document_type, effective_from, effective_to)
                VALUES (?, ?, ?, 'queued', ?, ?, ?, ?, ?, ?, ?)""",
                (
                    ident,
                    filename,
                    str(path),
                    now(),
                    classification.get("insurer"),
                    classification.get("insurance_kind"),
                    classification.get("product"),
                    classification.get("document_type"),
                    classification.get("effective_from"),
                    classification.get("effective_to"),
                ),
            )
        return ident

    def document(self, ident: str) -> dict | None:
        with self.connection() as con:
            row = con.execute("SELECT * FROM documents WHERE id=?", (ident,)).fetchone()
        return dict(row) if row else None

    def documents(self) -> list[dict]:
        with self.connection() as con:
            rows = con.execute(
                "SELECT * FROM documents ORDER BY created_at DESC"
            ).fetchall()
        return [dict(row) for row in rows]

    def update_document_classification(
        self, document_ids: list[str], classification: dict[str, str | None]
    ) -> list[dict]:
        if not document_ids:
            return []
        assignments = (
            classification.get("insurer"),
            classification.get("insurance_kind"),
            classification.get("product"),
            classification.get("document_type"),
            classification.get("effective_from"),
            classification.get("effective_to"),
        )
        placeholders = ", ".join("?" for _ in document_ids)
        with self.connection() as con:
            con.execute(
                f"""UPDATE documents SET insurer=?, insurance_kind=?, product=?,
                document_type=?, effective_from=?, effective_to=?
                WHERE id IN ({placeholders})""",
                (*assignments, *document_ids),
            )
            rows = con.execute(
                f"SELECT * FROM documents WHERE id IN ({placeholders})", document_ids
            ).fetchall()
        return [dict(row) for row in rows]

    def scoped_document_ids(self, scopes: list[dict]) -> list[str] | None:
        """Return an OR-union of scope branches; None means the whole library."""
        if not scopes:
            return None
        clauses: list[str] = []
        parameters: list[str] = []
        for scope in scopes:
            if scope.get("unclassified"):
                clauses.append(
                    "(insurer IS NULL AND insurance_kind IS NULL AND product IS NULL)"
                )
                continue
            conditions: list[str] = []
            for field in ("insurer", "insurance_kind", "product"):
                if value := scope.get(field):
                    conditions.append(f"{field} = ?")
                    parameters.append(value)
            if conditions:
                clauses.append(f"({' AND '.join(conditions)})")
        if not clauses:
            return None
        with self.connection() as con:
            rows = con.execute(
                f"SELECT id FROM documents WHERE {' OR '.join(clauses)}", parameters
            ).fetchall()
        return [row[0] for row in rows]

    def catalog(self) -> dict:
        documents = self.documents()
        unclassified = [
            item
            for item in documents
            if not item["insurer"] and not item["insurance_kind"] and not item["product"]
        ]
        tree: dict[str, dict] = {}
        for item in documents:
            if not item["insurer"]:
                continue
            insurer = tree.setdefault(
                item["insurer"], {"name": item["insurer"], "count": 0, "kinds": {}}
            )
            insurer["count"] += 1
            kind_name = item["insurance_kind"] or "Без вида страхования"
            kind = insurer["kinds"].setdefault(
                kind_name, {"name": kind_name, "count": 0, "products": {}}
            )
            kind["count"] += 1
            product_name = item["product"] or "Без продукта"
            product = kind["products"].setdefault(
                product_name, {"name": product_name, "count": 0}
            )
            product["count"] += 1
        insurers = []
        for insurer in tree.values():
            insurer["kinds"] = [
                {**kind, "products": list(kind["products"].values())}
                for kind in insurer["kinds"].values()
            ]
            insurers.append(insurer)
        return {
            "total": len(documents),
            "unclassified": len(unclassified),
            "insurers": insurers,
            "suggestions": {
                "insurers": sorted({item["insurer"] for item in documents if item["insurer"]}),
                "insurance_kinds": sorted(
                    {item["insurance_kind"] for item in documents if item["insurance_kind"]}
                ),
                "products": sorted({item["product"] for item in documents if item["product"]}),
            },
        }

    def update_document(
        self, ident: str, status: str, *, chunks: int = 0, error: str | None = None
    ) -> None:
        with self.connection() as con:
            con.execute(
                "UPDATE documents SET status=?, chunks=?, error=?, indexed_at=? WHERE id=?",
                (status, chunks, error, now() if status == "ready" else None, ident),
            )

    def delete_document(self, ident: str) -> dict | None:
        doc = self.document(ident)
        if doc:
            with self.connection() as con:
                con.execute("DELETE FROM documents WHERE id=?", (ident,))
        return doc

    def create_conversation(self, title: str = "Новый чат", owner_id: str | None = None) -> dict:
        result = {
            "id": str(uuid.uuid4()),
            "title": title,
            "created_at": now(),
            "owner_id": owner_id,
        }
        with self.connection() as con:
            con.execute(
                "INSERT INTO conversations(id, title, created_at, owner_id) VALUES (:id, :title, :created_at, :owner_id)",
                result,
            )
        return result

    def conversations(self, owner_id: str | None = None) -> list[dict]:
        with self.connection() as con:
            if owner_id is None:
                rows = con.execute("SELECT * FROM conversations ORDER BY created_at DESC").fetchall()
            else:
                rows = con.execute(
                    "SELECT * FROM conversations WHERE owner_id=? ORDER BY created_at DESC",
                    (owner_id,),
                ).fetchall()
        return [dict(row) for row in rows]

    def owns_conversation(self, conversation_id: str, owner_id: str | None) -> bool:
        with self.connection() as con:
            row = con.execute(
                "SELECT id FROM conversations WHERE id=? AND owner_id IS ?",
                (conversation_id, owner_id),
            ).fetchone()
        return row is not None

    def messages(self, conversation_id: str, owner_id: str | None = None) -> list[dict]:
        if owner_id is not None and not self.owns_conversation(conversation_id, owner_id):
            return []
        with self.connection() as con:
            rows = con.execute(
                "SELECT * FROM messages WHERE conversation_id=? ORDER BY created_at",
                (conversation_id,),
            ).fetchall()
        result = []
        for row in rows:
            item = {**dict(row), "citations": json.loads(row["citations"])}
            if item.get("provider"):
                item["usage"] = {
                    "provider": item["provider"],
                    "model": item.get("model") or "default",
                    "input_tokens": item.get("input_tokens"),
                    "output_tokens": item.get("output_tokens"),
                    "total_tokens": item.get("total_tokens"),
                    "cost_rub": item.get("cost_rub"),
                }
            result.append(item)
        return result

    def usage(self, owner_id: str | None = None) -> dict:
        with self.connection() as con:
            query = """
                SELECT provider, COUNT(*) AS requests, COALESCE(SUM(cost_rub), 0) AS cost_rub,
                       COALESCE(SUM(input_tokens), 0) AS input_tokens,
                       COALESCE(SUM(output_tokens), 0) AS output_tokens,
                       COALESCE(SUM(total_tokens), 0) AS total_tokens
                FROM messages
                WHERE role='assistant' AND provider IS NOT NULL
                GROUP BY provider
                ORDER BY provider
                """
            if owner_id is None:
                rows = con.execute(query).fetchall()
            else:
                rows = con.execute(
                    query.replace(
                        "WHERE role='assistant' AND provider IS NOT NULL",
                        "WHERE role='assistant' AND provider IS NOT NULL AND conversation_id IN (SELECT id FROM conversations WHERE owner_id=?)",
                    ),
                    (owner_id,),
                ).fetchall()
        providers = [dict(row) for row in rows]
        return {
            "providers": providers,
            "cost_rub": round(sum(item["cost_rub"] for item in providers), 6),
            "requests": sum(item["requests"] for item in providers),
        }

    def add_message(
        self,
        conversation_id: str,
        role: str,
        content: str,
        citations: list[dict] | None = None,
        provider: str | None = None,
        model: str | None = None,
        input_tokens: int | None = None,
        output_tokens: int | None = None,
        total_tokens: int | None = None,
        cost_rub: float | None = None,
        request_status: str | None = None,
    ) -> dict:
        result = {
            "id": str(uuid.uuid4()),
            "conversation_id": conversation_id,
            "role": role,
            "content": content,
            "citations": citations or [],
            "created_at": now(),
            "provider": provider,
            "model": model,
            "input_tokens": input_tokens,
            "output_tokens": output_tokens,
            "total_tokens": total_tokens,
            "cost_rub": cost_rub,
            "request_status": request_status,
        }
        with self.connection() as con:
            con.execute(
                """INSERT INTO messages
                (id, conversation_id, role, content, citations, created_at, provider, model,
                 input_tokens, output_tokens, total_tokens, cost_rub, request_status)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
                (
                    result["id"],
                    conversation_id,
                    role,
                    content,
                    json.dumps(result["citations"]),
                    result["created_at"],
                    provider,
                    model,
                    input_tokens,
                    output_tokens,
                    total_tokens,
                    cost_rub,
                    request_status,
                ),
            )
        return result

    def delete_conversation(self, ident: str, owner_id: str | None = None) -> bool:
        with self.connection() as con:
            if owner_id is None:
                cur = con.execute("DELETE FROM conversations WHERE id=?", (ident,))
            else:
                cur = con.execute(
                    "DELETE FROM conversations WHERE id=? AND owner_id=?", (ident, owner_id)
                )
            if cur.rowcount > 0:
                con.execute("DELETE FROM messages WHERE conversation_id=?", (ident,))
        return cur.rowcount > 0
