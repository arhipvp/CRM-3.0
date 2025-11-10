from django.conf import settings
from django.db import models
from django.utils import timezone
from apps.common.models import SoftDeleteModel


class Notification(SoftDeleteModel):
    """Уведомление для пользователя"""

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        related_name='notifications',
        on_delete=models.CASCADE,
        help_text="Пользователь"
    )
    type = models.CharField(max_length=120, help_text="Тип уведомления")
    payload = models.JSONField(default=dict, blank=True, help_text="Данные уведомления")
    is_read = models.BooleanField(default=False, help_text="Прочитано")
    read_at = models.DateTimeField(null=True, blank=True, help_text="Время прочтения")

    class Meta:
        ordering = ['-created_at']
        verbose_name = 'Уведомление'
        verbose_name_plural = 'Уведомления'

    def mark_as_read(self):
        """Отметить как прочитано"""
        if not self.is_read:
            self.is_read = True
            self.read_at = timezone.now()
            self.save(update_fields=['is_read', 'read_at'])

    def __str__(self) -> str:
        return f'{self.type} для {self.user}'
