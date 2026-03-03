from django.contrib import admin
from django.utils.html import format_html
from import_export.admin import ImportExportModelAdmin


class CRMAdminUXMixin:
    """Общие UX-настройки и утилиты для Django Admin."""

    list_per_page = 50
    save_on_top = True
    preserve_filters = True

    @staticmethod
    def render_badge(
        text: str,
        *,
        bg_color: str = "#eef2ff",
        fg_color: str = "#1f2937",
        bold: bool = False,
    ) -> str:
        weight = "700" if bold else "500"
        return format_html(
            '<span style="background-color: {}; color: {}; padding: 3px 8px; '
            'border-radius: 999px; font-weight: {};">{}</span>',
            bg_color,
            fg_color,
            weight,
            text,
        )

    @admin.action(description="Восстановить выбранные записи")
    def restore_selected(self, request, queryset):
        restored = 0
        for obj in queryset.filter(deleted_at__isnull=False):
            obj.restore()
            restored += 1
        self.message_user(request, f"Восстановлено {restored} записей")

    def _supports_soft_delete(self) -> bool:
        return hasattr(self.model, "objects") and hasattr(self.model.objects, "dead")

    def get_actions(self, request):
        actions = super().get_actions(request)
        if self._supports_soft_delete() and self.model.objects.dead().exists():
            actions["restore_selected"] = (
                self.__class__.restore_selected,
                "restore_selected",
                "Восстановить выбранные записи",
            )
        return actions


class ShowDeletedFilter(admin.SimpleListFilter):
    title = "Показать удалённые"
    parameter_name = "show_deleted"

    def lookups(self, request, model_admin):
        return (
            ("false", "Скрыть удалённые"),
            ("true", "Показать удалённые"),
        )

    def queryset(self, request, queryset):
        return queryset


class SoftDeleteAdmin(CRMAdminUXMixin, admin.ModelAdmin):
    """
    Базовый админ-класс для моделей с мягким удалением (SoftDeleteModel).
    Обеспечивает поддержку восстановления удалённых объектов и фильтрацию.
    """

    def get_list_filter(self, request):
        """Гарантируем наличие фильтра 'Показать удалённые' в списке фильтров."""
        base_filters = super().get_list_filter(request)
        normalized = []
        if base_filters:
            if isinstance(base_filters, (tuple, list)):
                normalized.extend(base_filters)
            else:
                normalized.append(base_filters)
        if ShowDeletedFilter not in normalized:
            normalized.insert(0, ShowDeletedFilter)
        return tuple(normalized)

    def get_queryset(self, request):
        """По умолчанию показываем только активные объекты."""
        qs = super().get_queryset(request)
        if request.GET.get("show_deleted") == "true":
            return self.model.objects.with_deleted()
        return qs.filter(deleted_at__isnull=True)

    def delete_model(self, request, obj):
        """Переопределяем удаление на мягкое удаление."""
        obj.delete()  # Вызывает SoftDeleteModel.delete()

    def delete_queryset(self, request, queryset):
        """Переопределяем групповое удаление на мягкое удаление."""
        for obj in queryset:
            obj.delete()

    def changelist_view(self, request, extra_context=None):
        """Передаём в шаблон метрики по удалённым объектам."""
        if extra_context is None:
            extra_context = {}

        deleted_count = self.model.objects.dead().count()
        extra_context["show_deleted_count"] = deleted_count
        extra_context["show_deleted"] = request.GET.get("show_deleted") == "true"

        return super().changelist_view(request, extra_context)


class SoftDeleteImportExportAdmin(SoftDeleteAdmin, ImportExportModelAdmin):
    """
    Комбинированный админ-класс для моделей с мягким удалением и импортом/экспорта.
    Обеспечивает фильтрацию удалённых объектов И функциональность импорта/экспорта.
    """

    pass


class SoftDeleteInline(admin.TabularInline):
    """
    Базовый inline класс для моделей с мягким удалением.
    """

    def get_queryset(self, request):
        """По умолчанию показываем только активные объекты."""
        qs = super().get_queryset(request)
        return qs.filter(deleted_at__isnull=True)
