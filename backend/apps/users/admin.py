from django.contrib import admin
from django.contrib.auth.admin import UserAdmin as DjangoUserAdmin
from django.utils.html import format_html
from import_export import resources
from import_export.admin import ImportExportModelAdmin

from .models import AuditLog, Permission, Role, RolePermission, UserRole

# ============ IMPORT/EXPORT RESOURCES ============


class RoleResource(resources.ModelResource):
    class Meta:
        model = Role
        fields = ("id", "name", "description", "created_at", "updated_at", "deleted_at")
        export_order = (
            "id",
            "name",
            "description",
            "created_at",
            "updated_at",
            "deleted_at",
        )


class PermissionResource(resources.ModelResource):
    class Meta:
        model = Permission
        fields = ("id", "resource", "action", "created_at", "updated_at", "deleted_at")
        export_order = (
            "id",
            "resource",
            "action",
            "created_at",
            "updated_at",
            "deleted_at",
        )


class UserRoleResource(resources.ModelResource):
    class Meta:
        model = UserRole
        fields = ("id", "user", "role", "created_at")
        export_order = ("id", "user", "role", "created_at")


class AuditLogResource(resources.ModelResource):
    class Meta:
        model = AuditLog
        fields = (
            "id",
            "actor",
            "object_type",
            "object_id",
            "object_name",
            "action",
            "description",
            "created_at",
        )
        export_order = (
            "id",
            "actor",
            "object_type",
            "object_id",
            "object_name",
            "action",
            "description",
            "created_at",
        )


# ============ INLINE ADMINS ============


class RolePermissionInline(admin.TabularInline):
    model = RolePermission
    extra = 1
    fields = ("permission", "created_at")
    readonly_fields = ("created_at",)


class UserRoleInline(admin.TabularInline):
    model = UserRole
    extra = 1
    fields = ("role", "created_at")
    readonly_fields = ("created_at",)


# ============ MODEL ADMINS ============


@admin.register(Role)
class RoleAdmin(ImportExportModelAdmin):
    resource_class = RoleResource

    list_display = [
        "name",
        "permissions_count",
        "users_count",
        "status_badge",
        "created_at",
    ]
    list_filter = ("created_at", "deleted_at")
    search_fields = ("name", "description")
    readonly_fields = ("id", "created_at", "updated_at", "deleted_at")

    fieldsets = (
        ("Основное", {"fields": ("id", "name", "description")}),
        ("Статус", {"fields": ("deleted_at",)}),
        ("Время", {"fields": ("created_at", "updated_at"), "classes": ("collapse",)}),
    )

    inlines = [RolePermissionInline]

    actions = ["restore_roles"]

    def permissions_count(self, obj):
        count = obj.permissions.count()
        return format_html("<strong>{}</strong>", count)

    permissions_count.short_description = "Прав"

    def users_count(self, obj):
        count = obj.users.count()
        return format_html("<strong>{}</strong>", count)

    users_count.short_description = "Пользователей"

    def status_badge(self, obj):
        if obj.deleted_at:
            return format_html(
                '<span style="background-color: #ffcccc; padding: 3px 8px; border-radius: 3px; color: #cc0000;">Удалена</span>'
            )
        return format_html(
            '<span style="background-color: #ccffcc; padding: 3px 8px; border-radius: 3px; color: #00cc00;">Активна</span>'
        )

    status_badge.short_description = "Статус"

    def restore_roles(self, request, queryset):
        restored = 0
        for role in queryset.filter(deleted_at__isnull=False):
            role.restore()
            restored += 1
        self.message_user(request, f"Восстановлено {restored} ролей")

    restore_roles.short_description = "✓ Восстановить выбранные роли"


@admin.register(Permission)
class PermissionAdmin(ImportExportModelAdmin):
    resource_class = PermissionResource

    list_display = [
        "resource_display",
        "action_display",
        "roles_count",
        "status_badge",
        "created_at",
    ]
    list_filter = ("resource", "action", "created_at", "deleted_at")
    search_fields = ("resource", "action")
    readonly_fields = ("id", "created_at", "updated_at", "deleted_at")

    fieldsets = (
        ("Право", {"fields": ("id", "resource", "action")}),
        ("Статус", {"fields": ("deleted_at",)}),
        ("Время", {"fields": ("created_at", "updated_at"), "classes": ("collapse",)}),
    )

    actions = ["restore_permissions"]

    def resource_display(self, obj):
        return obj.get_resource_display()

    resource_display.short_description = "Ресурс"

    def action_display(self, obj):
        return obj.get_action_display()

    action_display.short_description = "Действие"

    def roles_count(self, obj):
        count = obj.roles.count()
        return format_html("<strong>{}</strong>", count)

    roles_count.short_description = "Ролей"

    def status_badge(self, obj):
        if obj.deleted_at:
            return format_html(
                '<span style="background-color: #ffcccc; padding: 3px 8px; border-radius: 3px; color: #cc0000;">Удалено</span>'
            )
        return format_html(
            '<span style="background-color: #ccffcc; padding: 3px 8px; border-radius: 3px; color: #00cc00;">Активно</span>'
        )

    status_badge.short_description = "Статус"

    def restore_permissions(self, request, queryset):
        restored = 0
        for perm in queryset.filter(deleted_at__isnull=False):
            perm.restore()
            restored += 1
        self.message_user(request, f"Восстановлено {restored} прав")

    restore_permissions.short_description = "✓ Восстановить выбранные права"


@admin.register(UserRole)
class UserRoleAdmin(ImportExportModelAdmin):
    resource_class = UserRoleResource

    list_display = ["user", "role", "created_at"]
    list_filter = ("role", "created_at")
    search_fields = ("user__username", "role__name")
    readonly_fields = ("created_at",)

    fieldsets = (
        ("Назначение роли", {"fields": ("user", "role")}),
        ("Время", {"fields": ("created_at",)}),
    )


@admin.register(RolePermission)
class RolePermissionAdmin(admin.ModelAdmin):
    list_display = ["role", "permission_display", "created_at"]
    list_filter = ("role", "permission__resource", "permission__action", "created_at")
    search_fields = ("role__name", "permission__resource", "permission__action")
    readonly_fields = ("created_at",)

    fieldsets = (
        ("Связь", {"fields": ("role", "permission")}),
        ("Время", {"fields": ("created_at",)}),
    )

    def permission_display(self, obj):
        return str(obj.permission)

    permission_display.short_description = "Право"


@admin.register(AuditLog)
class AuditLogAdmin(admin.ModelAdmin):
    resource_class = AuditLogResource

    list_display = [
        "object_type_badge",
        "object_name",
        "action_badge",
        "actor_display",
        "created_at",
    ]
    list_filter = ("object_type", "action", "created_at", "actor")
    search_fields = ("object_name", "description", "actor__username")
    readonly_fields = (
        "id",
        "actor",
        "object_type",
        "object_id",
        "object_name",
        "action",
        "description",
        "old_value",
        "new_value",
        "created_at",
    )

    fieldsets = (
        ("Событие", {"fields": ("id", "object_type", "object_id", "object_name")}),
        ("Действие", {"fields": ("action", "actor", "description")}),
        ("Изменения", {"fields": ("old_value", "new_value"), "classes": ("collapse",)}),
        ("Время", {"fields": ("created_at",)}),
    )

    def has_add_permission(self, request):
        return False

    def has_delete_permission(self, request, obj=None):
        return False

    def has_change_permission(self, request, obj=None):
        return False

    def object_type_badge(self, obj):
        colors = {
            "role": "#667eea",
            "permission": "#764ba2",
            "user_role": "#f093fb",
            "role_permission": "#c649c0",
            "client": "#2e86de",
            "deal": "#1e90ff",
            "task": "#3a86ff",
            "document": "#8338ec",
            "payment": "#ff006e",
            "policy": "#ffbe0b",
            "note": "#06ffa5",
            "financial_record": "#05ffa1",
            "notification": "#fb5607",
            "user": "#ffbe0b",
        }
        color = colors.get(obj.object_type, "#999999")
        return format_html(
            '<span style="background-color: {}; color: white; padding: 3px 8px; border-radius: 3px; font-weight: bold;">{}</span>',
            color,
            obj.get_object_type_display(),
        )

    object_type_badge.short_description = "Тип"

    def action_badge(self, obj):
        colors = {
            "create": "#ccffcc",
            "update": "#ffffcc",
            "delete": "#ffcccc",
            "assign": "#ccecff",
            "revoke": "#ffccec",
        }
        text_colors = {
            "create": "#00cc00",
            "update": "#ccaa00",
            "delete": "#cc0000",
            "assign": "#0099cc",
            "revoke": "#cc0099",
        }
        color = colors.get(obj.action, "#cccccc")
        text_color = text_colors.get(obj.action, "#000000")
        return format_html(
            '<span style="background-color: {}; color: {}; padding: 3px 8px; border-radius: 3px; font-weight: bold;">{}</span>',
            color,
            text_color,
            obj.get_action_display(),
        )

    action_badge.short_description = "Действие"

    def actor_display(self, obj):
        if obj.actor:
            return format_html("<strong>{}</strong>", obj.actor.username)
        return format_html("<em>Система</em>")

    actor_display.short_description = "Кто"


# ============ DJANGO USER ADMIN CUSTOMIZATION ============


class CustomUserAdmin(DjangoUserAdmin):
    list_display = [
        "username",
        "email",
        "roles_display",
        "is_staff",
        "is_active",
        "last_login",
    ]
    readonly_fields = ("last_login", "date_joined")
    inlines = [UserRoleInline]

    fieldsets = (
        ("Учётные данные", {"fields": ("username", "password")}),
        ("Личная информация", {"fields": ("first_name", "last_name", "email")}),
        (
            "Разрешения",
            {
                "fields": ("is_active", "is_staff", "is_superuser", "groups"),
                "classes": ("collapse",),
            },
        ),
        ("Время", {"fields": ("last_login", "date_joined"), "classes": ("collapse",)}),
    )

    def roles_display(self, obj):
        roles = obj.user_roles.all()
        if roles:
            role_names = ", ".join(
                [
                    f'<span style="background-color: #667eea; color: white; padding: 2px 6px; border-radius: 3px; margin: 2px;">{role.role.name}</span>'
                    for role in roles
                ]
            )
            return format_html(role_names)
        return format_html("<em>Нет ролей</em>")

    roles_display.short_description = "Роли"


# ============ UNREGISTER DEFAULT USER ADMIN AND REGISTER CUSTOM ONE ============

try:
    from django.contrib.auth.models import User

    admin.site.unregister(User)
except:
    pass

from django.contrib.auth.models import User

admin.site.register(User, CustomUserAdmin)


# ============ ADMIN SITE CUSTOMIZATION ============

admin.site.site_header = "CRM 3.0 - Администрирование"
admin.site.site_title = "CRM 3.0 Admin"
admin.site.index_title = "Добро пожаловать в администрирование CRM 3.0"
