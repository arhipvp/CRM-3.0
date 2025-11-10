import uuid

from django.conf import settings
from django.db import models


def document_upload_path(instance, filename):
    return f'documents/{instance.owner_id}/{filename}'


class Document(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    title = models.CharField(max_length=255)
    file = models.FileField(upload_to=document_upload_path)
    file_size = models.PositiveIntegerField(default=0)
    mime_type = models.CharField(max_length=120, blank=True)
    deal = models.ForeignKey('deals.Deal', related_name='documents', on_delete=models.CASCADE, null=True, blank=True)
    client = models.ForeignKey('clients.Client', related_name='documents', on_delete=models.CASCADE, null=True, blank=True)
    contact = models.ForeignKey(
        'clients.Contact', related_name='documents', on_delete=models.CASCADE, null=True, blank=True
    )
    owner = models.ForeignKey(
        settings.AUTH_USER_MODEL, related_name='documents', on_delete=models.SET_NULL, null=True, blank=True
    )
    doc_type = models.CharField(max_length=120, blank=True)
    status = models.CharField(max_length=50, default='draft')
    checksum = models.CharField(max_length=128, blank=True)
    extra = models.JSONField(default=dict, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def save(self, *args, **kwargs):
        if self.file and not self.file_size:
            self.file_size = self.file.size
        super().save(*args, **kwargs)

    def __str__(self) -> str:
        return self.title
