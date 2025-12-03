from django.contrib import admin
from django.utils.html import format_html
from import_export import resources
from apps.common.admin import SoftDeleteImportExportAdmin

from .models import Document

# ============ IMPORT/EXPORT RESOURCES ============


class DocumentResource(resources.ModelResource):
    class Meta:
        model = Document
        fields = (
            "id",
            "title",
            "deal",
            "owner",
            "doc_type",
            "file",
            "file_size",
            "mime_type",
            "status",
            "checksum",
            "created_at",
            "updated_at",
            "deleted_at",
        )
        export_order = (
            "id",
            "title",
            "deal",
            "owner",
            "doc_type",
            "file",
            "file_size",
            "mime_type",
            "status",
            "checksum",
            "created_at",
            "updated_at",
            "deleted_at",
        )


# ============ MODEL ADMINS ============


@admin.register(Document)
class DocumentAdmin(SoftDeleteImportExportAdmin):
    resource_class = DocumentResource

    list_display = (
        "title",
        "doc_type",
        "owner",
        "deal",
        "file_size_display",
        "status_badge",
        "created_at",
    )
    search_fields = ("title", "doc_type", "owner__username", "deal__title")
    list_filter = ("doc_type", "status", "created_at", "deleted_at", "mime_type")
    readonly_fields = (
        "id",
        "created_at",
        "updated_at",
        "deleted_at",
        "checksum",
        "file_size_display",
    )
    ordering = ("-created_at",)
    actions = ["restore_documents"]

    fieldsets = (
        ("Основная информация", {"fields": ("id", "title", "deal")}),
        ("Тип и статус", {"fields": ("doc_type", "status")}),
        ("Файл", {"fields": ("file", "file_size_display", "mime_type", "checksum")}),
        ("Владелец", {"fields": ("owner",)}),
        ("Статус удаления", {"fields": ("deleted_at",)}),
        ("Время", {"fields": ("created_at", "updated_at"), "classes": ("collapse",)}),
    )

    def file_size_display(self, obj):
        if obj.file_size:
            kb = obj.file_size / 1024
            if kb > 1024:
                return f"{kb / 1024:.2f} MB"
            return f"{kb:.2f} KB"
        return "—"

    file_size_display.short_description = "Размер"

    def status_badge(self, obj):
        colors = {
            "pending": "#ffbe0b",
            "completed": "#06ffa5",
            "error": "#ff006e",
        }
        color = colors.get(obj.status, "#999999")
        return format_html(
            '<span style="background-color: {}; color: white; padding: 3px 8px; border-radius: 3px;">{}</span>',
            color,
            obj.get_status_display(),
        )

    status_badge.short_description = "Статус"

    def restore_documents(self, request, queryset):
        restored = 0
        for doc in queryset.filter(deleted_at__isnull=False):
            doc.restore()
            restored += 1
        self.message_user(request, f"Восстановлено {restored} документов")

    restore_documents.short_description = "✓ Восстановить выбранные документы"
