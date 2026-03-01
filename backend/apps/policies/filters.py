"""FilterSets for Policies app."""

import django_filters
from apps.finances.models import FinancialRecord, Payment
from django.db.models import Exists, OuterRef, Q
from django.utils import timezone

from .models import Policy
from .status import STATUS_VALUES, with_computed_status_flags


class PolicyFilterSet(django_filters.FilterSet):
    insurance_company = django_filters.CharFilter(
        field_name="insurance_company__name",
        lookup_expr="icontains",
        label="Insurance Company (contains)",
    )
    insurance_type = django_filters.CharFilter(
        field_name="insurance_type__name",
        lookup_expr="icontains",
        label="Insurance Type (contains)",
    )
    sales_channel = django_filters.CharFilter(
        field_name="sales_channel__name",
        lookup_expr="icontains",
        label="Sales Channel (contains)",
    )
    note = django_filters.CharFilter(
        field_name="note",
        lookup_expr="icontains",
        label="Policy note (contains)",
    )
    status = django_filters.CharFilter(
        field_name="status", lookup_expr="icontains", label="Policy Status (contains)"
    )
    computed_status = django_filters.CharFilter(
        method="filter_computed_status", label="Computed status"
    )
    deal = django_filters.UUIDFilter(field_name="deal__id", label="Deal ID")
    start_date_from = django_filters.DateFilter(
        field_name="start_date",
        lookup_expr="gte",
        label="Start date from",
    )
    start_date_to = django_filters.DateFilter(
        field_name="start_date",
        lookup_expr="lte",
        label="Start date to",
    )
    end_date_from = django_filters.DateFilter(
        field_name="end_date",
        lookup_expr="gte",
        label="End date from",
    )
    end_date_to = django_filters.DateFilter(
        field_name="end_date",
        lookup_expr="lte",
        label="End date to",
    )
    unpaid = django_filters.BooleanFilter(
        method="filter_unpaid", label="Unpaid policies"
    )
    unpaid_payments = django_filters.BooleanFilter(
        method="filter_unpaid_payments", label="Policies with unpaid payments"
    )
    unpaid_records = django_filters.BooleanFilter(
        method="filter_unpaid_records", label="Policies with unpaid records"
    )
    ordering = django_filters.OrderingFilter(
        fields=(
            ("number", "number"),
            ("client__name", "client"),
            ("created_at", "created_at"),
            ("updated_at", "updated_at"),
            ("start_date", "start_date"),
            ("end_date", "end_date"),
            ("note", "note"),
        ),
        label="Sort by",
    )
    is_vehicle = django_filters.BooleanFilter(
        field_name="is_vehicle", label="Vehicle policy"
    )

    class Meta:
        model = Policy
        fields = (
            "insurance_company",
            "insurance_type",
            "status",
            "computed_status",
            "deal",
            "is_vehicle",
            "sales_channel",
            "note",
            "start_date_from",
            "start_date_to",
            "end_date_from",
            "end_date_to",
            "unpaid",
            "unpaid_payments",
            "unpaid_records",
        )

    def _unpaid_payment_exists(self):
        return Payment.objects.filter(
            policy=OuterRef("pk"),
            deleted_at__isnull=True,
            actual_date__isnull=True,
        )

    def _unpaid_record_exists(self):
        return FinancialRecord.objects.filter(
            payment__policy=OuterRef("pk"),
            payment__deleted_at__isnull=True,
            deleted_at__isnull=True,
            date__isnull=True,
        )

    def filter_unpaid(self, queryset, name, value):
        if not value:
            return queryset
        return queryset.annotate(
            has_unpaid_payment=Exists(self._unpaid_payment_exists()),
            has_unpaid_record=Exists(self._unpaid_record_exists()),
        ).filter(Q(has_unpaid_payment=True) | Q(has_unpaid_record=True))

    def filter_unpaid_payments(self, queryset, name, value):
        if not value:
            return queryset
        return queryset.annotate(
            has_unpaid_payment=Exists(self._unpaid_payment_exists())
        ).filter(has_unpaid_payment=True)

    def filter_unpaid_records(self, queryset, name, value):
        if not value:
            return queryset
        return queryset.annotate(
            has_unpaid_record=Exists(self._unpaid_record_exists())
        ).filter(has_unpaid_record=True)

    def filter_computed_status(self, queryset, name, value):
        normalized = (value or "").strip().lower()
        if not normalized:
            return queryset
        queryset = with_computed_status_flags(queryset)
        today = timezone.localdate()
        if normalized == STATUS_VALUES.PROBLEM:
            return queryset.filter(has_unpaid_record=True)
        if normalized == STATUS_VALUES.DUE:
            return queryset.filter(has_unpaid_record=False, has_unpaid_payment=True)
        if normalized == STATUS_VALUES.EXPIRED:
            return queryset.filter(
                has_unpaid_record=False,
                has_unpaid_payment=False,
                end_date__isnull=False,
                end_date__lt=today,
            )
        if normalized == STATUS_VALUES.ACTIVE:
            return queryset.filter(
                has_unpaid_record=False,
                has_unpaid_payment=False,
            ).filter(Q(end_date__isnull=True) | Q(end_date__gte=today))
        return queryset.none()
