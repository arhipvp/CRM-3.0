"""Stable worker-facing interface for document indexing and answer generation."""

from .rag_index import delete_document_index, index_document, search
from .rag_polza import AnswerStopped, default_model, generate_answer, get_models

__all__ = [
    "AnswerStopped",
    "default_model",
    "delete_document_index",
    "generate_answer",
    "get_models",
    "index_document",
    "search",
]
