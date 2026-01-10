import logging
from typing import List

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
from apps.tasks.models import Task
from django.db.models import Count, DecimalField, Q, Sum, Value
from django.db.models.functions import Coalesce, TruncDate
from django.utils import timezone
from rest_framework import serializers, status, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import PermissionDenied
from rest_framework.parsers import FormParser, MultiPartParser
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from .ai_service import (
    PolicyRecognitionError,
    extract_text_from_bytes,
    recognize_policy_from_text,
)
from .dashboard import format_amount, get_month_bounds, parse_date_value
from .filters import PolicyFilterSet
from .models import Policy
from .permissions import user_can_modify_deal, user_is_admin
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
        "deal__title",
        "client__name",
        "insured_client__name",
        "insurance_company__name",
        "insurance_type__name",
        "sales_channel__name",
    ]
    ordering_fields = [
        "number",
        "client__name",
        "insured_client__name",
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

        if not user_is_admin(user):
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

        if not user_can_modify_deal(request.user, deal):
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

        downloaded_files: List[dict[str, str]] = []
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

            downloaded_files.append(
                {
                    "id": file_id,
                    "name": file_info["name"],
                    "text": extract_text_from_bytes(content, file_info["name"]),
                }
            )

        if downloaded_files:
            combined_text = "\n\n".join(
                f"Файл {file_data['name']}:\n{file_data['text']}"
                for file_data in downloaded_files
            ).strip()
            if not combined_text:
                combined_text = downloaded_files[0]["text"]

            try:
                data, transcript = recognize_policy_from_text(
                    combined_text,
                    extra_companies=company_names,
                    extra_types=type_names,
                )
            except PolicyRecognitionError as exc:
                for file_data in downloaded_files:
                    results.append(
                        {
                            "fileId": file_data["id"],
                            "fileName": file_data["name"],
                            "status": "error",
                            "message": str(exc),
                            "transcript": exc.transcript,
                        }
                    )
                return Response({"results": results})

            primary_file_id = downloaded_files[0]["id"]
            for file_data in downloaded_files:
                is_primary = file_data["id"] == primary_file_id
                payload = {
                    "fileId": file_data["id"],
                    "fileName": file_data["name"],
                    "status": "parsed",
                    "message": (
                        f"Распознано (1 запрос на {len(downloaded_files)} файлов)."
                        if is_primary
                        else "Файл использован в общем распознавании, результат см. в первом файле."
                    ),
                }
                if is_primary:
                    payload["transcript"] = transcript
                    payload["data"] = data
                results.append(payload)

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
        return user_can_modify_deal(user, deal)

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


class SellerDashboardView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        user = request.user
        start_param = request.query_params.get("start_date")
        end_param = request.query_params.get("end_date")
        start_date = parse_date_value(start_param)
        end_date = parse_date_value(end_param)

        if (start_param and not start_date) or (end_param and not end_date):
            return Response(
                {"detail": "Неверный формат даты. Используйте YYYY-MM-DD."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if (start_date and not end_date) or (end_date and not start_date):
            return Response(
                {"detail": "Нужно указать обе даты: start_date и end_date."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if start_date and end_date and end_date < start_date:
            return Response(
                {"detail": "Дата окончания не может быть раньше даты начала."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if not start_date and not end_date:
            today = timezone.localdate()
            start_date, end_date = get_month_bounds(today)

        decimal_field = DecimalField(max_digits=12, decimal_places=2)
        queryset = (
            Policy.objects.filter(
                deal__seller=user,
                start_date__isnull=False,
                start_date__gte=start_date,
                start_date__lte=end_date,
            )
            .select_related(
                "insurance_company",
                "insurance_type",
                "client",
                "insured_client",
            )
            .annotate(
                paid_amount=Coalesce(
                    Sum(
                        "payments__amount",
                        filter=Q(payments__actual_date__isnull=False),
                    ),
                    Value(0),
                    output_field=decimal_field,
                )
            )
            .order_by("-start_date", "-created_at")
        )

        total_paid = format_amount(
            queryset.aggregate(
                total=Coalesce(
                    Sum(
                        "payments__amount",
                        filter=Q(payments__actual_date__isnull=False),
                    ),
                    Value(0),
                    output_field=decimal_field,
                )
            )["total"]
        )

        policies = []
        for policy in queryset:
            policies.append(
                {
                    "id": policy.id,
                    "number": policy.number,
                    "insurance_company": (
                        policy.insurance_company.name
                        if policy.insurance_company
                        else ""
                    ),
                    "insurance_type": (
                        policy.insurance_type.name if policy.insurance_type else ""
                    ),
                    "client_name": policy.client.name if policy.client else None,
                    "insured_client_name": (
                        policy.insured_client.name if policy.insured_client else None
                    ),
                    "start_date": policy.start_date,
                    "paid_amount": format_amount(policy.paid_amount),
                }
            )

        tasks_queryset = Task.objects.filter(deal__seller=user, deleted_at__isnull=True)
        tasks_current = tasks_queryset.exclude(
            status__in=[Task.TaskStatus.DONE, Task.TaskStatus.CANCELED]
        ).count()
        tasks_completed = tasks_queryset.filter(
            status=Task.TaskStatus.DONE,
            completed_at__date__gte=start_date,
            completed_at__date__lte=end_date,
        ).count()

        payments_by_day = (
            Payment.objects.filter(
                policy__deal__seller=user,
                policy__start_date__isnull=False,
                policy__start_date__gte=start_date,
                policy__start_date__lte=end_date,
                actual_date__isnull=False,
                actual_date__gte=start_date,
                actual_date__lte=end_date,
            )
            .values("actual_date")
            .annotate(
                total=Coalesce(
                    Sum("amount"),
                    Value(0),
                    output_field=decimal_field,
                )
            )
            .order_by("actual_date")
        )
        payments_series = [
            {
                "date": item["actual_date"],
                "total": format_amount(item["total"]),
            }
            for item in payments_by_day
        ]

        tasks_completed_by_day = (
            tasks_queryset.filter(
                status=Task.TaskStatus.DONE,
                completed_at__date__gte=start_date,
                completed_at__date__lte=end_date,
            )
            .annotate(day=TruncDate("completed_at"))
            .values("day")
            .annotate(count=Count("id"))
            .order_by("day")
        )
        tasks_series = [
            {"date": item["day"], "count": item["count"]}
            for item in tasks_completed_by_day
        ]

        tasks_completed_by_executor = (
            tasks_queryset.filter(
                status=Task.TaskStatus.DONE,
                completed_at__date__gte=start_date,
                completed_at__date__lte=end_date,
            )
            .annotate(day=TruncDate("completed_at"))
            .values(
                "day",
                "assignee_id",
                "assignee__first_name",
                "assignee__last_name",
                "assignee__username",
            )
            .annotate(count=Count("id"))
            .order_by("day")
        )
        tasks_executor_series = []
        for item in tasks_completed_by_executor:
            first_name = (item.get("assignee__first_name") or "").strip()
            last_name = (item.get("assignee__last_name") or "").strip()
            full_name = f"{first_name} {last_name}".strip()
            executor_name = full_name or item.get("assignee__username") or "Неизвестный"
            tasks_executor_series.append(
                {
                    "date": item["day"],
                    "executor_id": item.get("assignee_id"),
                    "executor_name": executor_name,
                    "count": item["count"],
                }
            )

        return Response(
            {
                "start_date": start_date,
                "end_date": end_date,
                "total_paid": total_paid,
                "tasks_current": tasks_current,
                "tasks_completed": tasks_completed,
                "payments_by_day": payments_series,
                "tasks_completed_by_day": tasks_series,
                "tasks_completed_by_executor": tasks_executor_series,
                "policies": policies,
            }
        )
