from __future__ import annotations

import os
from dataclasses import dataclass
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


@dataclass(frozen=True)
class Settings:
    data_dir: Path = Path(os.getenv("INSURANCE_ASSISTANT_DATA_DIR", ROOT / "data"))
    qdrant_url: str = os.getenv(
        "INSURANCE_ASSISTANT_QDRANT_URL", "http://127.0.0.1:6333"
    )
    collection: str = "insurance_documents"
    embedding_provider: str = os.getenv("IA_EMBEDDING_PROVIDER", "polza")
    embedding_model: str = os.getenv(
        "IA_EMBEDDING_MODEL",
        "text-embedding-3-large",
    )
    polza_api_key: str | None = os.getenv("POLZA_AI_API_KEY")
    polza_base_url: str = os.getenv("POLZA_AI_BASE_URL", "https://polza.ai/api/v1")
    polza_chat_base_url: str = os.getenv(
        "POLZA_CHAT_BASE_URL", os.getenv("POLZA_AI_BASE_URL", "https://polza.ai/api/v1")
    )
    polza_chat_model: str = os.getenv("POLZA_CHAT_MODEL", "openai/gpt-4o-mini")
    internal_token: str = os.getenv("INSURANCE_ASSISTANT_INTERNAL_TOKEN", "")
    production_mode: bool = os.getenv("INSURANCE_ASSISTANT_PRODUCTION_MODE", "false").lower() in {
        "1",
        "true",
        "yes",
    }
    embedding_batch_size: int = int(os.getenv("IA_EMBEDDING_BATCH_SIZE", "32"))
    codex_command: str = os.getenv(
        "INSURANCE_ASSISTANT_CODEX_COMMAND", "codex app-server"
    )
    top_k: int = int(os.getenv("INSURANCE_ASSISTANT_TOP_K", "8"))
    retrieval_candidates: int = int(
        os.getenv("INSURANCE_ASSISTANT_RETRIEVAL_CANDIDATES", "32")
    )
    retrieval_semantic_weight: float = float(
        os.getenv("INSURANCE_ASSISTANT_RETRIEVAL_SEMANTIC_WEIGHT", "1.0")
    )
    retrieval_lexical_weight: float = float(
        os.getenv("INSURANCE_ASSISTANT_RETRIEVAL_LEXICAL_WEIGHT", "1.0")
    )
    retrieval_max_per_document: int = int(
        os.getenv("INSURANCE_ASSISTANT_RETRIEVAL_MAX_PER_DOCUMENT", "3")
    )
    codex_model: str = os.getenv("INSURANCE_ASSISTANT_CODEX_MODEL", "")
    codex_models: tuple[str, ...] = tuple(
        item.strip()
        for item in os.getenv(
            "INSURANCE_ASSISTANT_CODEX_MODELS", "gpt-5.6-terra"
        ).split(",")
        if item.strip()
    )

    @property
    def uploads_dir(self) -> Path:
        return self.data_dir / "uploads"

    @property
    def sqlite_path(self) -> Path:
        return self.data_dir / "assistant.sqlite3"


settings = Settings()
