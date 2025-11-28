from django.contrib import admin
from django.utils.html import format_html
from import_export import resources

from apps.common.admin import SoftDeleteImportExportAdmin

from .models import Client

# ============ IMPORT/EXPORT RESOURCES ============


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
        export_order = (
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


# ============ MODEL ADMINS ============


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
    actions = ["restore_clients"]

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

    def deals_count(self, obj):
        count = obj.deals.filter(deleted_at__isnull=True).count()
        url = f"/admin/deals/deal/?client__id__exact={obj.id}"
        return format_html('<a href="{}">{} сделок</a>', url, count)

    deals_count.short_description = "Сделки"

    def deals_count_display(self, obj):
        count = obj.deals.filter(deleted_at__isnull=True).count()
        return f"{count} активных сделок"

    deals_count_display.short_description = "Сделки"

    def short_notes(self, obj):
        if not obj.notes:
            return "—"
        return (obj.notes[:40] + "…") if len(obj.notes) > 40 else obj.notes

    short_notes.short_description = "Примечание"

    def status_badge(self, obj):
        if obj.deleted_at:
            return format_html(
                '<span style="background-color: #ffcccc; padding: 3px 8px; border-radius: 3px; color: #cc0000;">Удалён</span>'
            )
        return format_html(
            '<span style="background-color: #ccffcc; padding: 3px 8px; border-radius: 3px; color: #00cc00;">Активен</span>'
        )

    status_badge.short_description = "Статус"

    def restore_clients(self, request, queryset):
        restored = 0
        for client in queryset.filter(deleted_at__isnull=False):
            client.restore()
            restored += 1
        self.message_user(request, f"Восстановлено {restored} клиентов")

    restore_clients.short_description = "✓ Восстановить выбранных клиентов"
