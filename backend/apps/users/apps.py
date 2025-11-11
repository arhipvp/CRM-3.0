from django.apps import AppConfig


class UsersConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'apps.users'

    def ready(self):
        """Регистрировать сигналы при загрузке приложения"""
        import apps.users.signals  # noqa: F401
