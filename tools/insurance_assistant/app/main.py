from __future__ import annotations

import json
import mimetypes
import shutil
import uuid
from dataclasses import replace
from pathlib import Path
from typing import Annotated

from fastapi import (
    BackgroundTasks,
    Depends,
    FastAPI,
    File,
    Form,
    Header,
    HTTPException,
    UploadFile,
)
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, StreamingResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel

from .codex import CodexTransport, build_prompt
from .config import ROOT, settings
from .database import Store
from .extractors import SUPPORTED_EXTENSIONS, extract
from .providers import PolzaTransport, ProviderEvent, Usage
from .rag import RagIndex

store = Store(settings.sqlite_path)
rag = RagIndex(settings)
codex = CodexTransport(settings.codex_command)
polza = PolzaTransport(settings.polza_chat_base_url, settings.polza_api_key)
if settings.production_mode and not settings.internal_token:
    raise RuntimeError("INSURANCE_ASSISTANT_INTERNAL_TOKEN обязателен в production")
app = FastAPI(title="Insurance Assistant", version="0.1.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://127.0.0.1", "http://localhost"],
    allow_methods=["*"],
    allow_headers=["*"],
)
WEB_DIST = ROOT / "web" / "dist"
if WEB_DIST.exists():
    app.mount("/assets", StaticFiles(directory=WEB_DIST / "assets"), name="assets")


class ConversationCreate(BaseModel):
    title: str = "Новый чат"
    provider: str | None = None
    model: str | None = None


class ConversationAiUpdate(BaseModel):
    provider: str
    model: str


class MessageCreate(BaseModel):
    content: str
    scope: list[dict[str, str | bool | None]] | None = None


class DocumentClassification(BaseModel):
    insurer: str | None = None
    insurance_kind: str | None = None
    product: str | None = None
    document_type: str | None = None
    effective_from: str | None = None
    effective_to: str | None = None


class ClassificationUpdate(DocumentClassification):
    document_ids: list[str]


def _crm_owner(
    token: str | None = Header(default=None, alias="X-Insurance-Assistant-Token"),
    owner_id: str | None = Header(default=None, alias="X-CRM-User-Id"),
) -> str | None:
    """Trust user identity only from the authenticated Django proxy."""
    if settings.internal_token:
        if token != settings.internal_token:
            raise HTTPException(401, "Недействительный внутренний токен")
        if not owner_id:
            raise HTTPException(400, "Не передан идентификатор пользователя CRM")
    return owner_id


def _default_provider() -> str:
    return "polza" if settings.production_mode else "codex"


async def _polza_models() -> list[str]:
    if not settings.polza_api_key:
        raise HTTPException(503, "Не задан POLZA_AI_API_KEY для ответов Polza.ai")
    try:
        models = await polza.models()
    except Exception as error:
        raise HTTPException(
            503, "Не удалось получить каталог моделей Polza.ai"
        ) from error
    if not models:
        raise HTTPException(503, "Polza.ai не вернула доступные модели")
    return models


async def _validated_ai_choice(
    provider: str | None, model: str | None
) -> tuple[str | None, str | None]:
    if provider is None and model is None:
        return None, None
    provider = (provider or "").lower().strip()
    model = (model or "").strip()
    if not provider or not model:
        raise HTTPException(422, "Для настройки чата укажите и провайдера, и модель")
    allowed = {"polza"} if settings.production_mode else {"codex", "polza"}
    if provider not in allowed:
        raise HTTPException(422, "Этот провайдер недоступен")
    if provider == "polza":
        if model not in await _polza_models():
            raise HTTPException(422, "Выбранная модель больше недоступна в Polza.ai")
    elif model not in settings.codex_models:
        raise HTTPException(422, "Выбранная модель Codex больше недоступна")
    return provider, model


async def _resolve_conversation_ai(conversation: dict) -> tuple[str, str]:
    provider = conversation.get("provider") or _default_provider()
    selected_model = conversation.get("model")
    if provider == "polza":
        models = await _polza_models()
        model = selected_model or settings.polza_chat_model or models[0]
        if model not in models:
            raise HTTPException(
                422,
                "Выбранная для этого чата модель больше недоступна. Выберите другую модель.",
            )
        return provider, model
    if provider == "codex" and not settings.production_mode:
        model = (
            selected_model
            or settings.codex_model
            or (settings.codex_models[0] if settings.codex_models else "default")
        )
        if selected_model and model not in settings.codex_models:
            raise HTTPException(
                422,
                "Выбранная для этого чата модель Codex больше недоступна. Выберите другую модель.",
            )
        return provider, model
    raise HTTPException(422, "Этот провайдер недоступен")


def _index_document(document_id: str) -> None:
    document = store.document(document_id)
    if not document:
        return
    store.update_document(document_id, "indexing")
    try:
        parts = [
            replace(part, filename=document["filename"])
            for part in extract(Path(document["path"]))
        ]
        count = rag.index(document_id, parts, _document_classification(document))
        if not count:
            raise ValueError("В документе не найден текст")
        store.update_document(document_id, "ready", chunks=count)
    except Exception as error:
        store.update_document(document_id, "failed", error=str(error))


@app.post("/api/documents", status_code=202)
async def upload_documents(
    background_tasks: BackgroundTasks,
    files: Annotated[list[UploadFile], File(...)],
    insurer: Annotated[str | None, Form()] = None,
    insurance_kind: Annotated[str | None, Form()] = None,
    product: Annotated[str | None, Form()] = None,
    document_type: Annotated[str | None, Form()] = None,
    effective_from: Annotated[str | None, Form()] = None,
    effective_to: Annotated[str | None, Form()] = None,
    _: str | None = Depends(_crm_owner),
) -> list[dict]:
    settings.uploads_dir.mkdir(parents=True, exist_ok=True)
    classification = _validated_classification(
        {
            "insurer": insurer,
            "insurance_kind": insurance_kind,
            "product": product,
            "document_type": document_type,
            "effective_from": effective_from,
            "effective_to": effective_to,
        }
    )
    created = []
    for upload in files:
        filename = Path(upload.filename or "document").name
        if Path(filename).suffix.lower() not in SUPPORTED_EXTENSIONS:
            raise HTTPException(415, f"Неподдерживаемый формат: {filename}")
        target = settings.uploads_dir / f"{uuid.uuid4()}_{filename}"
        target.write_bytes(await upload.read())
        ident = store.create_document(filename, target, classification)
        background_tasks.add_task(_index_document, ident)
        created.append(store.document(ident))
    return created


@app.get("/api/documents")
def list_documents(_: str | None = Depends(_crm_owner)) -> list[dict]:
    return store.documents()


@app.get("/api/catalog")
def catalog(_: str | None = Depends(_crm_owner)) -> dict:
    return store.catalog()


@app.patch("/api/documents/classification")
def update_document_classification(
    payload: ClassificationUpdate, _: str | None = Depends(_crm_owner)
) -> list[dict]:
    classification = _validated_classification(payload.model_dump(exclude={"document_ids"}))
    documents = store.update_document_classification(payload.document_ids, classification)
    rag.update_document_classification(payload.document_ids, classification)
    return documents


@app.get("/api/documents/{document_id}/content")
def document_content(
    document_id: str, _: str | None = Depends(_crm_owner)
) -> FileResponse:
    document = store.document(document_id)
    if not document:
        raise HTTPException(404, "Документ не найден")
    path = Path(document["path"])
    if not path.is_file():
        raise HTTPException(404, "Исходный файл документа не найден")
    media_type = mimetypes.guess_type(document["filename"])[0] or "application/octet-stream"
    return FileResponse(
        path,
        media_type=media_type,
        filename=document["filename"],
        content_disposition_type="inline",
    )


@app.delete("/api/documents/{document_id}", status_code=204)
def delete_document(document_id: str, _: str | None = Depends(_crm_owner)):
    document = store.delete_document(document_id)
    if not document:
        raise HTTPException(404, "Документ не найден")
    rag.delete_document(document_id)
    Path(document["path"]).unlink(missing_ok=True)


@app.post("/api/conversations", status_code=201)
async def create_conversation(
    payload: ConversationCreate, owner_id: str | None = Depends(_crm_owner)
) -> dict:
    provider, model = await _validated_ai_choice(payload.provider, payload.model)
    return store.create_conversation(payload.title, owner_id, provider, model)


@app.get("/api/conversations")
def list_conversations(owner_id: str | None = Depends(_crm_owner)) -> list[dict]:
    return store.conversations(owner_id)


@app.patch("/api/conversations/{conversation_id}")
async def update_conversation_ai(
    conversation_id: str,
    payload: ConversationAiUpdate,
    owner_id: str | None = Depends(_crm_owner),
) -> dict:
    provider, model = await _validated_ai_choice(payload.provider, payload.model)
    conversation = store.update_conversation_ai(
        conversation_id, owner_id, provider, model
    )
    if not conversation:
        raise HTTPException(404, "Чат не найден")
    return conversation


@app.get("/api/conversations/{conversation_id}/messages")
def list_messages(
    conversation_id: str, owner_id: str | None = Depends(_crm_owner)
) -> list[dict]:
    if owner_id is not None and not store.owns_conversation(conversation_id, owner_id):
        raise HTTPException(404, "Чат не найден")
    return store.messages(conversation_id, owner_id)


@app.get("/api/providers")
async def list_providers(_: str | None = Depends(_crm_owner)) -> dict:
    codex_default = settings.codex_model or (
        settings.codex_models[0] if settings.codex_models else "default"
    )
    providers = []
    if not settings.production_mode:
        providers.append({
                "id": "codex",
                "label": "Codex",
                "available": any(
                    shutil.which(command) is not None
                    for command in ("codex", "codex.exe", "codex.cmd")
                ),
                "models": list(settings.codex_models),
                "default_model": codex_default,
                "billing": "Включено в текущий ChatGPT-доступ; стоимость от App Server не передаётся.",
        })
    providers.append(
        {
                "id": "polza",
                "label": "Polza",
                "available": bool(settings.polza_api_key),
                "models": [],
                "default_model": settings.polza_chat_model or None,
                "billing": "Стоимость берётся из ответа Polza.ai, если API её возвращает.",
        }
    )
    result = {"providers": providers}
    try:
        models = await polza.models()
        result["providers"][-1]["models"] = models
        if not result["providers"][-1]["default_model"] and models:
            result["providers"][-1]["default_model"] = models[0]
    except Exception as error:
        result["providers"][-1]["error"] = str(error)
    return result


@app.get("/api/usage")
def usage(owner_id: str | None = Depends(_crm_owner)) -> dict:
    return store.usage(owner_id)


@app.delete("/api/conversations/{conversation_id}", status_code=204)
def delete_conversation(
    conversation_id: str, owner_id: str | None = Depends(_crm_owner)
):
    if not store.delete_conversation(conversation_id, owner_id):
        raise HTTPException(404, "Чат не найден")


@app.post("/api/conversations/{conversation_id}/messages")
async def create_message(
    conversation_id: str,
    payload: MessageCreate,
    owner_id: str | None = Depends(_crm_owner),
) -> StreamingResponse:
    conversation = store.conversation(conversation_id, owner_id)
    if not conversation:
        raise HTTPException(404, "Чат не найден")
    question = payload.content.strip()
    if not question:
        raise HTTPException(422, "Сообщение не может быть пустым")
    provider, model = await _resolve_conversation_ai(conversation)
    document_ids = store.scoped_document_ids(payload.scope or [])
    history, citations = store.messages(conversation_id, owner_id), rag.search(
        question, document_ids=document_ids
    )
    citations = [
        replace(
            citation,
            classification=citation.classification
            or _document_classification(store.document(citation.document_id) or {}),
        )
        for citation in citations
    ]
    store.add_message(conversation_id, "user", question)

    async def events():
        yield _sse("sources", [item.json() for item in citations])
        yield _sse("meta", Usage(provider, model).json())
        if not citations:
            answer = "В загруженных документах нет подтверждения для этого вопроса."
            yield _sse("delta", answer)
            usage_data = Usage(provider, model)
            request_status = "not_needed"
        else:
            answer_parts: list[str] = []
            usage_data = Usage(provider, model)
            request_status = "completed"
            try:
                transport = codex if provider == "codex" else polza
                async for event in transport.answer(
                    build_prompt(question, history, citations), model
                ):
                    if isinstance(event, str):
                        event = ProviderEvent(delta=event)
                    if event.delta:
                        answer_parts.append(event.delta)
                        yield _sse("delta", event.delta)
                    if event.usage:
                        usage_data = event.usage
                        yield _sse("meta", usage_data.json())
                answer = (
                    "".join(answer_parts).strip()
                    or f"{provider.capitalize()} не вернул текст ответа."
                )
            except Exception as error:
                request_status = "failed"
                answer = f"Не удалось получить ответ {provider.capitalize()}: {error}"
                yield _sse("error", answer)
        store.add_message(
            conversation_id,
            "assistant",
            answer,
            [item.json() for item in citations],
            provider=provider,
            model=model,
            input_tokens=usage_data.input_tokens,
            output_tokens=usage_data.output_tokens,
            total_tokens=usage_data.total_tokens,
            cost_rub=usage_data.cost_rub,
            request_status=request_status,
        )
        yield _sse(
            "done",
            {
                "content": answer,
                "citations": [item.json() for item in citations],
                "usage": usage_data.json(),
                "request_status": request_status,
            },
        )

    return StreamingResponse(
        events(), media_type="text/event-stream", headers={"Cache-Control": "no-cache"}
    )


@app.get("/health")
def health() -> dict:
    return {
        "status": "ok",
        "qdrant": rag.healthy(),
        "embedding_provider": settings.embedding_provider,
        "embedding_model": settings.embedding_model,
        "codex_app_server": False if settings.production_mode else any(
            shutil.which(command) is not None
            for command in ("codex", "codex.exe", "codex.cmd")
        ),
        "bind": "127.0.0.1",
    }


@app.get("/{path:path}")
def web(path: str):
    index = WEB_DIST / "index.html"
    return (
        FileResponse(index)
        if index.exists()
        else {"message": "Веб-интерфейс ещё не собран."}
    )


def _sse(event: str, value: object) -> str:
    return f"event: {event}\ndata: {json.dumps(value, ensure_ascii=False)}\n\n"


def _document_classification(document: dict) -> dict[str, str | None]:
    return {
        key: document.get(key)
        for key in (
            "insurer",
            "insurance_kind",
            "product",
            "document_type",
            "effective_from",
            "effective_to",
        )
    }


def _validated_classification(values: dict[str, str | None]) -> dict[str, str | None]:
    normalized = {
        key: value.strip() if isinstance(value, str) and value.strip() else None
        for key, value in values.items()
    }
    hierarchy = [normalized.get(key) for key in ("insurer", "insurance_kind", "product")]
    if any(hierarchy) and not all(hierarchy):
        raise HTTPException(
            422,
            "Для классифицированного документа заполните страховщика, вид страхования и продукт.",
        )
    return normalized
