from apps.common.drive import DriveError, build_drive_file_tree_map, ensure_deal_folder
from django.utils import timezone
from rest_framework import status
from rest_framework.decorators import action
from rest_framework.parsers import JSONParser
from rest_framework.response import Response

from ..calculation_recognition import (
    CalculationRecognitionFolderMissing,
    recognize_osago_calculation,
)
from ..document_recognition_service import (
    DealDocumentRecognitionFolderMissing,
    recognize_deal_documents,
)
from ..permissions import can_modify_deal
from ..serializers import (
    DealCalculationRecognitionRequestSerializer,
    DealCalculationSaveSerializer,
    DealDocumentRecognitionRequestSerializer,
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

        serializer = DealDocumentRecognitionRequestSerializer(data=request.data)
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
            payload = recognize_deal_documents(deal, file_ids, request.user)
        except DealDocumentRecognitionFolderMissing as exc:
            return Response(
                {"detail": str(exc)},
                status=status.HTTP_400_BAD_REQUEST,
            )
        except DriveError as exc:
            return Response(
                {"detail": str(exc)},
                status=status.HTTP_503_SERVICE_UNAVAILABLE,
            )
        return Response(payload)

    @action(
        detail=True,
        methods=["post"],
        url_path="recognize-calculation",
        parser_classes=[JSONParser],
    )
    def recognize_calculation(self, request, pk=None):
        deal = self.get_object()
        serializer = DealCalculationRecognitionRequestSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        try:
            payload = recognize_osago_calculation(
                deal,
                serializer.validated_data["file_ids"],
                serializer.validated_data["source_text"],
            )
        except CalculationRecognitionFolderMissing as exc:
            return Response({"detail": str(exc)}, status=status.HTTP_400_BAD_REQUEST)
        except DriveError as exc:
            return Response(
                {"detail": str(exc)}, status=status.HTTP_503_SERVICE_UNAVAILABLE
            )
        return Response(payload)

    @action(
        detail=True,
        methods=["patch"],
        url_path="calculation",
        parser_classes=[JSONParser],
    )
    def save_calculation(self, request, pk=None):
        deal = self.get_object()
        if not can_modify_deal(request.user, deal):
            return Response(
                {
                    "detail": "Только администратор или владелец может сохранять данные расчёта"
                },
                status=status.HTTP_403_FORBIDDEN,
            )

        serializer = DealCalculationSaveSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        source_file_ids = list(
            dict.fromkeys(serializer.validated_data["source_file_ids"])
        )
        if source_file_ids:
            folder_id = deal.drive_folder_id or ensure_deal_folder(deal)
            if not folder_id:
                return Response(
                    {"detail": "Папка Google Drive для сделки не найдена."},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            try:
                file_map = build_drive_file_tree_map(folder_id)
            except DriveError as exc:
                return Response(
                    {"detail": str(exc)},
                    status=status.HTTP_503_SERVICE_UNAVAILABLE,
                )
            invalid_ids = [
                file_id
                for file_id in source_file_ids
                if file_id not in file_map or file_map[file_id].get("is_folder")
            ]
            if invalid_ids:
                return Response(
                    {
                        "detail": "Некоторые исходные файлы не принадлежат сделке.",
                        "file_ids": invalid_ids,
                    },
                    status=status.HTTP_400_BAD_REQUEST,
                )

        deal.calculation_type = serializer.validated_data["calculation_type"]
        deal.calculation_data = serializer.validated_data["calculation_data"]
        deal.calculation_source_text = serializer.validated_data["source_text"]
        deal.calculation_source_file_ids = source_file_ids
        deal.calculation_updated_at = timezone.now()
        deal.calculation_updated_by = request.user
        deal.save(
            update_fields=[
                "calculation_type",
                "calculation_data",
                "calculation_source_text",
                "calculation_source_file_ids",
                "calculation_updated_at",
                "calculation_updated_by",
                "updated_at",
            ]
        )
        return Response(self.get_serializer(deal).data)
