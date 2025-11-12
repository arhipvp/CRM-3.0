"""FilterSets for Finances app"""
import django_filters
from .models import Payment


class PaymentFilterSet(django_filters.FilterSet):
    """
    FilterSet for Payment model.

    Supports filtering by:
    - status: Payment status (planned, partial, paid)
    - deal: Associated deal
    - policy: Associated policy

    Also supports ordering by scheduled_date and created_at.
    """

    status = django_filters.ChoiceFilter(
        field_name='status',
        choices=Payment.PaymentStatus.choices,
        label='Payment Status'
    )

    deal = django_filters.NumberFilter(
        field_name='deal__id',
        label='Deal ID'
    )

    policy = django_filters.NumberFilter(
        field_name='policy__id',
        label='Policy ID'
    )

    ordering = django_filters.OrderingFilter(
        fields=(
            ('created_at', 'created_at'),
            ('updated_at', 'updated_at'),
            ('scheduled_date', 'scheduled_date'),
            ('actual_date', 'actual_date'),
            ('amount', 'amount'),
        ),
        label='Sort by'
    )

    class Meta:
        model = Payment
        fields = ('status', 'deal', 'policy')
