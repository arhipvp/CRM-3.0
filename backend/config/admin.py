from datetime import timedelta

from django.contrib import admin as django_admin
from django.utils import timezone

admin_site = django_admin.site
_is_configured = False


def _build_operations_metrics():
    from apps.deals.models import Deal
    from apps.notifications.models import Notification
    from apps.policies.models import Policy
    from apps.tasks.models import Task

    today = timezone.now().date()
    in_14_days = today + timedelta(days=14)

    return {
        "overdue_tasks_count": Task.objects.filter(
            deleted_at__isnull=True,
            due_at__date__lt=today,
        )
        .exclude(status=Task.TaskStatus.DONE)
        .count(),
        "deals_without_next_contact_count": Deal.objects.filter(
            deleted_at__isnull=True,
            next_contact_date__isnull=True,
        ).count(),
        "policies_expired_count": Policy.objects.filter(
            deleted_at__isnull=True,
            end_date__lt=today,
        ).count(),
        "policies_expiring_soon_count": Policy.objects.filter(
            deleted_at__isnull=True,
            end_date__gte=today,
            end_date__lte=in_14_days,
        ).count(),
        "unread_notifications_count": Notification.objects.filter(
            deleted_at__isnull=True,
            is_read=False,
        ).count(),
    }


def _crm_each_context(request):
    original_each_context = admin_site._crm_original_each_context
    context = original_each_context(request)
    today = timezone.now().date()
    in_14_days = today + timedelta(days=14)
    context.update(_build_operations_metrics())
    context["admin_quick_links"] = [
        {
            "label": "Просроченные задачи",
            "url": "/admin/tasks/task/?status__exact=overdue",
        },
        {
            "label": "Сделки без следующего контакта",
            "url": "/admin/deals/deal/?next_contact_date__isnull=True",
        },
        {
            "label": "Истекающие полисы (14 дней)",
            "url": "/admin/policies/policy/?end_date__gte={}&end_date__lte={}".format(
                today.isoformat(),
                in_14_days.isoformat(),
            ),
        },
        {
            "label": "Непрочитанные уведомления",
            "url": "/admin/notifications/notification/?is_read__exact=0",
        },
    ]
    return context


def configure_admin_site():
    global _is_configured
    if _is_configured:
        return
    admin_site.index_template = "admin/index.html"
    admin_site._crm_original_each_context = admin_site.each_context
    admin_site.each_context = _crm_each_context
    _is_configured = True


__all__ = ("admin_site",)
