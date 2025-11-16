from apps.common.drive import (
    DriveError,
    ensure_deal_folder,
    list_drive_folder_contents,
    upload_file_to_drive,
)
from apps.common.permissions import EditProtectedMixin
from apps.users.models import UserRole
from django.db.models import F, Q
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.parsers import FormParser, MultiPartParser
from rest_framework.response import Response

from .filters import DealFilterSet
from .models import (
    ActivityLog,
    Deal,
    InsuranceCompany,
    InsuranceType,
    Quote,
)
from .serializers import (
    ActivityLogSerializer,
    DealSerializer,
    InsuranceCompanySerializer,
    InsuranceTypeSerializer,
    QuoteSerializer,
)


class DealViewSet(EditProtectedMixin, viewsets.ModelViewSet):
    serializer_class = DealSerializer
    filterset_class = DealFilterSet
    search_fields = ["title", "description"]
    ordering_fields = ["created_at", "updated_at", "title", "expected_close", "next_contact_date"]
    ordering = ["next_contact_date", "-created_at"]

    def get_queryset(self):
        """
        Фильтровать сделки в зависимости от роли пользователя:
        - Admin: видит все сделки
        - Seller/Executor: видит только свои сделки (где user = seller или executor)
        Сортировка: по дате следующего контакта (ближайшие сверху), затем по дате следующего обзора, затем по дате создания.
        """
        user = self.request.user
        queryset = (
            Deal.objects.select_related("client")
            .prefetch_related("quotes")
            .all()
            .order_by(
                F("next_contact_date").asc(nulls_last=True),
                F("next_review_date").desc(nulls_last=True),
                "-created_at"
            )
        )

        # Если пользователь не аутентифицирован, возвращаем все записи (AllowAny режим)
        if not user.is_authenticated:
            return queryset

        # Администраторы видят все
        is_admin = UserRole.objects.filter(user=user, role__name="Admin").exists()

        if is_admin:
            return queryset

        # Остальные видят только свои сделки (как seller или executor)
        return queryset.filter(Q(seller=user) | Q(executor=user))

    @action(
        detail=True,
        methods=["get", "post"],
        url_path="drive-files",
        parser_classes=[MultiPartParser, FormParser],
    )
    def drive_files(self, request, pk=None):
        deal = self.get_object()
        try:
            folder_id = ensure_deal_folder(deal) or deal.drive_folder_id
        except DriveError as exc:
            return Response(
                {"detail": str(exc)},
                status=status.HTTP_503_SERVICE_UNAVAILABLE,
            )

        if not folder_id:
            return Response({"files": [], "folder_id": None})

        if request.method == "POST":
            uploaded_file = request.FILES.get("file")
            if not uploaded_file:
                return Response(
                    {"detail": "Файл не передан"},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            try:
                drive_file = upload_file_to_drive(
                    folder_id,
                    uploaded_file.file,
                    uploaded_file.name,
                    uploaded_file.content_type or "application/octet-stream",
                )
            except DriveError as exc:
                return Response(
                    {"detail": str(exc)},
                    status=status.HTTP_503_SERVICE_UNAVAILABLE,
                )
            return Response({"file": drive_file, "folder_id": folder_id})

        try:
            files = list_drive_folder_contents(folder_id)
        except DriveError as exc:
            return Response(
                {"detail": str(exc)},
                status=status.HTTP_503_SERVICE_UNAVAILABLE,
            )

        return Response({"files": files, "folder_id": folder_id})


class QuoteViewSet(viewsets.ModelViewSet):
    serializer_class = QuoteSerializer

    def get_queryset(self):
        user = self.request.user
        queryset = (
            Quote.objects.select_related(
                "deal",
                "deal__client",
                "insurance_company",
                "insurance_type",
            )
            .all()
            .order_by("-created_at")
        )

        # Администраторы видят все котировки
        is_admin = UserRole.objects.filter(user=user, role__name="Admin").exists()

        if not is_admin:
            # Остальные видят только котировки для своих сделок (где user = seller или executor)
            queryset = queryset.filter(Q(deal__seller=user) | Q(deal__executor=user))

        deal_id = self.request.query_params.get("deal")
        if deal_id:
            queryset = queryset.filter(deal_id=deal_id)
        return queryset

    def perform_create(self, serializer):
        serializer.save()


class InsuranceCompanyViewSet(viewsets.ReadOnlyModelViewSet):
    serializer_class = InsuranceCompanySerializer
    queryset = InsuranceCompany.objects.order_by("name")
    pagination_class = None


class InsuranceTypeViewSet(viewsets.ReadOnlyModelViewSet):
    serializer_class = InsuranceTypeSerializer
    queryset = InsuranceType.objects.order_by("name")
    pagination_class = None


class ActivityLogViewSet(viewsets.ReadOnlyModelViewSet):
    serializer_class = ActivityLogSerializer

    def get_queryset(self):
        user = self.request.user
        queryset = (
            ActivityLog.objects.select_related("deal", "user")
            .all()
            .order_by("-created_at")
        )

        # Администраторы видят все логи активности
        is_admin = UserRole.objects.filter(user=user, role__name="Admin").exists()

        if not is_admin:
            # Остальные видят только логи для своих сделок (где user = seller или executor)
            queryset = queryset.filter(Q(deal__seller=user) | Q(deal__executor=user))

        deal_id = self.request.query_params.get("deal")
        if deal_id:
            queryset = queryset.filter(deal_id=deal_id)
        return queryset
