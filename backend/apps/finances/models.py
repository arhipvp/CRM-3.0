from apps.common.models import SoftDeleteModel
from django.conf import settings
from django.core.exceptions import ValidationError
from django.db import models


class Payment(SoftDeleteModel):
    """Платёж в рамках полиса"""

    policy = models.ForeignKey(
        "policies.Policy",
        related_name="payments",
        on_delete=models.CASCADE,
        help_text="Полис",
        null=True,
        blank=True,
    )
    deal = models.ForeignKey(
        "deals.Deal",
        related_name="payments",
        on_delete=models.CASCADE,
        help_text="Сделка (денормализованное поле для производительности)",
        null=True,
        blank=True,
    )
    amount = models.DecimalField(
        max_digits=12, decimal_places=2, help_text="Сумма (в рублях)"
    )
    description = models.CharField(max_length=255, blank=True, help_text="Описание")
    scheduled_date = models.DateField(
        null=True, blank=True, help_text="Запланированная дата"
    )
    actual_date = models.DateField(null=True, blank=True, help_text="Фактическая дата")

    class Meta:
        ordering = ["-created_at"]
        verbose_name = "Платёж"
        verbose_name_plural = "Платежи"

    @property
    def is_paid(self) -> bool:
        """Платёж считается оплачен, если actual_date не None."""
        return self.actual_date is not None

    def __str__(self) -> str:
        return f"Платёж {self.amount} РУБ для {self.policy}"

    def can_delete(self) -> bool:
        """Платёж можно удалять только если он ещё не оплачен."""
        return not self.is_paid

    def delete(self, using=None, keep_parents=False):
        """Мягкое удаление: запрет для оплаченных платежей и каскадные записи."""
        if self.is_paid:
            raise ValidationError("Оплаченный платёж нельзя удалить.")
        for record in self.financial_records.all():
            record.delete()
        super().delete(using=using, keep_parents=keep_parents)


class Statement(SoftDeleteModel):
    """Ведомость доходов или расходов."""

    TYPE_INCOME = "income"
    TYPE_EXPENSE = "expense"
    TYPE_CHOICES = (
        (TYPE_INCOME, "Доход"),
        (TYPE_EXPENSE, "Расход"),
    )

    STATUS_DRAFT = "draft"
    STATUS_PAID = "paid"
    STATUS_CHOICES = (
        (STATUS_DRAFT, "Черновик"),
        (STATUS_PAID, "Выплачена"),
    )

    name = models.CharField(max_length=255, help_text="Название")
    statement_type = models.CharField(
        max_length=20, choices=TYPE_CHOICES, help_text="Тип ведомости"
    )
    counterparty = models.CharField(max_length=255, blank=True, help_text="Контрагент")
    status = models.CharField(
        max_length=20, choices=STATUS_CHOICES, default=STATUS_DRAFT
    )
    paid_at = models.DateField(null=True, blank=True, help_text="Дата оплаты")
    comment = models.TextField(blank=True, help_text="Комментарий")
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="finance_statements",
        help_text="Создал",
    )

    class Meta:
        ordering = ["-created_at"]
        verbose_name = "Ведомость"
        verbose_name_plural = "Ведомости"
        indexes = [
            models.Index(fields=["statement_type"]),
            models.Index(fields=["status"]),
        ]

    def __str__(self) -> str:
        return f"Ведомость {self.name}"

    def delete(self, *args, **kwargs):
        """Мягкое удаление: отвязать записи от ведомости."""
        self.records.update(statement=None)
        super().delete(*args, **kwargs)


class FinancialRecord(SoftDeleteModel):
    """Финансовая запись (доход/расход) для платежа

    Положительное число - доход (заработок агента)
    Отрицательное число - расход (затраты на ведение дел)
    """

    payment = models.ForeignKey(
        Payment,
        related_name="financial_records",
        on_delete=models.CASCADE,
        help_text="Платёж",
    )
    statement = models.ForeignKey(
        "finances.Statement",
        related_name="records",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        help_text="Ведомость",
    )
    amount = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        help_text="Сумма (положительное = доход, отрицательное = расход)",
    )
    date = models.DateField(null=True, blank=True, help_text="Дата операции")
    description = models.CharField(
        max_length=255, blank=True, help_text="Описание операции"
    )
    source = models.CharField(
        max_length=120, blank=True, help_text="Источник дохода / назначение расхода"
    )
    note = models.TextField(blank=True, help_text="Примечание")

    class Meta:
        ordering = ["-date", "-created_at"]
        verbose_name = "Финансовая запись"
        verbose_name_plural = "Финансовые записи"

    def __str__(self) -> str:
        record_type = "Доход" if self.amount >= 0 else "Расход"
        return f"{record_type} {abs(self.amount)} РУБ для платежа {self.payment_id}"
