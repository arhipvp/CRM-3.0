from apps.common.models import SoftDeleteModel
from django.conf import settings
from django.db import models
from django.utils import timezone


class InsuranceCompany(SoftDeleteModel):
    """Справочник страховых компаний для расчетов."""

    name = models.CharField(
        max_length=255,
        unique=True,
        help_text="Название страховой компании",
    )
    description = models.TextField(
        blank=True,
        help_text="Дополнительная информация о компании",
    )

    class Meta:
        ordering = ["name"]
        verbose_name = "Страховая компания"
        verbose_name_plural = "Страховые компании"

    def __str__(self) -> str:
        return self.name


class InsuranceType(SoftDeleteModel):
    """Справочник видов страхования."""

    name = models.CharField(
        max_length=255,
        unique=True,
        help_text="Наименование вида страхования",
    )
    description = models.TextField(
        blank=True,
        help_text="Дополнительное описание типа страхования",
    )

    class Meta:
        ordering = ["name"]
        verbose_name = "Вид страхования"
        verbose_name_plural = "Виды страхования"

    def __str__(self) -> str:
        return self.name


class Deal(SoftDeleteModel):
    """Сделка и её основные атрибуты."""

    title = models.CharField(max_length=255, help_text="Название сделки")
    description = models.TextField(blank=True, help_text="Описание сделки")

    client = models.ForeignKey(
        "clients.Client",
        related_name="deals",
        on_delete=models.PROTECT,
        help_text="Клиент",
    )

    seller = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        related_name="sold_deals",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        help_text="Менеджер",
    )
    executor = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        related_name="executed_deals",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        help_text="Исполнитель",
    )

    status = models.CharField(
        max_length=50, default="open", help_text="Статус сделки (произвольный текст)"
    )
    stage_name = models.CharField(max_length=120, blank=True, help_text="Стадия")

    expected_close = models.DateField(
        null=True, blank=True, help_text="Плановая дата закрытия"
    )
    next_contact_date = models.DateField(
        default=timezone.now, help_text="Дата следующего контакта (по-умолчанию - текущая дата)"
    )
    next_review_date = models.DateField(
        null=True, blank=True, help_text="Дата следующего контакта"
    )

    source = models.CharField(max_length=100, blank=True, help_text="Источник")
    loss_reason = models.CharField(
        max_length=255, blank=True, help_text="Причина проигрыша"
    )
    channel = models.CharField(max_length=100, blank=True, help_text="Канал продаж")
    drive_folder_id = models.CharField(
        max_length=255, blank=True, null=True, help_text="Google Drive folder ID"
    )

    class Meta:
        ordering = ["next_contact_date", "-next_review_date", "-created_at"]
        verbose_name = "Сделка"
        verbose_name_plural = "Сделки"

    def __str__(self) -> str:
        return self.title


class Quote(SoftDeleteModel):
    """Расчет страхового продукта, подготовленный по сделке."""

    deal = models.ForeignKey(
        "deals.Deal", related_name="quotes", on_delete=models.CASCADE
    )
    insurance_company = models.ForeignKey(
        "deals.InsuranceCompany",
        related_name="quotes",
        on_delete=models.PROTECT,
        help_text="Страховая компания",
    )
    insurance_type = models.ForeignKey(
        "deals.InsuranceType",
        related_name="quotes",
        on_delete=models.PROTECT,
        help_text="Тип страхования",
    )
    sum_insured = models.DecimalField(
        max_digits=14, decimal_places=2, help_text="Страховая сумма"
    )
    premium = models.DecimalField(max_digits=12, decimal_places=2, help_text="Премия")
    deductible = models.CharField(max_length=255, blank=True, help_text="Франшиза")
    comments = models.TextField(blank=True, help_text="Комментарий")

    class Meta:
        ordering = ["-created_at"]
        verbose_name = "Расчет"
        verbose_name_plural = "Расчеты"

    def __str__(self) -> str:
        type_name = self.insurance_type.name if self.insurance_type else "—"
        company_name = self.insurance_company.name if self.insurance_company else "—"
        return f"{type_name} — {company_name}"
