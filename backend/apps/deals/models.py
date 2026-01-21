# -*- coding: utf-8 -*-
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


class SalesChannel(SoftDeleteModel):
    """Справочник каналов продаж."""

    name = models.CharField(
        max_length=100, unique=True, help_text="Название канала продаж"
    )
    description = models.TextField(blank=True, help_text="Дополнительный комментарий")

    class Meta:
        ordering = ["name"]
        verbose_name = "Канал продаж"
        verbose_name_plural = "Каналы продаж"

    def __str__(self) -> str:
        return self.name


class Deal(SoftDeleteModel):
    """Сделка и её основные атрибуты."""

    class DealStatus(models.TextChoices):
        OPEN = "open", "В работе"
        ON_HOLD = "on_hold", "На паузе"
        WON = "won", "Выиграна"
        LOST = "lost", "Закрыта (проигрыш)"

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
        max_length=50,
        choices=DealStatus.choices,
        default=DealStatus.OPEN,
        help_text="Статус сделки",
    )
    stage_name = models.CharField(max_length=120, blank=True, help_text="Стадия")

    expected_close = models.DateField(
        null=True, blank=True, help_text="Плановая дата закрытия"
    )
    next_contact_date = models.DateField(
        default=timezone.now,
        help_text="Дата следующего контакта (по-умолчанию - текущая дата)",
    )
    next_review_date = models.DateField(
        null=True, blank=True, help_text="Дата следующего контакта"
    )

    source = models.CharField(max_length=100, blank=True, help_text="Источник")
    loss_reason = models.CharField(
        max_length=255, blank=True, help_text="Причина проигрыша"
    )
    closing_reason = models.TextField(
        blank=True, default="", help_text="Closing reason"
    )
    drive_folder_id = models.CharField(
        max_length=255, blank=True, null=True, help_text="Google Drive folder ID"
    )

    class Meta:
        ordering = ["next_contact_date", "-next_review_date", "-created_at"]
        verbose_name = "Сделка"
        verbose_name_plural = "Сделки"

    def __str__(self) -> str:
        return self.title

    def delete(self, *args, **kwargs):
        for policy in self.policies.all():
            policy.delete()
        self.payments.all().delete()
        self.tasks.all().delete()
        return super().delete(*args, **kwargs)


class DealPin(models.Model):
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        related_name="deal_pins",
        on_delete=models.CASCADE,
    )
    deal = models.ForeignKey(
        "deals.Deal",
        related_name="pins",
        on_delete=models.CASCADE,
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(fields=["user", "deal"], name="unique_deal_pin")
        ]
        ordering = ["-created_at"]


class Quote(SoftDeleteModel):
    """Расчет страхового продукта, подготовленный по сделке."""

    deal = models.ForeignKey(
        "deals.Deal", related_name="quotes", on_delete=models.CASCADE
    )
    seller = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        related_name="quotes",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        help_text="Продавец",
    )
    insurance_company = models.ForeignKey(
        "deals.InsuranceCompany",
        related_name="quotes",
        on_delete=models.SET_NULL,
        help_text="Страховая компания",
        null=True,
        blank=True,
    )
    insurance_type = models.ForeignKey(
        "deals.InsuranceType",
        related_name="quotes",
        on_delete=models.SET_NULL,
        help_text="Тип страхования",
        null=True,
        blank=True,
    )
    sum_insured = models.DecimalField(
        max_digits=14, decimal_places=2, help_text="Страховая сумма"
    )
    premium = models.DecimalField(max_digits=12, decimal_places=2, help_text="Премия")
    deductible = models.CharField(max_length=255, blank=True, help_text="Франшиза")
    official_dealer = models.BooleanField(
        default=False,
        verbose_name="Официальный дилер",
        help_text="Официальный дилер (да/нет)",
    )
    gap = models.BooleanField(
        default=False,
        verbose_name="GAP",
        help_text="GAP (да/нет)",
    )
    comments = models.TextField(blank=True, help_text="Комментарий")

    class Meta:
        ordering = ["-created_at"]
        verbose_name = "Расчет"
        verbose_name_plural = "Расчеты"

    def __str__(self) -> str:
        type_name = self.insurance_type.name if self.insurance_type else "-"
        company_name = self.insurance_company.name if self.insurance_company else "-"
        return f"{type_name} - {company_name}"
