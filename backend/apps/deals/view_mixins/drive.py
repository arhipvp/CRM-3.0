import zipfile
from io import BytesIO

from apps.common.drive import (
    DriveError,
    DriveFileInfo,
    download_drive_file,
    ensure_deal_folder,
    ensure_trash_folder,
    list_drive_folder_contents,
    move_drive_file_to_folder,
    rename_drive_file,
)
from apps.common.services import manage_drive_files
from apps.users.models import AuditLog
from django.http import HttpResponse
from django.shortcuts import get_object_or_404
from django.utils.encoding import iri_to_uri
from django.utils.text import get_valid_filename
from rest_framework import serializers, status
from rest_framework.decorators import action
from rest_framework.exceptions import ValidationError
from rest_framework.parsers import FormParser, JSONParser, MultiPartParser
from rest_framework.response import Response


class DealDriveTrashSerializer(serializers.Serializer):
    file_ids = serializers.ListField(
        child=serializers.CharField(),
        min_length=1,
        allow_empty=False,
        required=True,
    )


class DealDriveRenameSerializer(serializers.Serializer):
    file_id = serializers.CharField()
    name = serializers.CharField()

    def validate_name(self, value: str) -> str:
        trimmed = value.strip()
        if not trimmed:
            raise ValidationError("Название файла не должно быть пустым.")
        return trimmed


class DealDriveDownloadSerializer(serializers.Serializer):
    file_ids = serializers.ListField(
        child=serializers.CharField(),
        min_length=1,
        allow_empty=False,
        required=True,
    )


class DealDriveMixin:
    def _create_download_response(
        self,
        content: bytes,
        filename: str,
        content_type: str = "application/octet-stream",
    ) -> HttpResponse:
        response = HttpResponse(content, content_type=content_type)
        safe_name = get_valid_filename(filename) or "download"
        response["Content-Disposition"] = (
            f"attachment; filename=\"{safe_name}\"; filename*=UTF-8''{iri_to_uri(safe_name)}"
        )
        return response

    def _ensure_unique_zip_path(self, path: str, seen: set[str]) -> str:
        if path not in seen:
            seen.add(path)
            return path

        suffix = 1
        base, dot, ext = path.partition(".")
        while True:
            candidate = f"{base} ({suffix}){dot}{ext}" if ext else f"{base} ({suffix})"
            if candidate not in seen:
                seen.add(candidate)
                return candidate
            suffix += 1

    def _collect_folder_files(
        self,
        folder_id: str,
        base_path: str,
        seen: set[str],
        zip_stream: zipfile.ZipFile,
    ) -> int:
        count = 0
        for item in list_drive_folder_contents(folder_id):
            item_name = item["name"] or "file"
            if item["is_folder"]:
                sub_path = f"{base_path}{item_name}/"
                count += self._collect_folder_files(
                    item["id"], sub_path, seen, zip_stream
                )
            else:
                content = download_drive_file(item["id"])
                zip_path = self._ensure_unique_zip_path(f"{base_path}{item_name}", seen)
                zip_stream.writestr(zip_path, content)
                count += 1
        return count

    @action(
        detail=True,
        methods=["get", "post", "delete", "patch"],
        url_path="drive-files",
        parser_classes=[MultiPartParser, FormParser, JSONParser],
    )
    def drive_files(self, request, pk=None):
        queryset = self.filter_queryset(self.get_queryset())
        deal = get_object_or_404(queryset, pk=pk)
        uploaded_file = request.FILES.get("file") if request.method == "POST" else None

        if request.method == "PATCH":
            serializer = DealDriveRenameSerializer(data=request.data)
            serializer.is_valid(raise_exception=True)
            file_id = serializer.validated_data["file_id"].strip()
            new_name = serializer.validated_data["name"]
            if not file_id:
                raise ValidationError({"file_id": "Нужно передать ID файла."})

            try:
                folder_id = deal.drive_folder_id
                if not folder_id:
                    folder_id = ensure_deal_folder(deal)
                if not folder_id:
                    return Response(
                        {"detail": "Папка Google Drive для сделки не найдена."},
                        status=status.HTTP_400_BAD_REQUEST,
                    )

                drive_files = list_drive_folder_contents(folder_id)
                drive_file_map = {item["id"]: item for item in drive_files}
                target_file = drive_file_map.get(file_id)
                if not target_file or target_file["is_folder"]:
                    return Response(
                        {"detail": "Файл не найден или это папка."},
                        status=status.HTTP_400_BAD_REQUEST,
                    )

                if target_file["name"] == new_name:
                    return Response({"file": target_file})

                updated_file = rename_drive_file(file_id, new_name)
                return Response({"file": updated_file})
            except DriveError as exc:
                return Response(
                    {"detail": str(exc)},
                    status=status.HTTP_503_SERVICE_UNAVAILABLE,
                )

        if request.method == "DELETE":
            serializer = DealDriveTrashSerializer(data=request.data)
            serializer.is_valid(raise_exception=True)
            file_ids = [
                file_id.strip()
                for file_id in serializer.validated_data["file_ids"]
                if isinstance(file_id, str) and file_id.strip()
            ]
            if not file_ids:
                raise ValidationError({"file_ids": "Нужно передать ID файлов."})

            try:
                folder_id = deal.drive_folder_id
                if not folder_id:
                    folder_id = ensure_deal_folder(deal)
                if not folder_id:
                    return Response(
                        {"detail": "Папка Google Drive для сделки не найдена."},
                        status=status.HTTP_400_BAD_REQUEST,
                    )

                drive_files = list_drive_folder_contents(folder_id)
                drive_file_map = {item["id"]: item for item in drive_files}
                missing_file_ids = [
                    file_id
                    for file_id in file_ids
                    if file_id not in drive_file_map
                    or drive_file_map[file_id]["is_folder"]
                ]
                if missing_file_ids:
                    return Response(
                        {
                            "detail": "Файлы не найдены или это папки.",
                            "missing_file_ids": missing_file_ids,
                        },
                        status=status.HTTP_400_BAD_REQUEST,
                    )

                trash_folder_id = ensure_trash_folder(folder_id)
                for file_id in file_ids:
                    move_drive_file_to_folder(file_id, trash_folder_id)

                return Response(
                    {
                        "moved_file_ids": file_ids,
                        "trash_folder_id": trash_folder_id,
                    }
                )
            except DriveError as exc:
                return Response(
                    {"detail": str(exc)},
                    status=status.HTTP_503_SERVICE_UNAVAILABLE,
                )

        if request.method == "POST" and not uploaded_file:
            return Response(
                {"detail": "No file provided for upload."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            result = manage_drive_files(
                instance=deal,
                ensure_folder_func=ensure_deal_folder,
                uploaded_file=uploaded_file,
            )
            return Response(result)
        except DriveError as exc:
            return Response(
                {"detail": str(exc)},
                status=status.HTTP_503_SERVICE_UNAVAILABLE,
            )

    @action(
        detail=True,
        methods=["post"],
        url_path="drive-files/download",
        parser_classes=[JSONParser],
    )
    def download_drive_files(self, request, pk=None):
        queryset = self.filter_queryset(self.get_queryset())
        deal = get_object_or_404(queryset, pk=pk)
        serializer = DealDriveDownloadSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        file_ids = [
            file_id.strip()
            for file_id in serializer.validated_data["file_ids"]
            if isinstance(file_id, str) and file_id.strip()
        ]
        if not file_ids:
            raise ValidationError({"file_ids": "Нужно передать ID файлов."})

        try:
            folder_id = deal.drive_folder_id or ensure_deal_folder(deal)
            if not folder_id:
                return Response(
                    {"detail": "Папка Google Drive для сделки не найдена."},
                    status=status.HTTP_400_BAD_REQUEST,
                )

            drive_files = list_drive_folder_contents(folder_id)
            drive_file_map: dict[str, DriveFileInfo] = {
                item["id"]: item for item in drive_files
            }
            missing_ids = [
                file_id for file_id in file_ids if file_id not in drive_file_map
            ]
            if missing_ids:
                return Response(
                    {
                        "detail": "Файлы не найдены в папке сделки.",
                        "missing_file_ids": missing_ids,
                    },
                    status=status.HTTP_400_BAD_REQUEST,
                )

            selected_items = [drive_file_map[file_id] for file_id in file_ids]
            if len(selected_items) == 1 and not selected_items[0]["is_folder"]:
                item = selected_items[0]
                content = download_drive_file(item["id"])
                response = self._create_download_response(
                    content=content,
                    filename=item["name"],
                    content_type=item.get("mime_type") or "application/octet-stream",
                )
                AuditLog.objects.create(
                    actor=request.user if request.user.is_authenticated else None,
                    object_type="deal",
                    object_id=str(deal.id),
                    object_name=deal.title or f"Сделка #{deal.id}",
                    action="update",
                    description=f"Скачан файл '{item['name']}' из папки сделки.",
                )
                return response

            zip_buffer = BytesIO()
            with zipfile.ZipFile(
                zip_buffer, "w", compression=zipfile.ZIP_DEFLATED
            ) as zip_file:
                seen_paths: set[str] = set()
                for item in selected_items:
                    item_name = item["name"] or "file"
                    if item["is_folder"]:
                        base_path = f"{item_name}/"
                        self._collect_folder_files(
                            item["id"], base_path, seen_paths, zip_file
                        )
                    else:
                        content = download_drive_file(item["id"])
                        zip_path = self._ensure_unique_zip_path(item_name, seen_paths)
                        zip_file.writestr(zip_path, content)

            zip_buffer.seek(0)
            archive_name = (
                f"{deal.title or f'deal-{deal.id}'}-files.zip"
                if len(selected_items) > 1
                else f"{selected_items[0]['name']}.zip"
            )
            response = self._create_download_response(
                content=zip_buffer.read(),
                filename=archive_name,
                content_type="application/zip",
            )
            AuditLog.objects.create(
                actor=request.user if request.user.is_authenticated else None,
                object_type="deal",
                object_id=str(deal.id),
                object_name=deal.title or f"Сделка #{deal.id}",
                action="update",
                description=f"Скачан архив файлов сделки ({len(file_ids)} шт.).",
            )
            return response
        except DriveError as exc:
            return Response(
                {"detail": str(exc)},
                status=status.HTTP_503_SERVICE_UNAVAILABLE,
            )
