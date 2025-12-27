from apps.common.drive import (
    DriveError,
    ensure_deal_folder,
    ensure_trash_folder,
    list_drive_folder_contents,
    move_drive_file_to_folder,
    rename_drive_file,
)
from apps.common.services import manage_drive_files
from django.shortcuts import get_object_or_404
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
            raise ValidationError(
                "РќР°Р·РІР°РЅРёРµ С„Р°Р№Р»Р° РЅРµ РґРѕР»Р¶РЅРѕ Р±С‹С‚СЊ РїСѓСЃС‚С‹Рј."
            )
        return trimmed


class DealDriveMixin:
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
                raise ValidationError(
                    {"file_id": "РќСѓР¶РЅРѕ РїРµСЂРµРґР°С‚СЊ ID С„Р°Р№Р»Р°."}
                )

            try:
                folder_id = deal.drive_folder_id
                if not folder_id:
                    folder_id = ensure_deal_folder(deal)
                if not folder_id:
                    return Response(
                        {
                            "detail": "РџР°РїРєР° Google Drive РґР»СЏ СЃРґРµР»РєРё РЅРµ РЅР°Р№РґРµРЅР°."
                        },
                        status=status.HTTP_400_BAD_REQUEST,
                    )

                drive_files = list_drive_folder_contents(folder_id)
                drive_file_map = {item["id"]: item for item in drive_files}
                target_file = drive_file_map.get(file_id)
                if not target_file or target_file["is_folder"]:
                    return Response(
                        {
                            "detail": "Р¤Р°Р№Р» РЅРµ РЅР°Р№РґРµРЅ РёР»Рё СЌС‚Рѕ РїР°РїРєР°."
                        },
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
                raise ValidationError(
                    {"file_ids": "Нужно передать хотя бы один ID файла."}
                )

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
                            "detail": "Некоторые файлы не найдены в папке сделки.",
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
