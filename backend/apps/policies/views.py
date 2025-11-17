import logging
from typing import List

from django.db.models import Q
from rest_framework import serializers, status, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response

from apps.common.drive import (
    DriveError,
    download_drive_file,
    ensure_deal_folder,
    list_drive_folder_contents,
)
from apps.common.permissions import EditProtectedMixin
from apps.deals.models import Deal, InsuranceCompany
from apps.users.models import UserRole
from .ai_service import PolicyRecognitionError, recognize_policy_from_bytes
from .filters import PolicyFilterSet
from .models import Policy
from .serializers import PolicySerializer

logger = logging.getLogger(__name__)


class PolicyRecognitionSerializer(serializers.Serializer):
    deal_id = serializers.UUIDField(required=True)
    file_ids = serializers.ListField(
        child=serializers.CharField(),
        min_length=1,
        allow_empty=False,
        required=True,
    )


class PolicyViewSet(EditProtectedMixin, viewsets.ModelViewSet):
    serializer_class = PolicySerializer
    filterset_class = PolicyFilterSet
    search_fields = [
        "number",
        "insurance_company__name",
        "insurance_type__name",
        "sales_channel__name",
    ]
    ordering_fields = ["created_at", "updated_at", "start_date", "end_date", "brand", "model"]
    ordering = ["-created_at"]

    def get_queryset(self):
        user = self.request.user
        queryset = Policy.objects.alive().order_by("-created_at")

        if not user.is_authenticated:
            return queryset

        is_admin = UserRole.objects.filter(user=user, role__name="Admin").exists()
        if not is_admin:
            queryset = queryset.filter(Q(deal__seller=user) | Q(deal__executor=user))

        return queryset

    @action(detail=False, methods=["post"], url_path="recognize")
    def recognize(self, request):
        serializer = PolicyRecognitionSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        deal_id = serializer.validated_data["deal_id"]
        file_ids = serializer.validated_data["file_ids"]

        deal = Deal.objects.filter(pk=deal_id).first()
        if not deal:
            return Response(
                {"detail": "Сделка не найдена."}, status=status.HTTP_404_NOT_FOUND
            )

        if not self._user_can_modify(deal, request.user):
            return Response(
                {"detail": "Нет доступа к сделке."}, status=status.HTTP_403_FORBIDDEN
            )

        folder_id = deal.drive_folder_id
        if not folder_id:
            try:
                folder_id = ensure_deal_folder(deal)
            except DriveError as exc:
                logger.warning("Failed to ensure drive folder: %s", exc)
                return Response(
                    {"detail": str(exc)}, status=status.HTTP_503_SERVICE_UNAVAILABLE
                )
        if not folder_id:
            return Response(
                {"detail": "Файловая папка сделки не настроена."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            drive_files = list_drive_folder_contents(folder_id)
        except DriveError as exc:
            logger.exception("Cannot list drive files")
            return Response(
                {"detail": str(exc)}, status=status.HTTP_503_SERVICE_UNAVAILABLE
            )

        file_map = {item["id"]: item for item in drive_files}
        seen = set()
        results: List[dict] = []
        company_names = list(
            InsuranceCompany.objects.order_by("name").values_list("name", flat=True)
        )

        for file_id in file_ids:
            if file_id in seen:
                continue
            seen.add(file_id)

            file_info = file_map.get(file_id)
            if not file_info:
                results.append(
                    {
                        "fileId": file_id,
                        "status": "error",
                        "message": "Файл не найден в папке сделки.",
                    }
                )
                continue

            try:
                content = download_drive_file(file_id)
            except DriveError as exc:
                results.append(
                    {
                        "fileId": file_id,
                        "fileName": file_info["name"],
                        "status": "error",
                        "message": str(exc),
                    }
                )
                continue

            try:
                data, transcript = recognize_policy_from_bytes(
                    content,
                    filename=file_info["name"],
                    extra_companies=company_names,
                )
            except PolicyRecognitionError as exc:
                results.append(
                    {
                        "fileId": file_id,
                        "fileName": file_info["name"],
                        "status": "error",
                        "message": str(exc),
                        "transcript": exc.transcript,
                    }
                )
                continue

            results.append(
                {
                    "fileId": file_id,
                    "fileName": file_info["name"],
                    "status": "parsed",
                    "message": "Полис распознан",
                    "transcript": transcript,
                    "data": data,
                }
            )

        return Response({"results": results})

    def _user_can_modify(self, deal: Deal, user) -> bool:
        if not user or not user.is_authenticated:
            return False
        if UserRole.objects.filter(user=user, role__name="Admin").exists():
            return True
        return deal.seller_id == user.id or deal.executor_id == user.id
