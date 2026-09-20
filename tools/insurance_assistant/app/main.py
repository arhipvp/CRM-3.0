from __future__ import annotations

import json
import mimetypes
import shutil
import uuid
from dataclasses import replace
from pathlib import Path
from typing import Annotated

from fastapi import BackgroundTasks, Depends, FastAPI, File, Header, HTTPException, UploadFile
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


class MessageCreate(BaseModel):
    content: str
    provider: str = "codex"
    model: str | None = None


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
        count = rag.index(document_id, parts)
        if not count:
            raise ValueError("В документе не найден текст")
        store.update_document(document_id, "ready", chunks=count)
    except Exception as error:
        store.update_document(document_id, "failed", error=str(error))


@app.post("/api/documents", status_code=202)
async def upload_documents(
    background_tasks: BackgroundTasks,
    files: Annotated[list[UploadFile], File(...)],
    _: str | None = Depends(_crm_owner),
) -> list[dict]:
    settings.uploads_dir.mkdir(parents=True, exist_ok=True)
    created = []
    for upload in files:
        filename = Path(upload.filename or "document").name
        if Path(filename).suffix.lower() not in SUPPORTED_EXTENSIONS:
            raise HTTPException(415, f"Неподдерживаемый формат: {filename}")
        target = settings.uploads_dir / f"{uuid.uuid4()}_{filename}"
        target.write_bytes(await upload.read())
        ident = store.create_document(filename, target)
        background_tasks.add_task(_index_document, ident)
        created.append(store.document(ident))
    return created


@app.get("/api/documents")
def list_documents(_: str | None = Depends(_crm_owner)) -> list[dict]:
    return store.documents()


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
def create_conversation(
    payload: ConversationCreate, owner_id: str | None = Depends(_crm_owner)
) -> dict:
    return store.create_conversation(payload.title, owner_id)


@app.get("/api/conversations")
def list_conversations(owner_id: str | None = Depends(_crm_owner)) -> list[dict]:
    return store.conversations(owner_id)


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
    conversation_id: str, payload: MessageCreate, owner_id: str | None = Depends(_crm_owner)
) -> StreamingResponse:
    if owner_id is not None and not store.owns_conversation(conversation_id, owner_id):
        raise HTTPException(404, "Чат не найден")
    question = payload.content.strip()
    if not question:
        raise HTTPException(422, "Сообщение не может быть пустым")
    provider = payload.provider.lower().strip()
    if provider not in ({"polza"} if settings.production_mode else {"codex", "polza"}):
        raise HTTPException(422, "Неизвестный провайдер ответа")
    model = payload.model.strip() if payload.model else None
    if provider == "codex":
        model = (
            model
            or settings.codex_model
            or (settings.codex_models[0] if settings.codex_models else "default")
        )
    else:
        if not settings.polza_api_key:
            raise HTTPException(503, "Не задан POLZA_AI_API_KEY для ответов Polza.ai")
        if not model:
            models = await polza.models()
            model = settings.polza_chat_model or (models[0] if models else None)
        if not model:
            raise HTTPException(503, "Polza не вернула доступные модели")
    history, citations = store.messages(conversation_id, owner_id), rag.search(question)
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
