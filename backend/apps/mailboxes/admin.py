from django.contrib import admin

from .models import Mailbox


@admin.register(Mailbox)
class MailboxAdmin(admin.ModelAdmin):
    list_display = ("email", "user", "is_active", "created_at")
    search_fields = ("email", "user__username")
    list_filter = ("is_active", "created_at")
