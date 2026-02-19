from __future__ import annotations

import logging
from collections import OrderedDict
from typing import Any

from apps.common.drive import (
    DriveError,
    download_drive_file,
    ensure_deal_folder,
    list_drive_folder_contents,
)
from apps.notes.models import Note
from apps.users.models import AuditLog
from rest_framework import serializers, status
from rest_framework.decorators import action
from rest_framework.parsers import JSONParser
from rest_framework.response import Response

from ..document_recognition import (
    DocumentRecognitionError,
    recognize_document_from_file,
)

logger = logging.getLogger(__name__)


class DealDocumentRecognitionSerializer(serializers.Serializer):
    file_ids = serializers.ListField(
        child=serializers.CharField(),
        min_length=1,
        allow_empty=False,
        required=True,
    )


class DealDocumentRecognitionMixin:
    @action(
        detail=True,
        methods=["post"],
        url_path="recognize-documents",
        parser_classes=[JSONParser],
    )
    def recognize_documents(self, request, pk=None):
        queryset = self.filter_queryset(self.get_queryset())
        deal = self.get_object() if pk is None else queryset.filter(pk=pk).first()
        if not deal:
            return Response(
                {"detail": "Сделка не найдена."},
                status=status.HTTP_404_NOT_FOUND,
            )

        serializer = DealDocumentRecognitionSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        file_ids = [
            file_id.strip()
            for file_id in serializer.validated_data["file_ids"]
            if isinstance(file_id, str) and file_id.strip()
        ]
        if not file_ids:
            return Response(
                {"detail": "Нужно передать ID файлов."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            folder_id = deal.drive_folder_id or ensure_deal_folder(deal)
        except DriveError as exc:
            return Response(
                {"detail": str(exc)},
                status=status.HTTP_503_SERVICE_UNAVAILABLE,
            )
        if not folder_id:
            return Response(
                {"detail": "Папка Google Drive для сделки не найдена."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            drive_files = list_drive_folder_contents(folder_id)
        except DriveError as exc:
            return Response(
                {"detail": str(exc)},
                status=status.HTTP_503_SERVICE_UNAVAILABLE,
            )

        file_map = {item["id"]: item for item in drive_files}
        seen_ids: set[str] = set()
        results: list[dict[str, Any]] = []

        for file_id in file_ids:
            if file_id in seen_ids:
                continue
            seen_ids.add(file_id)

            file_info = file_map.get(file_id)
            if not file_info or file_info.get("is_folder"):
                results.append(
                    {
                        "fileId": file_id,
                        "status": "error",
                        "doc": None,
                        "transcript": None,
                        "error": {
                            "code": "file_not_found",
                            "message": "Файл не найден в папке сделки.",
                        },
                    }
                )
                continue

            file_name = file_info.get("name") or file_id
            try:
                content = download_drive_file(file_id)
                recognition = recognize_document_from_file(content, file_name)
                results.append(
                    {
                        "fileId": file_id,
                        "fileName": file_name,
                        "status": "parsed",
                        "doc": {
                            "rawType": recognition.document_type,
                            "normalizedType": getattr(
                                recognition, "normalized_type", None
                            ),
                            "confidence": recognition.confidence,
                            "warnings": recognition.warnings,
                            "fields": recognition.data,
                            "validation": {
                                "accepted": getattr(recognition, "accepted_fields", []),
                                "rejected": getattr(recognition, "rejected_fields", {}),
                            },
                            "extractedText": str(
                                getattr(recognition, "extracted_text", "") or ""
                            ),
                        },
                        "transcript": str(getattr(recognition, "transcript", "") or ""),
                        "error": None,
                    }
                )
            except (DriveError, DocumentRecognitionError) as exc:
                logger.exception("Ошибка распознавания файла %s", file_id)
                results.append(
                    {
                        "fileId": file_id,
                        "fileName": file_name,
                        "status": "error",
                        "doc": None,
                        "transcript": None,
                        "error": {
                            "code": "recognition_error",
                            "message": str(exc),
                        },
                    }
                )
            except Exception:
                logger.exception(
                    "Непредвиденная ошибка распознавания файла %s", file_id
                )
                results.append(
                    {
                        "fileId": file_id,
                        "fileName": file_name,
                        "status": "error",
                        "doc": None,
                        "transcript": None,
                        "error": {
                            "code": "internal_error",
                            "message": "Внутренняя ошибка распознавания документа.",
                        },
                    }
                )

        note = self._create_document_recognition_note(deal, request.user, results)
        AuditLog.objects.create(
            actor=request.user if request.user.is_authenticated else None,
            object_type="deal",
            object_id=str(deal.id),
            object_name=deal.title or f"Сделка #{deal.id}",
            action="update",
            description=(
                f"Выполнено распознавание документов: {len(results)} файл(ов), "
                f"успешно {sum(1 for item in results if item.get('status') == 'parsed')}."
            ),
        )
        return Response({"results": results, "noteId": str(note.id) if note else None})

    def _create_document_recognition_note(
        self, deal, user, results: list[dict[str, Any]]
    ):
        title = "Распознавание документов (ИИ)"
        aggregated_fields: OrderedDict[str, list[str]] = OrderedDict()
        for item in results:
            if item.get("status") != "parsed":
                continue
            doc = item.get("doc") if isinstance(item.get("doc"), dict) else {}
            fields = doc.get("fields") if isinstance(doc.get("fields"), dict) else {}
            for key, value in fields.items():
                field_values = self._normalize_field_values(value)
                if not field_values:
                    continue
                if key not in aggregated_fields:
                    aggregated_fields[key] = []
                for field_value in field_values:
                    if field_value not in aggregated_fields[key]:
                        aggregated_fields[key].append(field_value)

        lines: list[str] = [title, ""]
        for key, values in aggregated_fields.items():
            for value in values:
                lines.append(f"{key}: {value}")

        note_body = "\n".join(lines).strip()
        if not note_body:
            return None
        author_name = ""
        if user and user.is_authenticated:
            author_name = (user.get_full_name() or "").strip() or user.username
        return Note.objects.create(
            deal=deal,
            body=note_body,
            author=user if user and user.is_authenticated else None,
            author_name=author_name,
        )

    def _normalize_field_values(self, value: Any) -> list[str]:
        values: list[str] = []
        if isinstance(value, list):
            joined = ", ".join(
                normalized
                for item in value
                for normalized in self._normalize_field_values(item)
            ).strip(", ")
            return [joined] if joined else []
        if isinstance(value, dict):
            parts = []
            if value is None:
                return []
            for nested_key, nested_value in value.items():
                nested_values = self._normalize_field_values(nested_value)
                if nested_values:
                    parts.extend(f"{nested_key}={nested}" for nested in nested_values)
            return [", ".join(parts)] if parts else []
        text_value = str(value).strip()
        if not text_value:
            return []
        values.append(text_value)
        return values
