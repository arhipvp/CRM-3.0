import uuid

from django.conf import settings
from django.db import models


class Task(models.Model):
    class TaskStatus(models.TextChoices):
        TODO = 'todo', 'To do'
        IN_PROGRESS = 'in_progress', 'In progress'
        DONE = 'done', 'Done'
        OVERDUE = 'overdue', 'Overdue'
        CANCELED = 'canceled', 'Canceled'

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    title = models.CharField(max_length=255)
    description = models.TextField(blank=True)
    deal = models.ForeignKey('deals.Deal', related_name='tasks', on_delete=models.CASCADE, null=True, blank=True)
    client = models.ForeignKey('clients.Client', related_name='tasks', on_delete=models.CASCADE, null=True, blank=True)
    contact = models.ForeignKey(
        'clients.Contact', related_name='tasks', on_delete=models.CASCADE, null=True, blank=True
    )
    assignee = models.ForeignKey(
        settings.AUTH_USER_MODEL, related_name='assigned_tasks', on_delete=models.SET_NULL, null=True, blank=True
    )
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, related_name='created_tasks', on_delete=models.SET_NULL, null=True, blank=True
    )
    due_at = models.DateTimeField(null=True, blank=True)
    remind_at = models.DateTimeField(null=True, blank=True)
    status = models.CharField(max_length=20, choices=TaskStatus.choices, default=TaskStatus.TODO)
    priority = models.CharField(max_length=20, default='normal')
    checklist = models.JSONField(default=list, blank=True)
    extra = models.JSONField(default=dict, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self) -> str:
        return self.title
