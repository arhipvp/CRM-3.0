"""FilterSets for Policies app"""

import django_filters
from django.db.models import Q

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
        )

    def filter_unpaid(self, queryset, name, value):
        if not value:
            return queryset
        unpaid_query = Q(
            payments__deleted_at__isnull=True,
            payments__actual_date__isnull=True,
        ) | Q(
            payments__deleted_at__isnull=True,
            payments__financial_records__deleted_at__isnull=True,
            payments__financial_records__date__isnull=True,
        )
        return queryset.filter(unpaid_query).distinct()
