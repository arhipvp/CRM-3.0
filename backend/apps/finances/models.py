from django.db import models
from django.core.exceptions import ValidationError
from apps.common.models import SoftDeleteModel


class Payment(SoftDeleteModel):
    """Платёж в рамках полиса"""

    class PaymentStatus(models.TextChoices):
        PLANNED = 'planned', 'Запланирован'
        PARTIAL = 'partial', 'Частичный'
        PAID = 'paid', 'Оплачен'

    policy = models.ForeignKey(
        'policies.Policy',
        related_name='payments',
        on_delete=models.CASCADE,
        help_text="Полис",
        null=True,
        blank=True
    )
    deal = models.ForeignKey(
        'deals.Deal',
        related_name='payments',
        on_delete=models.CASCADE,
        help_text="Сделка (денормализованное поле для производительности)",
        null=True,
        blank=True
    )
    amount = models.DecimalField(max_digits=12, decimal_places=2, help_text="Сумма (в рублях)")
    description = models.CharField(max_length=255, blank=True, help_text="Описание")
    scheduled_date = models.DateField(null=True, blank=True, help_text="Запланированная дата")
    actual_date = models.DateField(null=True, blank=True, help_text="Фактическая дата")
    status = models.CharField(
        max_length=20,
        choices=PaymentStatus.choices,
        default=PaymentStatus.PLANNED,
        help_text="Статус"
    )

    class Meta:
        ordering = ['-created_at']
        verbose_name = 'Платёж'
        verbose_name_plural = 'Платежи'

    def __str__(self) -> str:
        return f'Платёж {self.amount} РУБ для {self.policy}'

    def can_delete(self) -> bool:
        """Проверка: платёж можно удалить только если нет связанных записей"""
        return not self.financial_records.filter(deleted_at__isnull=True).exists()

    def delete(self, using=None, keep_parents=False):
        """Мягкое удаление платежа с проверкой"""
        if not self.can_delete():
            raise ValidationError("Невозможно удалить платёж, так как у него есть финансовые записи.")
        super().delete(using=using, keep_parents=keep_parents)


class FinancialRecord(SoftDeleteModel):
    """Финансовая запись (доход/расход) для платежа

    Положительное число - доход (заработок агента)
    Отрицательное число - расход (затраты на ведение дел)
    """

    payment = models.ForeignKey(
        Payment,
        related_name='financial_records',
        on_delete=models.CASCADE,
        help_text="Платёж"
    )
    amount = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        help_text="Сумма (положительное = доход, отрицательное = расход)"
    )
    date = models.DateField(
        null=True,
        blank=True,
        help_text="Дата операции"
    )
    description = models.CharField(
        max_length=255,
        blank=True,
        help_text="Описание операции"
    )
    source = models.CharField(
        max_length=120,
        blank=True,
        help_text="Источник дохода / назначение расхода"
    )
    note = models.TextField(
        blank=True,
        help_text="Примечание"
    )

    class Meta:
        ordering = ['-date', '-created_at']
        verbose_name = 'Финансовая запись'
        verbose_name_plural = 'Финансовые записи'

    def __str__(self) -> str:
        record_type = "Доход" if self.amount >= 0 else "Расход"
        return f'{record_type} {abs(self.amount)} РУБ для платежа {self.payment_id}'
