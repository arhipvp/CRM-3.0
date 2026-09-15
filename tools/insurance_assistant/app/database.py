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
                  indexed_at TEXT, chunks INTEGER NOT NULL DEFAULT 0
                );
                CREATE TABLE IF NOT EXISTS conversations (
                  id TEXT PRIMARY KEY, title TEXT NOT NULL, created_at TEXT NOT NULL
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

    def create_document(self, filename: str, path: Path) -> str:
        ident = str(uuid.uuid4())
        with self.connection() as con:
            con.execute(
                "INSERT INTO documents(id, filename, path, status, created_at) VALUES (?, ?, ?, 'queued', ?)",
                (ident, filename, str(path), now()),
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

    def create_conversation(self, title: str = "Новый чат") -> dict:
        result = {"id": str(uuid.uuid4()), "title": title, "created_at": now()}
        with self.connection() as con:
            con.execute(
                "INSERT INTO conversations VALUES (:id, :title, :created_at)", result
            )
        return result

    def conversations(self) -> list[dict]:
        with self.connection() as con:
            rows = con.execute(
                "SELECT * FROM conversations ORDER BY created_at DESC"
            ).fetchall()
        return [dict(row) for row in rows]

    def messages(self, conversation_id: str) -> list[dict]:
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

    def usage(self) -> dict:
        with self.connection() as con:
            rows = con.execute(
                """
                SELECT provider, COUNT(*) AS requests, COALESCE(SUM(cost_rub), 0) AS cost_rub,
                       COALESCE(SUM(input_tokens), 0) AS input_tokens,
                       COALESCE(SUM(output_tokens), 0) AS output_tokens,
                       COALESCE(SUM(total_tokens), 0) AS total_tokens
                FROM messages
                WHERE role='assistant' AND provider IS NOT NULL
                GROUP BY provider
                ORDER BY provider
                """
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

    def delete_conversation(self, ident: str) -> bool:
        with self.connection() as con:
            con.execute("DELETE FROM messages WHERE conversation_id=?", (ident,))
            cur = con.execute("DELETE FROM conversations WHERE id=?", (ident,))
        return cur.rowcount > 0
