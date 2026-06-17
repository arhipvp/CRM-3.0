from apps.common.drive import DriveError
from rest_framework import status
from rest_framework.decorators import action
from rest_framework.parsers import JSONParser
from rest_framework.response import Response

from ..document_recognition_service import (
    DealDocumentRecognitionFolderMissing,
    recognize_deal_documents,
)
from ..serializers import DealDocumentRecognitionRequestSerializer


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
