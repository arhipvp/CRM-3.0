from __future__ import annotations

from .models import AiConversation, AiDocument, AiMessage, AiRun

CLASSIFICATION_FIELDS = (
    "insurer",
    "insurance_kind",
    "product",
    "document_type",
    "effective_from",
    "effective_to",
)


def document_payload(document: AiDocument) -> dict:
    return {
        "id": str(document.id),
        "filename": document.filename,
        "status": document.status,
        "chunks": document.chunks_count,
        "error": document.error or None,
        "created_at": document.created_at.isoformat(),
        "classification": {
            field: getattr(document, field) or None for field in CLASSIFICATION_FIELDS
        },
    }


def conversation_payload(conversation: AiConversation) -> dict:
    return {
        "id": str(conversation.id),
        "title": conversation.title,
        "created_at": conversation.created_at.isoformat(),
        "provider": conversation.provider,
        "model": conversation.model,
        "scope": conversation.scope,
    }


def run_payload(run: AiRun) -> dict:
    return {
        "id": str(run.id),
        "status": run.status,
        "phase": run.status,
        "stop_requested": run.stop_requested,
        "found_chunks": run.found_chunks,
        "created_at": run.created_at.isoformat(),
        "updated_at": run.updated_at.isoformat(),
        "started_at": run.started_at.isoformat() if run.started_at else None,
        "finished_at": run.finished_at.isoformat() if run.finished_at else None,
        "error": run.error or None,
    }


def message_payload(message: AiMessage) -> dict:
    result = {
        "id": str(message.id),
        "role": message.role,
        "content": message.content,
        "citations": message.citations,
        "created_at": message.created_at.isoformat(),
        "request_status": message.request_status or None,
    }
    if message.provider:
        result["usage"] = {
            "provider": message.provider,
            "model": message.model,
            "input_tokens": message.input_tokens,
            "output_tokens": message.output_tokens,
            "total_tokens": message.total_tokens,
            "cost_rub": (
                float(message.cost_rub) if message.cost_rub is not None else None
            ),
        }
    if message.role == "assistant" and hasattr(message, "answer_run"):
        result["run"] = run_payload(message.answer_run)
    return result
