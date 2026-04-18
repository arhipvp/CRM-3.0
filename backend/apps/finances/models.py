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
        """Payment can be deleted only if it is unpaid and has no paid records."""
        has_paid_records = self.financial_records.filter(
            date__isnull=False, deleted_at__isnull=True
        ).exists()
        return not self.is_paid and not has_paid_records

    def delete(self, using=None, keep_parents=False):
        """Soft delete: disallow paid payments and cascade records."""
        if self.is_paid:
            raise ValidationError("Нельзя удалить оплаченный платёж.")
        if self.financial_records.filter(
            date__isnull=False, deleted_at__isnull=True
        ).exists():
            raise ValidationError(
                "Нельзя удалить платёж, пока у него есть оплаченные финансовые записи."
            )
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
    # NOTE:
    # Поле status оставлено в схеме для совместимости (админка/legacy),
    # но в бизнес-логике не используется.
    # Ведомость считается "выплаченной" по факту наличия paid_at.
    status = models.CharField(
        max_length=20, choices=STATUS_CHOICES, default=STATUS_DRAFT
    )
    paid_at = models.DateField(
        null=True,
        blank=True,
        help_text="Дата выплаты ведомости. Если заполнено — ведомость считается выплаченной.",
    )
    comment = models.TextField(blank=True, help_text="Комментарий")
    drive_folder_id = models.CharField(
        max_length=255,
        blank=True,
        null=True,
        help_text="Google Drive folder ID",
    )
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

    class RecordType(models.TextChoices):
        INCOME = "income", "Доход"
        EXPENSE = "expense", "Расход"

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
    record_type = models.CharField(
        max_length=20,
        choices=RecordType.choices,
        default=RecordType.INCOME,
        help_text="Тип записи",
    )
    date = models.DateField(null=True, blank=True, help_text="Дата операции")
    description = models.CharField(
        max_length=255, blank=True, help_text="Описание операции"
    )
    source = models.CharField(
        max_length=120,
        blank=True,
        help_text="Источник дохода / назначение расхода",
    )
    note = models.TextField(blank=True, help_text="Примечание")

    class Meta:
        ordering = ["-date", "-created_at"]
        verbose_name = "Финансовая запись"
        verbose_name_plural = "Финансовые записи"

    @classmethod
    def infer_record_type_from_amount(cls, amount):
        if amount is None:
            return cls.RecordType.INCOME
        return cls.RecordType.EXPENSE if amount < 0 else cls.RecordType.INCOME

    @classmethod
    def normalize_amount_for_record_type(cls, record_type, amount):
        if amount is None:
            return amount
        return -abs(amount) if record_type == cls.RecordType.EXPENSE else abs(amount)

    def save(self, *args, **kwargs):
        if self.record_type not in self.RecordType.values:
            self.record_type = self.infer_record_type_from_amount(self.amount)
        elif (
            self._state.adding
            and self.record_type == self.RecordType.INCOME
            and self.amount is not None
            and self.amount < 0
        ):
            # Legacy ORM call sites may still omit record_type and rely on signed amount.
            self.record_type = self.RecordType.EXPENSE
        self.amount = self.normalize_amount_for_record_type(
            self.record_type,
            self.amount,
        )
        super().save(*args, **kwargs)

    def __str__(self) -> str:
        return (
            f"{self.get_record_type_display()} {abs(self.amount)} РУБ для платежа "
            f"{self.payment_id}"
        )
