from django.contrib import admin
from django.utils.html import format_html

from .forms import ClientAdminForm
from .models import Client


@admin.register(Client)
class ClientAdmin(admin.ModelAdmin):
    form = ClientAdminForm
    list_display = ("name", "phone", "birth_date", "short_notes", "deals_count", "created_at")
    search_fields = ("name", "phone", "notes")
    list_filter = ("created_at", "updated_at")
    readonly_fields = ("id", "created_at", "updated_at", "deleted_at")
    ordering = ("-created_at",)

    fieldsets = (
        ("Основные данные", {
            "fields": ("name", "phone", "birth_date", "notes"),
        }),
        ("Служебная информация", {
            "fields": ("id", "created_at", "updated_at", "deleted_at"),
            "classes": ("collapse",),
        }),
    )

    def deals_count(self, obj):
        count = obj.deals.filter(deleted_at__isnull=True).count()
        url = f"/admin/deals/deal/?client__id__exact={obj.id}"
        return format_html('<a href="{}">{} сделок</a>', url, count)

    deals_count.short_description = "Сделки"

    def short_notes(self, obj):
        if not obj.notes:
            return "—"
        return (obj.notes[:40] + "…") if len(obj.notes) > 40 else obj.notes

    short_notes.short_description = "Примечание"
