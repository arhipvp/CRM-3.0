"""FilterSets for Deals app"""

import django_filters

from .models import Deal


class DealOrderingFilter(django_filters.OrderingFilter):
    """Keep a client's deals together when the list is ordered by a date."""

    client_grouped_fields = {"next_contact_date", "expected_close"}

    def filter(self, qs, value):
        if not value:
            return qs

        ordering = list(value)
        if len(ordering) == 1 and ordering[0].lstrip("-") in self.client_grouped_fields:
            return qs.order_by(
                *ordering,
                "client__name",
                "client_id",
                "-created_at",
                "id",
            )

        return super().filter(qs, value)


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

    source = django_filters.CharFilter(
        field_name="source", lookup_expr="icontains", label="Source (contains)"
    )

    expected_close = django_filters.DateFromToRangeFilter(
        field_name="expected_close", label="Expected Close (range)"
    )

    client = django_filters.UUIDFilter(field_name="client__id", label="Client ID")

    ordering = DealOrderingFilter(
        fields=(
            ("created_at", "created_at"),
            ("updated_at", "updated_at"),
            ("title", "title"),
            ("expected_close", "expected_close"),
            ("next_contact_date", "next_contact_date"),
            ("next_review_date", "next_review_date"),
        ),
        label="Sort by",
    )

    class Meta:
        model = Deal
        fields = (
            "status",
            "stage_name",
            "seller",
            "executor",
            "client",
            "source",
            "expected_close",
        )
