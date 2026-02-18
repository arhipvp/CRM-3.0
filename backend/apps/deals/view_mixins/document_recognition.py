from __future__ import annotations

import json
import logging
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
                        "message": "Файл не найден в папке сделки.",
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
                        "documentType": recognition.document_type,
                        "normalizedType": getattr(recognition, "normalized_type", None),
                        "confidence": recognition.confidence,
                        "warnings": recognition.warnings,
                        "data": recognition.data,
                        "extractedText": getattr(recognition, "extracted_text", ""),
                        "transcript": recognition.transcript,
                    }
                )
            except (DriveError, DocumentRecognitionError) as exc:
                logger.exception("Ошибка распознавания файла %s", file_id)
                results.append(
                    {
                        "fileId": file_id,
                        "fileName": file_name,
                        "status": "error",
                        "message": str(exc),
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
                        "message": "Внутренняя ошибка распознавания документа.",
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
        blocks: list[str] = [title, ""]
        for index, item in enumerate(results, start=1):
            file_label = item.get("fileName") or item.get("fileId") or f"Файл {index}"
            blocks.append(f"{index}. {file_label}")
            blocks.append(f"Статус: {item.get('status')}")
            if item.get("documentType"):
                blocks.append(f"Тип документа: {item.get('documentType')}")
            if item.get("normalizedType"):
                blocks.append(f"Категория CRM: {item.get('normalizedType')}")
            if item.get("confidence") is not None:
                blocks.append(f"Уверенность: {item.get('confidence')}")
            if item.get("warnings"):
                blocks.append(
                    "Предупреждения: "
                    + ", ".join(str(warning) for warning in item.get("warnings", []))
                )
            if item.get("data") is not None:
                human_data = self._format_human_data(item.get("data"))
                if human_data:
                    blocks.append(f"Ключевые данные (текстом):\n{human_data}")
                blocks.append(
                    "Данные:\n"
                    + json.dumps(
                        item.get("data"), ensure_ascii=False, indent=2, default=str
                    )
                )
            if item.get("extractedText"):
                blocks.append(f"Распознанный текст:\n{item.get('extractedText')}")
            if item.get("transcript"):
                blocks.append(f"Transcript:\n{item.get('transcript')}")
            if item.get("message"):
                blocks.append(f"Ошибка: {item.get('message')}")
            blocks.append("")

        note_body = "\n".join(blocks).strip()
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

    def _format_human_data(self, data: Any) -> str:
        if not isinstance(data, dict):
            return ""
        lines: list[str] = []
        for key, value in data.items():
            if value is None:
                continue
            if isinstance(value, str):
                text_value = value.strip()
                if not text_value:
                    continue
                lines.append(f"- {key}: {text_value}")
                continue
            if isinstance(value, list):
                values = [str(item).strip() for item in value if str(item).strip()]
                if values:
                    lines.append(f"- {key}: {', '.join(values)}")
                continue
            if isinstance(value, dict):
                nested_parts = []
                for nested_key, nested_value in value.items():
                    nested_text = str(nested_value).strip()
                    if nested_text:
                        nested_parts.append(f"{nested_key}={nested_text}")
                if nested_parts:
                    lines.append(f"- {key}: {', '.join(nested_parts)}")
                continue
            lines.append(f"- {key}: {value}")
        return "\n".join(lines)
