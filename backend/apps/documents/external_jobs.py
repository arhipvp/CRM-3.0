import logging
from datetime import timedelta

from django.conf import settings
from django.db import transaction
from django.utils import timezone

from .models import ExternalJob
from .open_notebook import OpenNotebookSyncService

logger = logging.getLogger(__name__)


def serialize_external_job(job: ExternalJob) -> dict:
    return {
        "id": str(job.id),
        "kind": job.kind,
        "status": job.status,
        "result": job.result,
        "error": job.error or None,
        "attempts": job.attempts,
        "created_at": job.created_at,
        "started_at": job.started_at,
        "finished_at": job.finished_at,
    }


def create_external_job(*, kind: str, payload: dict, user) -> ExternalJob:
    return ExternalJob.objects.create(kind=kind, payload=payload, created_by=user)


def _claim_next_job() -> ExternalJob | None:
    stale_before = timezone.now() - timedelta(
        seconds=getattr(settings, "EXTERNAL_JOB_STALE_SECONDS", 900)
    )
    with transaction.atomic():
        ExternalJob.objects.filter(
            status=ExternalJob.Status.RUNNING,
            started_at__lt=stale_before,
        ).update(status=ExternalJob.Status.QUEUED, started_at=None)
        job = (
            ExternalJob.objects.select_for_update(skip_locked=True)
            .filter(status=ExternalJob.Status.QUEUED)
            .order_by("created_at")
            .first()
        )
        if job is None:
            return None
        job.status = ExternalJob.Status.RUNNING
        job.started_at = timezone.now()
        job.finished_at = None
        job.error = ""
        job.attempts += 1
        job.save(
            update_fields=[
                "status",
                "started_at",
                "finished_at",
                "error",
                "attempts",
                "updated_at",
            ]
        )
        return job


def _folder_belongs_to_tree(root_folder_id: str, target_folder_id: str) -> bool:
    from apps.common.drive import list_drive_folder_contents

    if root_folder_id == target_folder_id:
        return True
    queue = [root_folder_id]
    visited: set[str] = set()
    while queue:
        folder_id = queue.pop(0)
        if folder_id in visited:
            continue
        visited.add(folder_id)
        for item in list_drive_folder_contents(folder_id):
            if not item["is_folder"]:
                continue
            if item["id"] == target_folder_id:
                return True
            queue.append(item["id"])
    return False


def _execute(job: ExternalJob) -> dict:
    if job.kind == ExternalJob.Kind.OPEN_NOTEBOOK_ASK:
        service = OpenNotebookSyncService()
        if not service.is_configured():
            raise RuntimeError("Open Notebook не настроен.")
        result = service.ask_notebook(
            str(job.payload["notebook_id"]),
            str(job.payload["question"]),
            str(job.payload["session_id"]) if job.payload.get("session_id") else None,
        )
        return {"question": job.payload["question"], **result}

    if job.kind == ExternalJob.Kind.DEAL_DRIVE_LIST:
        from apps.common.drive import ensure_deal_folder, list_drive_folder_contents
        from apps.deals.models import Deal
        from apps.deals.permissions import build_deal_visibility_q, is_admin_user

        deals = Deal.objects.filter(pk=job.payload["deal_id"])
        if not is_admin_user(job.created_by):
            deals = deals.filter(build_deal_visibility_q(job.created_by)).distinct()
        deal = deals.get()
        folder_id = ensure_deal_folder(deal) or deal.drive_folder_id
        if not folder_id:
            return {"folder_id": None, "files": []}
        parent_id = job.payload.get("parent_id") or ""
        if parent_id and not _folder_belongs_to_tree(folder_id, parent_id):
            raise ValueError("Указанная папка не принадлежит дереву папок сделки.")
        return {
            "folder_id": folder_id,
            "files": list_drive_folder_contents(parent_id or folder_id),
        }

    raise ValueError(f"Неизвестный тип внешнего задания: {job.kind}")


def process_next_external_job() -> bool:
    job = _claim_next_job()
    if job is None:
        return False
    try:
        result = _execute(job)
    except Exception as exc:
        logger.exception("External job failed. id=%s kind=%s", job.id, job.kind)
        max_attempts = getattr(settings, "EXTERNAL_JOB_MAX_ATTEMPTS", 2)
        job.status = (
            ExternalJob.Status.QUEUED
            if job.attempts < max_attempts
            else ExternalJob.Status.FAILED
        )
        job.error = str(exc)
        job.finished_at = (
            timezone.now() if job.status == ExternalJob.Status.FAILED else None
        )
        job.save(update_fields=["status", "error", "finished_at", "updated_at"])
    else:
        job.status = ExternalJob.Status.SUCCEEDED
        job.result = result
        job.error = ""
        job.finished_at = timezone.now()
        job.save(
            update_fields=["status", "result", "error", "finished_at", "updated_at"]
        )
    return True
