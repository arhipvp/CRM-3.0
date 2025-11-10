import uuid

from django.db import models


class Note(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    deal = models.ForeignKey('deals.Deal', related_name='notes', on_delete=models.CASCADE, null=True, blank=True)
    client = models.ForeignKey('clients.Client', related_name='notes', on_delete=models.CASCADE, null=True, blank=True)
    body = models.TextField()
    author_name = models.CharField(max_length=120, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self) -> str:
        target = self.deal or self.client
        return f'Note for {target}' if target else 'Note'
