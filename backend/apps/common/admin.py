from django.contrib import admin
from django.utils.translation import gettext_lazy as _
from import_export.admin import ImportExportModelAdmin

from .models import SoftDeleteModel


class SoftDeleteAdmin(admin.ModelAdmin):
    """
    Базовый админ-класс для моделей с мягким удалением (SoftDeleteModel).
    Обеспечивает поддержку восстановления удалённых объектов.
    """

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

    @admin.action(description=_("Восстановить удалённые объекты"))
    def restore_deleted(self, request, queryset):
        """Action для восстановления удалённых объектов."""
        restored_count = 0
        for obj in queryset:
            obj.restore()
            restored_count += 1
        self.message_user(request, _(f"{restored_count} объектов восстановлено."))

    def get_actions(self, request):
        """Добавляем action для восстановления удалённых объектов."""
        actions = super().get_actions(request)
        # Добавляем восстановление только если есть удалённые объекты
        if self.model.objects.dead().exists():
            action = self.__class__.restore_deleted
            actions["restore_deleted"] = (
                action,
                action.__name__,
                getattr(action, "short_description", action.__doc__),
            )
        return actions

    def changelist_view(self, request, extra_context=None):
        """Передаём в шаблон метрики по удалённым объектам."""
        if extra_context is None:
            extra_context = {}

        deleted_count = self.model.objects.dead().count()
        extra_context["show_deleted_count"] = deleted_count
        extra_context["show_deleted"] = request.GET.get("show_deleted") == "true"

        return super().changelist_view(request, extra_context)


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


class SoftDeleteImportExportAdmin(SoftDeleteAdmin, ImportExportModelAdmin):
    """
    Комбинированный админ-класс для моделей с мягким удалением и импортом/экспортом.
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
