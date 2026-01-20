"""FilterSets for Policies app"""

import django_filters
from apps.finances.models import FinancialRecord, Payment
from django.db.models import Exists, OuterRef, Q

from .models import Policy


class PolicyFilterSet(django_filters.FilterSet):
    """
    FilterSet for Policy model.

    Supports filtering by:
    - insurance_type: Type of insurance (auto, health, life, property, etc.)
    - status: Policy status (active, expired, cancelled)
    - deal: Associated deal
    - sales_channel: Sales channel that brings revenue

    Also supports ordering by start_date and created_at.
    """

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

    status = django_filters.CharFilter(
        field_name="status", lookup_expr="icontains", label="Policy Status (contains)"
    )

    deal = django_filters.NumberFilter(field_name="deal__id", label="Deal ID")

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
            "deal",
            "is_vehicle",
            "sales_channel",
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
