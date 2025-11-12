"""FilterSets for Clients app"""

import django_filters

from .models import Client


class ClientFilterSet(django_filters.FilterSet):
    """
    FilterSet for Client model.

    Supports filtering by:
    - name: Client name (partial match, case-insensitive)
    - phone: Client phone number (partial match)

    Also supports ordering by name and created_at.
    """

    name = django_filters.CharFilter(
        field_name="name", lookup_expr="icontains", label="Name (contains)"
    )

    phone = django_filters.CharFilter(
        field_name="phone", lookup_expr="icontains", label="Phone (contains)"
    )

    ordering = django_filters.OrderingFilter(
        fields=(
            ("created_at", "created_at"),
            ("updated_at", "updated_at"),
            ("name", "name"),
        ),
        label="Sort by",
    )

    class Meta:
        model = Client
        fields = ("name", "phone")
