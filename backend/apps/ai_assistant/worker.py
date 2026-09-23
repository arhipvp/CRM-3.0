from __future__ import annotations

import logging
import threading
import time
import uuid
from datetime import timedelta

from django.db import close_old_connections, transaction
from django.utils import timezone

from .models import AiDocument, AiMessage, AiRun
from .rag_services import AnswerStopped, generate_answer, index_document, search

logger = logging.getLogger(__name__)


def recover_interrupted_runs(max_age_seconds: int = 45) -> int:
    """Never replay a provider request that may already have been charged."""
    cutoff = timezone.now() - timedelta(seconds=max_age_seconds)
    stale = AiRun.objects.filter(status__in=("searching", "generating")).filter(
        heartbeat_at__lt=cutoff
    )
    count = 0
    for run in stale:
        if AiRun.objects.filter(
            pk=run.pk, status=run.status, heartbeat_at__lt=cutoff
        ).update(
            status="interrupted",
            finished_at=timezone.now(),
            error="Работа прервана. Повторите запрос вручную.",
        ):
            AiMessage.objects.filter(pk=run.answer_id).update(
                request_status="interrupted"
            )
            count += 1
    return count


def claim_answer(worker_id: str) -> AiRun | None:
    with transaction.atomic():
        run = (
            AiRun.objects.select_for_update(skip_locked=True)
            .filter(status="queued")
            .order_by("created_at")
            .first()
        )
        if run is None:
            return None
        run.status = "searching"
        run.started_at = timezone.now()
        run.heartbeat_at = run.started_at
        run.worker_id = worker_id
        run.save(
            update_fields=[
                "status",
                "started_at",
                "heartbeat_at",
                "worker_id",
                "updated_at",
            ]
        )
        AiMessage.objects.filter(pk=run.answer_id).update(request_status="searching")
        return run


class Heartbeat:
    def __init__(self, run_id, worker_id: str) -> None:
        self.run_id = run_id
        self.worker_id = worker_id
        self.stopped = threading.Event()
        self.thread = threading.Thread(target=self._loop, daemon=True)

    def _loop(self):
        while not self.stopped.wait(5):
            close_old_connections()
            AiRun.objects.filter(
                id=self.run_id, worker_id=self.worker_id, status__in=AiRun.ACTIVE
            ).update(heartbeat_at=timezone.now())
        close_old_connections()

    def __enter__(self):
        self.thread.start()
        return self

    def __exit__(self, *_):
        self.stopped.set()
        self.thread.join(timeout=6)


def _finish(
    run: AiRun,
    status: str,
    worker_id: str,
    *,
    error: str = "",
    usage: dict | None = None,
):
    with transaction.atomic():
        current = AiRun.objects.select_for_update().filter(pk=run.pk).first()
        if (
            current is None
            or current.worker_id != worker_id
            or current.status not in AiRun.ACTIVE
        ):
            return
        current.status = status
        current.error = error
        current.finished_at = timezone.now()
        current.save(update_fields=["status", "error", "finished_at", "updated_at"])
        answer = AiMessage.objects.select_for_update().get(pk=run.answer_id)
        answer.request_status = status
        fields = ["request_status"]
        if usage:
            for key in (
                "provider",
                "model",
                "input_tokens",
                "output_tokens",
                "total_tokens",
                "cost_rub",
            ):
                if key in usage:
                    setattr(answer, key, usage[key])
                    fields.append(key)
        answer.save(update_fields=fields)


def process_answer(run: AiRun, worker_id: str) -> None:
    text_parts: list[str] = []
    last_flush = time.monotonic()

    def flush(force: bool = False):
        nonlocal last_flush
        if text_parts and (force or time.monotonic() - last_flush >= 0.5):
            if AiRun.objects.filter(
                pk=run.id, worker_id=worker_id, status__in=AiRun.ACTIVE
            ).exists():
                AiMessage.objects.filter(pk=run.answer_id).update(
                    content="".join(text_parts)
                )
            last_flush = time.monotonic()

    def on_delta(delta: str):
        text_parts.append(delta)
        flush()

    def should_stop() -> bool:
        return not AiRun.objects.filter(
            pk=run.id,
            worker_id=worker_id,
            status__in=AiRun.ACTIVE,
            stop_requested=False,
        ).exists()

    try:
        with Heartbeat(run.id, worker_id):
            if should_stop():
                raise AnswerStopped()
            citations = search(run.question.content, run.scope)
            if not AiRun.objects.filter(
                pk=run.pk,
                worker_id=worker_id,
                status="searching",
                stop_requested=False,
            ).update(found_chunks=len(citations)):
                raise AnswerStopped()
            AiMessage.objects.filter(pk=run.answer_id).update(citations=citations)
            if not citations:
                AiMessage.objects.filter(pk=run.answer_id).update(
                    content="В загруженных документах не найдено подтверждения для ответа на этот вопрос."
                )
                _finish(run, "completed", worker_id)
                return
            if should_stop():
                raise AnswerStopped()
            if not AiRun.objects.filter(
                pk=run.pk,
                worker_id=worker_id,
                status="searching",
                stop_requested=False,
            ).update(status="generating"):
                raise AnswerStopped()
            AiMessage.objects.filter(pk=run.answer_id).update(
                request_status="generating"
            )
            history = list(
                AiMessage.objects.filter(
                    conversation=run.conversation,
                    created_at__lt=run.question.created_at,
                )
                .order_by("created_at")
                .values("role", "content")
            )[-12:]
            usage = generate_answer(
                run.question.content,
                history,
                citations,
                run.model,
                on_delta,
                should_stop,
            )
            flush(force=True)
            if should_stop():
                raise AnswerStopped(usage)
            _finish(run, "completed", worker_id, usage=usage)
    except AnswerStopped as exc:
        flush(force=True)
        _finish(run, "stopped", worker_id, usage=getattr(exc, "usage", None))
    except Exception:
        logger.exception("AI answer run %s failed", run.id)
        flush(force=True)
        _finish(
            run,
            "failed",
            worker_id,
            error="Не удалось получить ответ. Можно повторить запрос вручную.",
        )


def process_next_answer(worker_id: str | None = None) -> bool:
    worker_id = worker_id or str(uuid.uuid4())
    run = claim_answer(worker_id)
    if run is None:
        return False
    process_answer(run, worker_id)
    return True


def claim_document() -> AiDocument | None:
    with transaction.atomic():
        document = (
            AiDocument.objects.select_for_update(skip_locked=True)
            .filter(status="queued")
            .order_by("created_at")
            .first()
        )
        if document:
            document.status = "processing"
            document.save(update_fields=["status"])
        return document


def process_next_document() -> bool:
    document = claim_document()
    if document is None:
        return False
    try:
        index_document(document.id)
    except Exception:
        logger.exception("AI document %s indexing failed", document.id)
        AiDocument.objects.filter(pk=document.pk).update(
            status="error",
            error="Не удалось обработать документ. Загрузите файл повторно.",
        )
    return True
