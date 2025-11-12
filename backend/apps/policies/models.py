from apps.common.models import SoftDeleteModel
from django.db import models


class Policy(SoftDeleteModel):
    """Страховой полис, привязанный к сделке"""

    # Основная информация
    number = models.CharField(max_length=50, help_text="Номер полиса", unique=True)
    insurance_company = models.CharField(
        max_length=255, help_text="Наименование страховой компании"
    )
    insurance_type = models.CharField(
        max_length=120, help_text="Вид страхования (КАСКО, ОСАГО и т.д.)"
    )

    # Привязка к сделке
    deal = models.ForeignKey(
        "deals.Deal",
        related_name="policies",
        on_delete=models.CASCADE,
        help_text="Сделка",
    )

    # VIN (для автомобильных полисов)
    vin = models.CharField(max_length=17, blank=True, help_text="VIN автомобиля")

    # Даты
    start_date = models.DateField(
        null=True, blank=True, help_text="Дата начала действия"
    )
    end_date = models.DateField(
        null=True, blank=True, help_text="Дата окончания действия"
    )

    # Сумма и статус
    amount = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        default=0,
        help_text="Сумма страховки (в рублях)",
    )
    status = models.CharField(
        max_length=50,
        default="active",
        help_text="Статус (active, expired, canceled и т.д.)",
    )

    class Meta:
        ordering = ["-created_at"]
        verbose_name = "Полис"
        verbose_name_plural = "Полисы"
        indexes = [
            models.Index(fields=["number"]),
            models.Index(fields=["deal"]),
            models.Index(fields=["insurance_company"]),
        ]

    def __str__(self) -> str:
        return f"Полис {self.number} ({self.insurance_type})"
