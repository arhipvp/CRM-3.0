"""FilterSets for Deals app"""

import django_filters

from .models import Deal


class DealFilterSet(django_filters.FilterSet):
    """
    FilterSet for Deal model.

    Supports filtering by:
    - status: Deal status (open, won, lost, on_hold)
    - stage_name: Current stage of the deal
    - seller: User who is selling the deal
    - executor: User who is executing the deal
    - client_id: Associated client

    Also supports search by title and description.
    """

    status = django_filters.CharFilter(
        field_name="status", lookup_expr="icontains", label="Deal Status (contains)"
    )

    stage_name = django_filters.CharFilter(
        field_name="stage_name", lookup_expr="icontains", label="Stage Name (contains)"
    )

    seller = django_filters.NumberFilter(field_name="seller__id", label="Seller ID")

    executor = django_filters.NumberFilter(
        field_name="executor__id", label="Executor ID"
    )

    client = django_filters.NumberFilter(field_name="client__id", label="Client ID")

    ordering = django_filters.OrderingFilter(
        fields=(
            ("created_at", "created_at"),
            ("updated_at", "updated_at"),
            ("title", "title"),
            ("expected_close", "expected_close"),
        ),
        label="Sort by",
    )

    class Meta:
        model = Deal
        fields = ("status", "stage_name", "seller", "executor", "client")
