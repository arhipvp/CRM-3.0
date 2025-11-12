from django.contrib.admin import AdminSite
from django.utils.translation import gettext_lazy as _


class CRMAdminSite(AdminSite):
    """
    Кастомный AdminSite для CRM 3.0 с русским интерфейсом и кастомизацией.
    """

    site_header = _("CRM 3.0 Администрация")
    site_title = _("CRM Admin")
    index_title = _("Добро пожаловать в админку CRM 3.0")

    def index(self, request, extra_context=None):
        """
        Переопределяем главную страницу админки для добавления статистики.
        """
        extra_context = extra_context or {}

        # Подсчитываем статистику по основным моделям
        try:
            from apps.clients.models import Client
            from apps.deals.models import Deal
            from apps.payments.models import Payment
            from apps.tasks.models import Task

            extra_context.update(
                {
                    "total_clients": Client.objects.filter(
                        deleted_at__isnull=True
                    ).count(),
                    "total_deals": Deal.objects.filter(deleted_at__isnull=True).count(),
                    "open_deals": Deal.objects.filter(
                        status="open", deleted_at__isnull=True
                    ).count(),
                    "total_tasks": Task.objects.filter(deleted_at__isnull=True).count(),
                    "pending_tasks": Task.objects.filter(
                        status="pending", deleted_at__isnull=True
                    ).count(),
                    "total_payments": Payment.objects.filter(
                        deleted_at__isnull=True
                    ).count(),
                    "unpaid_payments": Payment.objects.filter(
                        status__in=["pending", "scheduled"], deleted_at__isnull=True
                    ).count(),
                }
            )
        except Exception:
            pass

        return super().index(request, extra_context)


# Создаём кастомный AdminSite
admin_site = CRMAdminSite(name="crm_admin")
