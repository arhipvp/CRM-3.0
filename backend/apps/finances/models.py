from django.db import models
from apps.common.models import SoftDeleteModel


class FinancialTransaction(SoftDeleteModel):
    """Обобщённая финансовая транзакция (доход или расход)"""

    class TransactionType(models.TextChoices):
        INCOME = 'income', 'Доход'
        EXPENSE = 'expense', 'Расход'

    deal = models.ForeignKey(
        'deals.Deal',
        related_name='financial_transactions',
        on_delete=models.CASCADE,
        help_text="Сделка",
        null=True,
        blank=True
    )

    transaction_type = models.CharField(
        max_length=20,
        choices=TransactionType.choices,
        help_text="Тип транзакции"
    )

    amount = models.DecimalField(max_digits=12, decimal_places=2, help_text="Сумма (в рублях)")
    description = models.CharField(max_length=255, blank=True, help_text="Описание")
    transaction_date = models.DateField(help_text="Дата транзакции")

    # Дополнительные поля
    source = models.CharField(max_length=120, blank=True, help_text="Источник дохода")
    category = models.CharField(max_length=120, blank=True, help_text="Категория/тип расхода")
    note = models.TextField(blank=True, help_text="Примечание")

    class Meta:
        ordering = ['-transaction_date', '-created_at']
        verbose_name = 'Финансовая транзакция'
        verbose_name_plural = 'Финансовые транзакции'

    def __str__(self) -> str:
        return f'{self.get_transaction_type_display()} {self.amount} РУБ ({self.transaction_date})'


class Payment(SoftDeleteModel):
    """Платёж в рамках сделки"""

    class PaymentStatus(models.TextChoices):
        PLANNED = 'planned', 'Запланирован'
        PARTIAL = 'partial', 'Частичный'
        PAID = 'paid', 'Оплачен'

    deal = models.ForeignKey(
        'deals.Deal',
        related_name='payments',
        on_delete=models.CASCADE,
        help_text="Сделка",
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
        return f'Платёж {self.amount} РУБ для {self.deal}'


class Income(SoftDeleteModel):
    """Полученный доход"""

    payment = models.ForeignKey(
        Payment,
        related_name='incomes',
        on_delete=models.CASCADE,
        help_text="Платёж"
    )
    amount = models.DecimalField(max_digits=12, decimal_places=2, help_text="Сумма (в рублях)")
    received_at = models.DateField(null=True, blank=True, help_text="Дата получения")
    source = models.CharField(max_length=120, blank=True, help_text="Источник")
    note = models.TextField(blank=True, help_text="Примечание")

    class Meta:
        ordering = ['-created_at']
        verbose_name = 'Доход'
        verbose_name_plural = 'Доходы'

    def __str__(self) -> str:
        return f'Доход {self.amount} для {self.payment_id}'


class Expense(SoftDeleteModel):
    """Расход в рамках платежа"""

    payment = models.ForeignKey(
        Payment,
        related_name='expenses',
        on_delete=models.CASCADE,
        help_text="Платёж"
    )
    amount = models.DecimalField(max_digits=12, decimal_places=2, help_text="Сумма")
    expense_type = models.CharField(max_length=120, help_text="Тип расхода")
    expense_date = models.DateField(null=True, blank=True, help_text="Дата расхода")
    note = models.TextField(blank=True, help_text="Примечание")

    class Meta:
        ordering = ['-created_at']
        verbose_name = 'Расход'
        verbose_name_plural = 'Расходы'

    def __str__(self) -> str:
        return f'Расход {self.amount} для {self.payment_id}'
