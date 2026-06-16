import logging

from apps.common.drive import (
    DriveError,
    ensure_policy_folder,
    move_drive_file_to_folder,
)
from apps.deals.models import Deal
from apps.notes.models import Note

from ..models import Policy

logger = logging.getLogger(__name__)


def normalize_source_file_ids(
    source_file_id: str | None,
    source_file_ids: list[str] | None,
) -> list[str]:
    normalized: list[str] = []
    for file_id in source_file_ids or []:
        if isinstance(file_id, str):
            cleaned = file_id.strip()
            if cleaned:
                normalized.append(cleaned)
    if isinstance(source_file_id, str):
        cleaned = source_file_id.strip()
        if cleaned:
            normalized.append(cleaned)
    return list(dict.fromkeys(normalized))


def move_recognized_files_to_policy_folder(policy: Policy, file_ids: list[str]) -> None:
    moved_file_ids: set[str] = set()
    for file_id in file_ids:
        if not file_id or file_id in moved_file_ids:
            continue
        try:
            folder_id = ensure_policy_folder(policy)
            if folder_id:
                move_drive_file_to_folder(file_id, folder_id)
        except DriveError:
            logger.exception(
                "Failed to move recognized Drive file %s into policy folder", file_id
            )
        moved_file_ids.add(file_id)


def detach_source_files_from_notes(deal: Deal, file_ids: list[str]) -> None:
    if not deal or not file_ids:
        return

    target_ids = {str(file_id).strip() for file_id in file_ids if str(file_id).strip()}
    if not target_ids:
        return

    notes = Note.objects.with_deleted().filter(deal=deal).exclude(attachments=[])
    for note in notes:
        attachments = note.attachments or []
        filtered_attachments = [
            item
            for item in attachments
            if str((item or {}).get("id") or "").strip() not in target_ids
        ]
        if len(filtered_attachments) != len(attachments):
            note.attachments = filtered_attachments
            note.save(update_fields=["attachments", "updated_at"])
