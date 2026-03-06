from apps.common.admin import SoftDeleteImportExportAdmin
from django.contrib import admin
from import_export import resources

from .models import (
    Notification,
    NotificationSettings,
    TelegramDealRoutingSession,
    TelegramInboundMessage,
)

# ============ IMPORT/EXPORT RESOURCES ============


class NotificationResource(resources.ModelResource):
    class Meta:
        model = Notification
        fields = (
            "id",
            "user",
            "type",
            "payload",
            "is_read",
            "read_at",
            "created_at",
            "updated_at",
            "deleted_at",
        )
        export_order = (
            "id",
            "user",
            "type",
            "payload",
            "is_read",
            "read_at",
            "created_at",
            "updated_at",
            "deleted_at",
        )


# ============ MODEL ADMINS ============


@admin.register(Notification)
class NotificationAdmin(SoftDeleteImportExportAdmin):
    resource_class = NotificationResource

    list_display = ("user", "type", "read_badge", "read_at", "created_at")
    search_fields = ("user__username", "type")
    list_filter = ("is_read", "type", "created_at", "read_at")
    list_select_related = ("user",)
    readonly_fields = ("id", "created_at", "updated_at", "deleted_at")
    ordering = ("-created_at",)
    actions = ["mark_as_read", "mark_as_unread"]
    date_hierarchy = "created_at"
    list_per_page = 30
    show_full_result_count = False

    fieldsets = (
        ("Основная информация", {"fields": ("id", "user", "type")}),
        ("Данные", {"fields": ("payload",)}),
        ("Статус прочтения", {"fields": ("is_read", "read_at")}),
        ("Статус удаления", {"fields": ("deleted_at",)}),
        ("Время", {"fields": ("created_at", "updated_at"), "classes": ("collapse",)}),
    )

    @admin.display(description="Статус")
    def read_badge(self, obj):
        if obj.is_read:
            return self.render_badge(
                "Прочитано",
                bg_color="#dcfce7",
                fg_color="#166534",
                bold=True,
            )
        return self.render_badge(
            "Новое",
            bg_color="#fef9c3",
            fg_color="#854d0e",
            bold=True,
        )

    def mark_as_read(self, request, queryset):
        """Action для отметки уведомлений как прочитанные."""
        updated = 0
        for obj in queryset:
            obj.mark_as_read()
            updated += 1
        self.message_user(request, f"{updated} уведомлений отмечено как прочитанные")

    mark_as_read.short_description = "Отметить как прочитанные"

    def mark_as_unread(self, request, queryset):
        """Action для отметки уведомлений как непрочитанные."""
        updated = queryset.update(is_read=False, read_at=None)
        self.message_user(request, f"{updated} уведомлений отмечено как непрочитанные")

    mark_as_unread.short_description = "Отметить как непрочитанные"


@admin.register(NotificationSettings)
class NotificationSettingsAdmin(admin.ModelAdmin):
    list_display = (
        "user",
        "telegram_enabled",
        "next_contact_lead_days",
        "sber_login",
        "sber_credentials_configured",
    )
    search_fields = ("user__username", "user__email", "sber_login")
    list_filter = ("telegram_enabled",)
    list_select_related = ("user",)
    readonly_fields = ("sber_credentials_configured",)

    fieldsets = (
        (
            "Основное",
            {
                "fields": (
                    "user",
                    "telegram_enabled",
                    "next_contact_lead_days",
                    "notify_tasks",
                    "notify_deal_events",
                    "notify_deal_expected_close",
                    "notify_payment_due",
                    "notify_policy_expiry",
                    "remind_days",
                )
            },
        ),
        (
            "Сбер Страхование",
            {"fields": ("sber_login", "sber_credentials_configured")},
        ),
    )

    @admin.display(boolean=True, description="Sber пароль задан")
    def sber_credentials_configured(self, obj):
        return bool(obj.sber_password)


@admin.register(TelegramInboundMessage)
class TelegramInboundMessageAdmin(admin.ModelAdmin):
    list_display = (
        "id",
        "user",
        "chat_id",
        "message_id",
        "status",
        "linked_deal",
        "processed_at",
        "created_at",
    )
    list_filter = ("status", "processed_at", "created_at")
    search_fields = ("user__username", "chat_id", "message_id", "text")
    list_select_related = ("user", "linked_deal")
    readonly_fields = tuple(field.name for field in TelegramInboundMessage._meta.fields)
    ordering = ("-created_at",)
    date_hierarchy = "created_at"

    def has_add_permission(self, request):
        return False

    def has_delete_permission(self, request, obj=None):
        return False

    def has_change_permission(self, request, obj=None):
        return False


@admin.register(TelegramDealRoutingSession)
class TelegramDealRoutingSessionAdmin(admin.ModelAdmin):
    list_display = (
        "id",
        "user",
        "state",
        "batch_size",
        "selected_deal",
        "created_deal",
        "expires_at",
        "updated_at",
    )
    list_filter = ("state", "expires_at", "updated_at")
    search_fields = ("user__username",)
    list_select_related = ("user", "selected_deal", "created_deal")
    readonly_fields = tuple(
        field.name for field in TelegramDealRoutingSession._meta.fields
    )
    ordering = ("-created_at",)
    date_hierarchy = "updated_at"

    def has_add_permission(self, request):
        return False

    def has_delete_permission(self, request, obj=None):
        return False

    def has_change_permission(self, request, obj=None):
        return False

    @admin.display(description="Размер батча")
    def batch_size(self, obj):
        return len(obj.batch_message_ids or [])
