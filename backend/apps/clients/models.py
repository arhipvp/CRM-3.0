import uuid

from django.conf import settings
from django.db import models


class Client(models.Model):
    class ClientType(models.TextChoices):
        COMPANY = 'company', 'Company'
        PERSON = 'person', 'Person'

    class ClientStatus(models.TextChoices):
        LEAD = 'lead', 'Lead'
        ACTIVE = 'active', 'Active'
        DORMANT = 'dormant', 'Dormant'
        ARCHIVED = 'archived', 'Archived'

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    type = models.CharField(max_length=20, choices=ClientType.choices, default=ClientType.COMPANY)
    name = models.CharField(max_length=255)
    legal_name = models.CharField(max_length=255, blank=True)
    tax_id = models.CharField(max_length=32, blank=True)
    industry = models.CharField(max_length=120, blank=True)
    source = models.CharField(max_length=120, blank=True)
    website = models.URLField(blank=True)
    addresses = models.JSONField(default=list, blank=True)
    phones = models.JSONField(default=list, blank=True)
    emails = models.JSONField(default=list, blank=True)
    messengers = models.JSONField(default=dict, blank=True)
    owner = models.ForeignKey(
        settings.AUTH_USER_MODEL, related_name='clients', on_delete=models.SET_NULL, null=True, blank=True
    )
    status = models.CharField(max_length=20, choices=ClientStatus.choices, default=ClientStatus.LEAD)
    rating = models.PositiveIntegerField(default=0)
    tags = models.JSONField(default=list, blank=True)
    extra = models.JSONField(default=dict, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self) -> str:
        return self.name


class Contact(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    client = models.ForeignKey(Client, related_name='contacts', on_delete=models.CASCADE)
    full_name = models.CharField(max_length=255)
    position = models.CharField(max_length=255, blank=True)
    phones = models.JSONField(default=list, blank=True)
    emails = models.JSONField(default=list, blank=True)
    messengers = models.JSONField(default=dict, blank=True)
    owner = models.ForeignKey(
        settings.AUTH_USER_MODEL, related_name='contacts', on_delete=models.SET_NULL, null=True, blank=True
    )
    birthday = models.DateField(null=True, blank=True)
    preferred_channel = models.CharField(max_length=50, blank=True)
    tags = models.JSONField(default=list, blank=True)
    notes = models.TextField(blank=True)
    extra = models.JSONField(default=dict, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['full_name']

    def __str__(self) -> str:
        return self.full_name
