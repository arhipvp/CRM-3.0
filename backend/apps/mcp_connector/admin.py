from config.admin import admin_site
from django.contrib import admin

from .models import McpAccessGrant, McpMutation


@admin.register(McpAccessGrant, site=admin_site)
class McpAccessGrantAdmin(admin.ModelAdmin):
    list_display = ("user", "enabled", "updated_at")
    list_filter = ("enabled",)
    search_fields = ("user__username",)
    raw_id_fields = ("user",)


@admin.register(McpMutation, site=admin_site)
class McpMutationAdmin(admin.ModelAdmin):
    list_display = ("user", "tool_name", "status", "created_at")
    exclude = ("result", "body_hash")
    readonly_fields = ("user", "client_id", "request_id", "tool_name", "status")

    def has_add_permission(self, request):
        return False

    def has_change_permission(self, request, obj=None):
        return False

    def has_delete_permission(self, request, obj=None):
        return False
