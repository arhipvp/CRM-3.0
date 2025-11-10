import uuid

from django.db import models


class Payment(models.Model):
    class PaymentStatus(models.TextChoices):
        PLANNED = 'planned', 'Planned'
        PARTIAL = 'partial', 'Partial'
        PAID = 'paid', 'Paid'

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    deal = models.ForeignKey('deals.Deal', related_name='payments', on_delete=models.CASCADE)
    amount = models.DecimalField(max_digits=12, decimal_places=2)
    currency = models.CharField(max_length=8, default='RUB')
    description = models.CharField(max_length=255, blank=True)
    scheduled_date = models.DateField(null=True, blank=True)
    actual_date = models.DateField(null=True, blank=True)
    status = models.CharField(max_length=20, choices=PaymentStatus.choices, default=PaymentStatus.PLANNED)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self) -> str:
        return f'Payment {self.amount} {self.currency} for {self.deal}'


class Income(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    payment = models.ForeignKey(Payment, related_name='incomes', on_delete=models.CASCADE)
    amount = models.DecimalField(max_digits=12, decimal_places=2)
    received_at = models.DateField(null=True, blank=True)
    source = models.CharField(max_length=120, blank=True)
    note = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self) -> str:
        return f'Income {self.amount} for {self.payment_id}'


class Expense(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    payment = models.ForeignKey(Payment, related_name='expenses', on_delete=models.CASCADE)
    amount = models.DecimalField(max_digits=12, decimal_places=2)
    expense_type = models.CharField(max_length=120)
    expense_date = models.DateField(null=True, blank=True)
    note = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self) -> str:
        return f'Expense {self.amount} for {self.payment_id}'
