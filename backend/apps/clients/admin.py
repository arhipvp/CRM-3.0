from apps.common.admin import SoftDeleteImportExportAdmin
from django.contrib import admin
from django.db.models import Count, Q
from django.utils.html import format_html
from import_export import resources

from .models import Client


class ClientResource(resources.ModelResource):
    class Meta:
        model = Client
        fields = (
            "id",
            "name",
            "phone",
            "email",
            "birth_date",
            "notes",
            "created_at",
            "updated_at",
            "deleted_at",
        )
        export_order = fields


@admin.register(Client)
class ClientAdmin(SoftDeleteImportExportAdmin):
    resource_class = ClientResource

    list_display = (
        "name",
        "phone",
        "email",
        "birth_date",
        "short_notes",
        "deals_count",
        "status_badge",
        "created_at",
    )
    search_fields = ("name", "phone", "email", "notes")
    list_filter = ("created_at", "updated_at", "deleted_at", "birth_date")
    readonly_fields = (
        "id",
        "created_at",
        "updated_at",
        "deleted_at",
        "deals_count_display",
    )
    ordering = ("-created_at",)
    date_hierarchy = "created_at"

    fieldsets = (
        (
            "Основные данные",
            {
                "fields": ("id", "name", "phone", "email", "birth_date", "notes"),
            },
        ),
        (
            "Сделки",
            {
                "fields": ("deals_count_display",),
                "classes": ("collapse",),
            },
        ),
        (
            "Статус",
            {
                "fields": ("deleted_at",),
            },
        ),
        (
            "Служебная информация",
            {
                "fields": ("created_at", "updated_at"),
                "classes": ("collapse",),
            },
        ),
    )

    def get_queryset(self, request):
        queryset = super().get_queryset(request)
        return queryset.annotate(
            active_deals_count=Count(
                "deals",
                filter=Q(deals__deleted_at__isnull=True),
                distinct=True,
            )
        )

    @admin.display(description="Сделки")
    def deals_count(self, obj):
        count = getattr(obj, "active_deals_count", 0)
        url = f"/admin/deals/deal/?client__id__exact={obj.id}"
        return format_html('<a href="{}">{} сделок</a>', url, count)

    @admin.display(description="Сделки")
    def deals_count_display(self, obj):
        count = getattr(obj, "active_deals_count", 0)
        return f"{count} активных сделок"

    @admin.display(description="Примечание")
    def short_notes(self, obj):
        if not obj.notes:
            return "—"
        return (obj.notes[:40] + "…") if len(obj.notes) > 40 else obj.notes

    @admin.display(description="Статус")
    def status_badge(self, obj):
        if obj.deleted_at:
            return self.render_badge(
                "Удалён",
                bg_color="#fee2e2",
                fg_color="#b91c1c",
                bold=True,
            )
        return self.render_badge(
            "Активен",
            bg_color="#dcfce7",
            fg_color="#166534",
            bold=True,
        )
