import uuid

from django.conf import settings
from django.db import models


class Deal(models.Model):
    class DealStatus(models.TextChoices):
        OPEN = 'open', 'Open'
        WON = 'won', 'Won'
        LOST = 'lost', 'Lost'
        ON_HOLD = 'on_hold', 'On Hold'

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    title = models.CharField(max_length=255)
    client = models.ForeignKey('clients.Client', related_name='deals', on_delete=models.CASCADE)
    primary_contact = models.ForeignKey(
        'clients.Contact', related_name='primary_deals', on_delete=models.SET_NULL, null=True, blank=True
    )
    owner = models.ForeignKey(
        settings.AUTH_USER_MODEL, related_name='owned_deals', on_delete=models.SET_NULL, null=True, blank=True
    )
    amount = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    currency = models.CharField(max_length=8, default='RUB')
    probability = models.PositiveIntegerField(default=0)
    status = models.CharField(max_length=20, choices=DealStatus.choices, default=DealStatus.OPEN)
    stage_name = models.CharField(max_length=120, blank=True)
    expected_close = models.DateField(null=True, blank=True)
    source = models.CharField(max_length=100, blank=True)
    loss_reason = models.CharField(max_length=255, blank=True)
    channel = models.CharField(max_length=100, blank=True)
    extra = models.JSONField(default=dict, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self) -> str:
        return self.title
