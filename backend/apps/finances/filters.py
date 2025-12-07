"""FilterSets for Finances app"""

import django_filters

from .models import Payment


class PaymentFilterSet(django_filters.FilterSet):
    """
    FilterSet for Payment model.

    Supports filtering by:
    - deal: Associated deal
    - policy: Associated policy
    - paid: Whether the payment has been marked as paid

    Also supports ordering by scheduled_date and created_at.
    """

    deal = django_filters.NumberFilter(field_name="deal__id", label="Deal ID")

    policy = django_filters.NumberFilter(field_name="policy__id", label="Policy ID")

    paid = django_filters.BooleanFilter(
        method="filter_paid",
        label="Paid status",
        widget=django_filters.widgets.BooleanWidget,
    )

    ordering = django_filters.OrderingFilter(
        fields=(
            ("created_at", "created_at"),
            ("updated_at", "updated_at"),
            ("scheduled_date", "scheduled_date"),
            ("actual_date", "actual_date"),
            ("amount", "amount"),
        ),
        label="Sort by",
    )

    class Meta:
        model = Payment
        fields = ("deal", "policy")

    def filter_paid(self, queryset, _, value):
        if value:
            return queryset.filter(actual_date__isnull=False)
        return queryset.filter(actual_date__isnull=True)
