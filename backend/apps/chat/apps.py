from django.apps import AppConfig


class ChatConfig(AppConfig):
    """Application configuration for the chat module."""

    default_auto_field = "django.db.models.BigAutoField"
    name = "apps.chat"
    verbose_name = "Chat"
