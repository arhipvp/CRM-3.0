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
        # Фильтруем только активные записи (deleted_at IS NULL)
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
            action = self.restore_deleted
            actions["restore_deleted"] = (
                action,
                action.__name__,
                getattr(action, "short_description", action.__doc__),
            )
        return actions

    def changelist_view(self, request, extra_context=None):
        """Добавляем фильтр для показа удалённых объектов."""
        if request.GET.get("show_deleted") == "true":
            # Показываем только удалённые
            self.get_queryset = (
                lambda r: super(SoftDeleteAdmin, self)
                .get_queryset(r)
                .filter(deleted_at__isnull=False)
            )

        if extra_context is None:
            extra_context = {}

        # Показываем кол-во удалённых объектов
        deleted_count = (
            super().get_queryset(request).filter(deleted_at__isnull=False).count()
        )
        extra_context["show_deleted_count"] = deleted_count

        return super().changelist_view(request, extra_context)


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
