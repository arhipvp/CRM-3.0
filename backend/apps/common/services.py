from typing import Any, Callable, Dict, Optional, Protocol

from apps.common.drive import (
    build_drive_file_tree_map,
    list_drive_folder_contents,
    move_drive_item_between_folders,
    upload_file_to_drive,
)
from django.core.files.uploadedfile import UploadedFile


class DriveFolderOwner(Protocol):
    """Protocol for objects that have a drive_folder_id."""

    drive_folder_id: Optional[str]


class DriveFileMoveValidationError(ValueError):
    """Raised when a move request does not match an owner's Drive tree."""

    def __init__(self, detail: str, **extra: Any) -> None:
        super().__init__(detail)
        self.detail = detail
        self.extra = extra


def move_drive_files_within_folder_tree(
    root_folder_id: str, file_ids: list[str], target_folder_id: str
) -> list[str]:
    """Move files within one owner's Drive folder tree.

    The root folder is a valid destination but can never be moved itself. Every
    requested file and the destination are validated against one tree snapshot
    before any Drive mutation is started.
    """
    if not root_folder_id:
        raise DriveFileMoveValidationError("Корневая папка владельца не найдена.")
    if not target_folder_id:
        raise DriveFileMoveValidationError("Нужно передать ID папки назначения.")
    if not file_ids:
        raise DriveFileMoveValidationError("Нужно передать ID файлов.")
    if len(file_ids) != len(set(file_ids)):
        raise DriveFileMoveValidationError("ID файлов не должны повторяться.")
    if root_folder_id in file_ids:
        raise DriveFileMoveValidationError(
            "Корневую папку владельца нельзя перемещать."
        )

    drive_file_map = build_drive_file_tree_map(root_folder_id)
    target_item = drive_file_map.get(target_folder_id)
    if target_folder_id != root_folder_id and (
        not target_item or not target_item["is_folder"]
    ):
        raise DriveFileMoveValidationError(
            "Папка назначения не принадлежит дереву папок владельца."
        )

    missing_file_ids = [
        file_id for file_id in file_ids if file_id not in drive_file_map
    ]
    if missing_file_ids:
        raise DriveFileMoveValidationError(
            "Файлы не найдены в папке владельца.", missing_file_ids=missing_file_ids
        )

    folder_ids = [
        file_id for file_id in file_ids if drive_file_map[file_id]["is_folder"]
    ]
    if folder_ids:
        raise DriveFileMoveValidationError(
            "Можно перемещать только файлы.", folder_ids=folder_ids
        )

    same_folder_file_ids = [
        file_id
        for file_id in file_ids
        if (drive_file_map[file_id].get("parent_id") or root_folder_id)
        == target_folder_id
    ]
    if same_folder_file_ids:
        raise DriveFileMoveValidationError(
            "Нельзя перемещать файл в ту же папку.",
            same_folder_file_ids=same_folder_file_ids,
        )

    for file_id in file_ids:
        source_folder_id = drive_file_map[file_id].get("parent_id") or root_folder_id
        move_drive_item_between_folders(file_id, source_folder_id, target_folder_id)

    return file_ids


def manage_drive_files(
    instance: DriveFolderOwner,
    ensure_folder_func: Callable[[Any], Optional[str]],
    uploaded_file: Optional[UploadedFile] = None,
) -> Dict[str, Any]:
    """
    Common logic for managing Drive files for an entity (Client, Deal, Policy).

    Args:
        instance: The model instance (must have drive_folder_id).
        ensure_folder_func: Function to get/create folder (e.g. ensure_client_folder).
        uploaded_file: File to upload (if provided).

    Returns:
        Dict with keys 'folder_id' and ('files' or 'file').
    """
    # Try to get existing or create new folder
    folder_id = ensure_folder_func(instance) or instance.drive_folder_id

    if not folder_id:
        return {"folder_id": None, "files": []}

    # Handle Upload
    if uploaded_file:
        drive_file = upload_file_to_drive(
            folder_id,
            uploaded_file.file,
            uploaded_file.name,
            uploaded_file.content_type or "application/octet-stream",
        )
        return {"folder_id": folder_id, "file": drive_file}

    # Handle List
    files = list_drive_folder_contents(folder_id)
    return {"folder_id": folder_id, "files": files}
