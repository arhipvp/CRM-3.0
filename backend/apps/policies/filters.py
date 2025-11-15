"""FilterSets for Policies app"""

import django_filters

from .models import Policy


class PolicyFilterSet(django_filters.FilterSet):
    """
    FilterSet for Policy model.

    Supports filtering by:
    - insurance_type: Type of insurance (auto, health, life, property, etc.)
    - status: Policy status (active, expired, cancelled)
    - deal: Associated deal

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

    status = django_filters.CharFilter(
        field_name="status", lookup_expr="icontains", label="Policy Status (contains)"
    )

    deal = django_filters.NumberFilter(field_name="deal__id", label="Deal ID")

    ordering = django_filters.OrderingFilter(
        fields=(
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
        fields = ("insurance_company", "insurance_type", "status", "deal", "is_vehicle")
