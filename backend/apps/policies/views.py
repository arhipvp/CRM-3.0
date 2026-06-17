from datetime import timedelta

from apps.common.drive import (
    DriveError,
    ensure_policy_folder,
)
from apps.common.permissions import EditProtectedMixin
from apps.common.services import manage_drive_files
from apps.deals.models import Deal
from apps.deals.permissions import build_deal_visibility_q
from apps.finances.models import Payment
from apps.finances.serializers import PaymentSerializer
from django.core.exceptions import ValidationError as DjangoValidationError
from django.db.models import DecimalField, Prefetch, Q, Sum, Value
from django.db.models.functions import Coalesce
from django.utils import timezone
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import PermissionDenied
from rest_framework.exceptions import ValidationError as DRFValidationError
from rest_framework.parsers import FormParser, MultiPartParser
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from .dashboard import get_month_bounds, parse_date_value
from .dashboard_service import build_seller_dashboard_payload
from .filters import PolicyFilterSet
from .issuance import (
    PolicyIssuanceError,
    cancel_policy_issuance,
    get_latest_execution,
    resume_policy_issuance,
    start_policy_issuance,
)
from .models import Policy, PolicyIssuanceExecution
from .permissions import user_can_modify_deal, user_is_admin
from .serializers import (
    PolicyDraftSerializer,
    PolicyIssuanceExecutionStatusSerializer,
    PolicyMoveRequestSerializer,
    PolicyRecognitionRequestSerializer,
    PolicySerializer,
)
from .services.delete import delete_policy_with_rules
from .services.files import (
    detach_source_files_from_notes,
    move_recognized_files_to_policy_folder,
    normalize_source_file_ids,
)
from .services.finance import apply_policy_draft
from .services.move import move_policy_to_deal
from .services.recognition import (
    PolicyRecognitionFolderMissing,
    recognize_policy_files,
)
from .status import STATUS_VALUES, with_computed_status_flags


class PolicyViewSet(EditProtectedMixin, viewsets.ModelViewSet):
    serializer_class = PolicySerializer
    filterset_class = PolicyFilterSet
    search_fields = [
        "number",
        "note",
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
        queryset = (
            Policy.objects.alive()
            .select_related(
                "deal",
                "client",
                "insured_client",
                "insurance_company",
                "insurance_type",
                "sales_channel",
            )
            .prefetch_related(
                Prefetch(
                    "issuance_executions",
                    queryset=PolicyIssuanceExecution.objects.order_by("-created_at"),
                    to_attr="prefetched_issuance_executions",
                )
            )
        )
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
        )
        queryset = with_computed_status_flags(queryset).order_by("-created_at")

        if not user.is_authenticated:
            return queryset

        if self.request.method == "DELETE":
            return queryset

        if not user_is_admin(user):
            queryset = queryset.filter(
                Q(deal__seller=user)
                | Q(deal__executor=user)
                | Q(deal__visible_users=user)
            )

        return queryset

    @action(detail=False, methods=["get"], url_path="kpi")
    def kpi(self, request):
        queryset = self.filter_queryset(self.get_queryset())
        today = timezone.localdate()
        expiring_days = request.query_params.get("expiring_days")
        try:
            expiring_days_int = int(expiring_days) if expiring_days is not None else 30
        except (TypeError, ValueError):
            expiring_days_int = 30
        if expiring_days_int < 0:
            expiring_days_int = 30
        expiring_to = today + timedelta(days=expiring_days_int)
        payload = {
            "total": queryset.count(),
            "problem_count": queryset.filter(has_unpaid_record=True).count(),
            "due_count": queryset.filter(
                has_unpaid_record=False, has_unpaid_payment=True
            ).count(),
            "expiring_soon_count": queryset.filter(
                has_unpaid_record=False,
                has_unpaid_payment=False,
                is_renewed=False,
                end_date__isnull=False,
                end_date__gte=today,
                end_date__lte=expiring_to,
            ).count(),
            "expiring_days": expiring_days_int,
            "status_values": {
                "problem": STATUS_VALUES.PROBLEM,
                "due": STATUS_VALUES.DUE,
                "expired": STATUS_VALUES.EXPIRED,
                "active": STATUS_VALUES.ACTIVE,
            },
        }
        return Response(payload)

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

    def _draft_response(self, policy: Policy, payments: list[Payment], request):
        return Response(
            {
                "policy": PolicySerializer(policy, context={"request": request}).data,
                "payments": PaymentSerializer(
                    payments,
                    many=True,
                    context={"request": request},
                ).data,
            }
        )

    @action(detail=False, methods=["post"], url_path="draft")
    def draft_create(self, request):
        serializer = PolicyDraftSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        policy, payments = apply_policy_draft(
            user=request.user,
            data=serializer.validated_data.copy(),
        )
        return self._draft_response(policy, payments, request)

    @action(detail=True, methods=["patch", "put"], url_path="draft")
    def draft_update(self, request, pk=None):
        policy = self.get_object()
        serializer = PolicyDraftSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        policy, payments = apply_policy_draft(
            user=request.user,
            policy=policy,
            data=serializer.validated_data.copy(),
        )
        return self._draft_response(policy, payments, request)

    @action(detail=False, methods=["post"], url_path="recognize")
    def recognize(self, request):
        serializer = PolicyRecognitionRequestSerializer(data=request.data)
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

        try:
            payload = recognize_policy_files(deal, file_ids)
        except PolicyRecognitionFolderMissing as exc:
            return Response(
                {"detail": str(exc)},
                status=status.HTTP_400_BAD_REQUEST,
            )
        except DriveError as exc:
            return Response(
                {"detail": str(exc)}, status=status.HTTP_503_SERVICE_UNAVAILABLE
            )
        return Response(payload)

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

    def _get_move_target_deal(self, user, target_deal_id):
        queryset = Deal.objects.filter(pk=target_deal_id, deleted_at__isnull=True)
        if not user_is_admin(user):
            queryset = queryset.filter(build_deal_visibility_q(user)).distinct()
        return queryset.first()

    @action(detail=True, methods=["post"], url_path="move")
    def move(self, request, pk=None):
        policy = self.get_object()
        source_deal = policy.deal
        user = request.user

        if not user or not user.is_authenticated:
            raise PermissionDenied("Нет доступа к сделке.")

        if not user_is_admin(user) and source_deal.seller_id != user.id:
            raise PermissionDenied(
                "Только продавец исходной сделки может перенести полис."
            )

        serializer = PolicyMoveRequestSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        target_deal = self._get_move_target_deal(
            user, serializer.validated_data["deal"]
        )
        if not target_deal:
            return Response(
                {"detail": "Целевая сделка не найдена или недоступна."},
                status=status.HTTP_404_NOT_FOUND,
            )
        if target_deal.pk == source_deal.pk:
            raise DRFValidationError(
                {"deal": "Полис уже находится в выбранной сделке."}
            )

        try:
            move_policy_to_deal(policy, target_deal, user)
        except DriveError as exc:
            return Response(
                {"detail": str(exc)},
                status=status.HTTP_503_SERVICE_UNAVAILABLE,
            )

        policy = self.get_queryset().get(pk=policy.pk)
        return Response(self.get_serializer(policy).data)

    def _serialize_latest_issuance(self, policy: Policy, request) -> Response:
        execution = get_latest_execution(policy)
        if execution is None:
            return Response(
                {"detail": "Оформление для полиса ещё не запускалось."},
                status=status.HTTP_404_NOT_FOUND,
            )
        serializer = PolicyIssuanceExecutionStatusSerializer(
            execution, context={"request": request}
        )
        return Response(serializer.data)

    def perform_create(self, serializer):
        deal = serializer.validated_data.get("deal")
        user = self.request.user

        if not deal or not user or not user.is_authenticated:
            raise PermissionDenied("Нет доступа к сделке.")

        if deal.seller_id != user.id:
            raise PermissionDenied("Только продавец сделки может добавлять полис.")

        source_file_id = serializer.validated_data.pop("source_file_id", None)
        source_file_ids = serializer.validated_data.pop("source_file_ids", []) or []
        normalized_file_ids = normalize_source_file_ids(source_file_id, source_file_ids)
        policy = serializer.save()
        if normalized_file_ids:
            move_recognized_files_to_policy_folder(policy, normalized_file_ids)
            detach_source_files_from_notes(deal, normalized_file_ids)

    def perform_destroy(self, instance):
        delete_policy_with_rules(instance)

    @action(detail=True, methods=["get"], url_path="sber-issuance")
    def sber_issuance_status(self, request, pk=None):
        policy = self.get_object()
        return self._serialize_latest_issuance(policy, request)

    @action(detail=True, methods=["post"], url_path="sber-issuance/start")
    def sber_issuance_start(self, request, pk=None):
        policy = self.get_object()
        if not user_can_modify_deal(request.user, policy.deal):
            raise PermissionDenied("Нет доступа к сделке.")
        try:
            execution = start_policy_issuance(policy, request.user)
        except DjangoValidationError as exc:
            raise DRFValidationError(exc.message_dict or exc.messages) from exc
        except PolicyIssuanceError as exc:
            raise DRFValidationError({"detail": str(exc)}) from exc
        serializer = PolicyIssuanceExecutionStatusSerializer(
            execution, context={"request": request}
        )
        return Response(serializer.data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=["post"], url_path="sber-issuance/resume")
    def sber_issuance_resume(self, request, pk=None):
        policy = self.get_object()
        if not user_can_modify_deal(request.user, policy.deal):
            raise PermissionDenied("Нет доступа к сделке.")
        execution = get_latest_execution(policy)
        if execution is None:
            raise DRFValidationError({"detail": "Оформление для полиса не найдено."})
        try:
            execution = resume_policy_issuance(execution)
        except DjangoValidationError as exc:
            raise DRFValidationError(exc.message_dict or exc.messages) from exc
        serializer = PolicyIssuanceExecutionStatusSerializer(
            execution, context={"request": request}
        )
        return Response(serializer.data)

    @action(detail=True, methods=["post"], url_path="sber-issuance/cancel")
    def sber_issuance_cancel(self, request, pk=None):
        policy = self.get_object()
        if not user_can_modify_deal(request.user, policy.deal):
            raise PermissionDenied("Нет доступа к сделке.")
        execution = get_latest_execution(policy)
        if execution is None:
            raise DRFValidationError({"detail": "Оформление для полиса не найдено."})
        try:
            execution = cancel_policy_issuance(execution)
        except DjangoValidationError as exc:
            raise DRFValidationError(exc.message_dict or exc.messages) from exc
        serializer = PolicyIssuanceExecutionStatusSerializer(
            execution, context={"request": request}
        )
        return Response(serializer.data)


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
        payload = build_seller_dashboard_payload(
            user=user,
            start_date=start_date,
            end_date=end_date,
        )
        return Response(payload)
