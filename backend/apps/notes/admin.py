from apps.common.admin import SoftDeleteImportExportAdmin
from django.contrib import admin
from import_export import resources

from .models import Note

# ============ IMPORT/EXPORT RESOURCES ============


class NoteResource(resources.ModelResource):
    class Meta:
        model = Note
        fields = (
            "id",
            "deal",
            "author_name",
            "body",
            "created_at",
            "updated_at",
            "deleted_at",
        )
        export_order = (
            "id",
            "deal",
            "author_name",
            "body",
            "created_at",
            "updated_at",
            "deleted_at",
        )


# ============ MODEL ADMINS ============


@admin.register(Note)
class NoteAdmin(SoftDeleteImportExportAdmin):
    resource_class = NoteResource

    list_display = ("deal", "author_name", "body_preview", "status_badge", "created_at")
    search_fields = ("deal__title", "author_name", "body")
    list_filter = ("created_at", "deleted_at")
    list_select_related = ("deal",)
    readonly_fields = ("id", "created_at", "updated_at", "deleted_at")
    ordering = ("-created_at",)
    date_hierarchy = "created_at"

    fieldsets = (
        ("Основная информация", {"fields": ("id", "deal", "author_name")}),
        ("Содержание", {"fields": ("body",)}),
        ("Статус удаления", {"fields": ("deleted_at",)}),
        ("Время", {"fields": ("created_at", "updated_at"), "classes": ("collapse",)}),
    )

    @admin.display(description="Содержание")
    def body_preview(self, obj):
        """Показывает сокращённый текст заметки."""
        return (obj.body[:80] + "...") if len(obj.body) > 80 else obj.body

    @admin.display(description="Статус")
    def status_badge(self, obj):
        if obj.deleted_at:
            return self.render_badge(
                "Удалена",
                bg_color="#fee2e2",
                fg_color="#b91c1c",
                bold=True,
            )
        return self.render_badge(
            "Активна",
            bg_color="#dcfce7",
            fg_color="#166534",
            bold=True,
        )
