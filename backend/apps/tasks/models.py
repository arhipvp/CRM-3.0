from django.conf import settings
from django.db import models
from apps.common.models import SoftDeleteModel


class Task(SoftDeleteModel):
    """Задача, связанная со сделкой"""

    class TaskStatus(models.TextChoices):
        TODO = 'todo', 'К выполнению'
        IN_PROGRESS = 'in_progress', 'В процессе'
        DONE = 'done', 'Завершена'
        OVERDUE = 'overdue', 'Просрочена'
        CANCELED = 'canceled', 'Отменена'

    class PriorityChoices(models.TextChoices):
        LOW = 'low', 'Низкая'
        NORMAL = 'normal', 'Обычная'
        HIGH = 'high', 'Высокая'
        URGENT = 'urgent', 'Срочная'

    title = models.CharField(max_length=255, help_text="Название задачи")
    description = models.TextField(blank=True, help_text="Описание задачи")

    # Связь на сделку
    deal = models.ForeignKey(
        'deals.Deal',
        related_name='tasks',
        on_delete=models.CASCADE,
        help_text="Сделка",
        null=True,
        blank=True
    )

    # Назначение
    assignee = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        related_name='assigned_tasks',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        help_text="Назначен"
    )
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        related_name='created_tasks',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        help_text="Создано"
    )

    # Сроки
    due_at = models.DateTimeField(null=True, blank=True, help_text="Срок выполнения")
    remind_at = models.DateTimeField(null=True, blank=True, help_text="Время напоминания")

    # Статус и приоритет
    status = models.CharField(
        max_length=20,
        choices=TaskStatus.choices,
        default=TaskStatus.TODO,
        help_text="Статус"
    )
    priority = models.CharField(
        max_length=20,
        choices=PriorityChoices.choices,
        default=PriorityChoices.NORMAL,
        help_text="Приоритет"
    )

    # Чек-лист
    checklist = models.JSONField(default=list, blank=True, help_text="Пункты чек-листа")

    class Meta:
        ordering = ['-created_at']
        verbose_name = 'Задача'
        verbose_name_plural = 'Задачи'

    def __str__(self) -> str:
        return self.title
