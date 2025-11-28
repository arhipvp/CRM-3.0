from typing import Any, Callable, Dict, Optional, Protocol, Union

from apps.common.drive import (
    DriveFileInfo,
    list_drive_folder_contents,
    upload_file_to_drive,
)
from django.core.files.uploadedfile import UploadedFile


class DriveFolderOwner(Protocol):
    """Protocol for objects that have a drive_folder_id."""

    drive_folder_id: Optional[str]


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
