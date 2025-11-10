from django.contrib import admin

from .models import Client, Contact


@admin.register(Client)
class ClientAdmin(admin.ModelAdmin):
    list_display = ('name', 'type', 'status', 'owner', 'created_at')
    search_fields = ('name', 'legal_name', 'tax_id')
    list_filter = ('status', 'type')


@admin.register(Contact)
class ContactAdmin(admin.ModelAdmin):
    list_display = ('full_name', 'client', 'owner', 'preferred_channel')
    search_fields = ('full_name', 'emails')
    list_filter = ('preferred_channel',)
