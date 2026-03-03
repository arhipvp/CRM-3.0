from apps.common.admin import SoftDeleteImportExportAdmin
from django.contrib import admin
from django.contrib.admin.sites import NotRegistered
from django.contrib.auth.admin import UserAdmin as DjangoUserAdmin
from django.contrib.auth.models import User
from django.db.models import Count
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
class RoleAdmin(SoftDeleteImportExportAdmin):
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

    def get_queryset(self, request):
        queryset = super().get_queryset(request)
        return queryset.annotate(
            permissions_total=Count("permissions", distinct=True),
            users_total=Count("users", distinct=True),
        )

    @admin.display(description="Прав")
    def permissions_count(self, obj):
        count = getattr(obj, "permissions_total", 0)
        return format_html("<strong>{}</strong>", count)

    @admin.display(description="Пользователей")
    def users_count(self, obj):
        count = getattr(obj, "users_total", 0)
        return format_html("<strong>{}</strong>", count)

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


@admin.register(Permission)
class PermissionAdmin(SoftDeleteImportExportAdmin):
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

    @admin.display(description="Ресурс")
    def resource_display(self, obj):
        return obj.get_resource_display()

    @admin.display(description="Действие")
    def action_display(self, obj):
        return obj.get_action_display()

    @admin.display(description="Ролей")
    def roles_count(self, obj):
        count = obj.roles.count()
        return format_html("<strong>{}</strong>", count)

    @admin.display(description="Статус")
    def status_badge(self, obj):
        if obj.deleted_at:
            return self.render_badge(
                "Удалено",
                bg_color="#fee2e2",
                fg_color="#b91c1c",
                bold=True,
            )
        return self.render_badge(
            "Активно",
            bg_color="#dcfce7",
            fg_color="#166534",
            bold=True,
        )


@admin.register(UserRole)
class UserRoleAdmin(ImportExportModelAdmin):
    resource_class = UserRoleResource

    list_display = ["user", "role", "created_at"]
    list_filter = ("role", "created_at")
    search_fields = ("user__username", "role__name")
    readonly_fields = ("created_at",)
    list_select_related = ("user", "role")
    autocomplete_fields = ("user", "role")

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
    list_select_related = ("role", "permission")
    autocomplete_fields = ("role", "permission")

    fieldsets = (
        ("Связь", {"fields": ("role", "permission")}),
        ("Время", {"fields": ("created_at",)}),
    )

    @admin.display(description="Право")
    def permission_display(self, obj):
        return str(obj.permission)


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
    list_select_related = ("actor",)
    date_hierarchy = "created_at"
    list_per_page = 30
    show_full_result_count = False
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

    @admin.display(description="Тип")
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

    @admin.display(description="Действие")
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

    @admin.display(description="Кто")
    def actor_display(self, obj):
        if obj.actor:
            return format_html("<strong>{}</strong>", obj.actor.username)
        return format_html("<em>Система</em>")


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
    admin.site.unregister(User)
except NotRegistered:
    pass

admin.site.register(User, CustomUserAdmin)


# ============ ADMIN SITE CUSTOMIZATION ============

admin.site.site_header = "CRM 3.0 - Администрирование"
admin.site.site_title = "CRM 3.0 Admin"
admin.site.index_title = "Добро пожаловать в администрирование CRM 3.0"
