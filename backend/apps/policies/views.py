import logging
from typing import List, Optional

from apps.common.drive import (
    DriveError,
    download_drive_file,
    ensure_deal_folder,
    ensure_policy_folder,
    list_drive_folder_contents,
    move_drive_file_to_folder,
)
from apps.common.permissions import EditProtectedMixin
from apps.common.services import manage_drive_files
from apps.deals.models import Deal, InsuranceCompany, InsuranceType
from apps.finances.models import Payment
from apps.users.models import UserRole
from django.db.models import DecimalField, Q, Sum, Value
from django.db.models.functions import Coalesce
from rest_framework import serializers, status, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import PermissionDenied
from rest_framework.parsers import FormParser, MultiPartParser
from rest_framework.response import Response

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
    ordering_fields = [
        "created_at",
        "updated_at",
        "start_date",
        "end_date",
        "brand",
        "model",
    ]
    ordering = ["-created_at"]

    def get_queryset(self):
        user = self.request.user
        queryset = Policy.objects.alive()
        decimal_field = DecimalField(max_digits=12, decimal_places=2)
        queryset = queryset.annotate(
            payments_total=Coalesce(
                Sum("payments__amount"),
                Value(0),
                output_field=decimal_field,
            ),
            payments_paid=Coalesce(
                Sum(
                    "payments__amount",
                    filter=Q(payments__actual_date__isnull=False),
                ),
                Value(0),
                output_field=decimal_field,
            ),
        ).order_by("-created_at")

        if not user.is_authenticated:
            return queryset

        if self.request.method == "DELETE":
            return queryset

        is_admin = UserRole.objects.filter(user=user, role__name="Admin").exists()
        if not is_admin:
            queryset = queryset.filter(Q(deal__seller=user) | Q(deal__executor=user))

        return queryset

    @action(
        detail=True,
        methods=["get", "post"],
        url_path="drive-files",
        parser_classes=[MultiPartParser, FormParser],
    )
    def drive_files(self, request, pk=None):
        policy = self.get_object()
        uploaded_file = request.FILES.get("file") if request.method == "POST" else None

        if request.method == "POST" and not uploaded_file:
            return Response(
                {"detail": "Файл не передан"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            result = manage_drive_files(
                instance=policy,
                ensure_folder_func=ensure_policy_folder,
                uploaded_file=uploaded_file,
            )
            return Response(result)
        except DriveError as exc:
            return Response(
                {"detail": str(exc)},
                status=status.HTTP_503_SERVICE_UNAVAILABLE,
            )

    @action(detail=False, methods=["post"], url_path="recognize")
    def recognize(self, request):
        serializer = PolicyRecognitionSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        deal_id = serializer.validated_data["deal_id"]
        file_ids = serializer.validated_data["file_ids"]

        deal = Deal.objects.filter(pk=deal_id).first()
        if not deal:
            return Response(
                {"detail": "Сделка не найдена."},
                status=status.HTTP_404_NOT_FOUND,
            )

        if not self._user_can_modify(deal, request.user):
            return Response(
                {"detail": "Нет доступа к сделке."},
                status=status.HTTP_403_FORBIDDEN,
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
            InsuranceCompany.objects.filter(name__isnull=False)
            .exclude(name__exact="")
            .order_by("name")
            .values_list("name", flat=True)
            .distinct()
        )
        type_names = list(
            InsuranceType.objects.filter(name__isnull=False)
            .exclude(name__exact="")
            .order_by("name")
            .values_list("name", flat=True)
            .distinct()
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
                    extra_types=type_names,
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

    @action(detail=False, methods=["get"], url_path="vehicle-brands")
    def vehicle_brands(self, request):
        brands = (
            Policy.objects.filter(brand__isnull=False)
            .exclude(brand__exact="")
            .order_by("brand")
            .values_list("brand", flat=True)
            .distinct()
        )
        return Response({"results": list(brands)})

    @action(detail=False, methods=["get"], url_path="vehicle-models")
    def vehicle_models(self, request):
        queryset = Policy.objects.filter(model__isnull=False).exclude(model__exact="")
        brand = request.query_params.get("brand")
        if brand:
            queryset = queryset.filter(brand__iexact=brand)
        models = queryset.order_by("model").values_list("model", flat=True).distinct()
        return Response({"results": list(models)})

    def _can_modify(self, user, instance):
        deal = getattr(instance, "deal", None)
        return self._user_can_modify(deal, user)

    def _user_can_modify(self, deal: Optional[Deal], user) -> bool:
        if not user or not user.is_authenticated:
            return False
        if UserRole.objects.filter(user=user, role__name="Admin").exists():
            return True
        if not deal:
            return False
        return deal.seller_id == user.id or deal.executor_id == user.id

    def _move_recognized_file_to_folder(self, policy: Policy, file_id: str) -> None:
        if not file_id:
            return
        try:
            folder_id = ensure_policy_folder(policy)
            if not folder_id:
                return
            move_drive_file_to_folder(file_id, folder_id)
        except DriveError:
            logger.exception(
                "Failed to move recognized Drive file %s into policy folder", file_id
            )

    def perform_create(self, serializer):
        deal = serializer.validated_data.get("deal")
        user = self.request.user

        if not deal or not user or not user.is_authenticated:
            raise PermissionDenied("Нет доступа к сделке.")

        if deal.seller_id != user.id:
            raise PermissionDenied("Только продавец сделки может добавлять полис.")

        source_file_id = serializer.validated_data.pop("source_file_id", None)
        if isinstance(source_file_id, str):
            source_file_id = source_file_id.strip()
        source_file_ids = serializer.validated_data.pop("source_file_ids", []) or []
        normalized_file_ids = []
        if isinstance(source_file_ids, list):
            for file_id in source_file_ids:
                if isinstance(file_id, str):
                    cleaned = file_id.strip()
                    if cleaned:
                        normalized_file_ids.append(cleaned)
        if source_file_id:
            normalized_file_ids.append(source_file_id)
        policy = serializer.save()
        moved_file_ids = set()
        for file_id in normalized_file_ids:
            if file_id and file_id not in moved_file_ids:
                self._move_recognized_file_to_folder(policy, file_id)
                moved_file_ids.add(file_id)
