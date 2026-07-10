"""FilterSets for Tasks app"""

import django_filters

from .models import Task


class TaskFilterSet(django_filters.FilterSet):
    """
    FilterSet for Task model.

    Supports filtering by:
    - status: Task status (todo, in_progress, done)
    - priority: Task priority (low, medium, high)
    - deal: Associated deal

    Also supports ordering by priority, due_at and created_at.
    """

    status = django_filters.ChoiceFilter(
        field_name="status", choices=Task.TaskStatus.choices, label="Task Status"
    )

    priority = django_filters.ChoiceFilter(
        field_name="priority", choices=Task.PriorityChoices.choices, label="Priority"
    )

    deal = django_filters.UUIDFilter(field_name="deal__id", label="Deal ID")

    active_only = django_filters.BooleanFilter(
        method="filter_active_only", label="Only active tasks"
    )

    ordering = django_filters.OrderingFilter(
        fields=(
            ("priority", "priority"),
            ("created_at", "created_at"),
            ("updated_at", "updated_at"),
            ("due_at", "due_at"),
        ),
        label="Sort by",
    )

    class Meta:
        model = Task
        fields = ("status", "priority", "deal", "active_only")

    def filter_active_only(self, queryset, name, value):
        if value:
            return queryset.filter(
                status__in=(
                    Task.TaskStatus.TODO,
                    Task.TaskStatus.IN_PROGRESS,
                    Task.TaskStatus.OVERDUE,
                )
            )
        return queryset
