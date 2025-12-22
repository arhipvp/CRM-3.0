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

    Also supports ordering by due_at and created_at.
    """

    status = django_filters.ChoiceFilter(
        field_name="status", choices=Task.TaskStatus.choices, label="Task Status"
    )

    priority = django_filters.ChoiceFilter(
        field_name="priority", choices=Task.PriorityChoices.choices, label="Priority"
    )

    deal = django_filters.UUIDFilter(field_name="deal__id", label="Deal ID")

    ordering = django_filters.OrderingFilter(
        fields=(
            ("created_at", "created_at"),
            ("updated_at", "updated_at"),
            ("due_at", "due_at"),
        ),
        label="Sort by",
    )

    class Meta:
        model = Task
        fields = ("status", "priority", "deal")
