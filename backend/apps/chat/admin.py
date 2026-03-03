from apps.common.admin import SoftDeleteImportExportAdmin
from django.contrib import admin
from django.utils.html import format_html
from import_export import resources

from .models import ChatMessage

# ========= IMPORT/EXPORT RESOURCES =========


class ChatMessageResource(resources.ModelResource):
    class Meta:
        model = ChatMessage
        fields = (
            "id",
            "deal",
            "author_name",
            "author",
            "body",
            "created_at",
            "updated_at",
            "deleted_at",
        )
        export_order = (
            "id",
            "deal",
            "author_name",
            "author",
            "body",
            "created_at",
            "updated_at",
            "deleted_at",
        )


# ============ MODEL ADMINS ============


@admin.register(ChatMessage)
class ChatMessageAdmin(SoftDeleteImportExportAdmin):
    resource_class = ChatMessageResource

    list_display = (
        "author_display",
        "deal",
        "body_preview",
        "status_badge",
        "created_at",
    )
    list_filter = ("created_at", "deleted_at", "deal")
    search_fields = ("author_name", "author__username", "body", "deal__title")
    list_select_related = ("deal", "author")
    readonly_fields = ("id", "created_at", "updated_at", "deleted_at")
    ordering = ("-created_at",)
    date_hierarchy = "created_at"

    fieldsets = (
        ("Сообщение", {"fields": ("id", "deal", "author_name", "author")}),
        ("Содержимое", {"fields": ("body",)}),
        ("Статус удаления", {"fields": ("deleted_at",)}),
        (
            "Временные метки",
            {"fields": ("created_at", "updated_at"), "classes": ("collapse",)},
        ),
    )

    @admin.display(description="Автор")
    def author_display(self, obj):
        if obj.author:
            return format_html("<strong>{}</strong>", obj.author.username)
        return format_html("<em>{}</em>", obj.author_name or "Неизвестно")

    @admin.display(description="Сообщение")
    def body_preview(self, obj):
        return (obj.body[:80] + "...") if len(obj.body) > 80 else obj.body

    @admin.display(description="Статус")
    def status_badge(self, obj):
        deleted = obj.deleted_at is not None
        label = "Удалено" if deleted else "Активно"
        color = "#cc0000" if deleted else "#00cc00"
        background = "#ffcccc" if deleted else "#ccffcc"
        return format_html(
            '<span style="background-color: {}; padding: 3px 8px; border-radius: 3px; color: {};">{}</span>',
            background,
            color,
            label,
        )
