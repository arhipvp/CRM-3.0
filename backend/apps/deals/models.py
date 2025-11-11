from django.conf import settings
from django.db import models

from apps.common.models import SoftDeleteModel


class Deal(SoftDeleteModel):
    """Сделка и её основные атрибуты."""

    class DealStatus(models.TextChoices):
        OPEN = "open", "В работе"
        WON = "won", "Выиграна"
        LOST = "lost", "Закрыта (проиграна)"
        ON_HOLD = "on_hold", "На паузе"

    title = models.CharField(max_length=255, help_text="Название сделки")
    description = models.TextField(blank=True, help_text="Описание сделки")

    client = models.ForeignKey(
        "clients.Client",
        related_name="deals",
        on_delete=models.PROTECT,
        help_text="Клиент"
    )

    seller = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        related_name="sold_deals",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        help_text="Менеджер"
    )
    executor = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        related_name="executed_deals",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        help_text="Исполнитель"
    )

    probability = models.PositiveIntegerField(default=0, help_text="Вероятность (0-100%)")

    status = models.CharField(
        max_length=20,
        choices=DealStatus.choices,
        default=DealStatus.OPEN,
        help_text="Статус сделки"
    )
    stage_name = models.CharField(max_length=120, blank=True, help_text="Стадия")

    expected_close = models.DateField(null=True, blank=True, help_text="Плановая дата закрытия")
    next_review_date = models.DateField(null=True, blank=True, help_text="Дата следующего контакта")

    source = models.CharField(max_length=100, blank=True, help_text="Источник")
    loss_reason = models.CharField(max_length=255, blank=True, help_text="Причина проигрыша")
    channel = models.CharField(max_length=100, blank=True, help_text="Канал продаж")

    class Meta:
        ordering = ["next_review_date", "-created_at"]
        verbose_name = "Сделка"
        verbose_name_plural = "Сделки"

    def __str__(self) -> str:
        return self.title


class Quote(SoftDeleteModel):
    """Расчет страхового продукта, подготовленный по сделке."""

    deal = models.ForeignKey("deals.Deal", related_name="quotes", on_delete=models.CASCADE)
    insurer = models.CharField(max_length=255, help_text="Страховая компания")
    insurance_type = models.CharField(max_length=120, help_text="Тип страхования")
    sum_insured = models.DecimalField(max_digits=14, decimal_places=2, help_text="Страховая сумма")
    premium = models.DecimalField(max_digits=12, decimal_places=2, help_text="Премия")
    deductible = models.CharField(max_length=255, blank=True, help_text="Франшиза")
    comments = models.TextField(blank=True, help_text="Комментарий")

    class Meta:
        ordering = ["-created_at"]
        verbose_name = "Расчет"
        verbose_name_plural = "Расчеты"

    def __str__(self) -> str:
        return f"{self.insurance_type} — {self.insurer}"


class ActivityLog(models.Model):
    """Журнал действий по сделке для отслеживания изменений."""

    class ActionType(models.TextChoices):
        CREATED = "created", "Создано"
        STATUS_CHANGED = "status_changed", "Изменен статус"
        STAGE_CHANGED = "stage_changed", "Изменена стадия"
        DESCRIPTION_UPDATED = "description_updated", "Обновлено описание"
        ASSIGNED = "assigned", "Назначено"
        POLICY_CREATED = "policy_created", "Создан полис"
        QUOTE_ADDED = "quote_added", "Добавлен расчет"
        DOCUMENT_UPLOADED = "document_uploaded", "Загружен документ"
        PAYMENT_CREATED = "payment_created", "Создан платеж"
        COMMENT_ADDED = "comment_added", "Добавлен комментарий"
        CUSTOM = "custom", "Пользовательское действие"

    deal = models.ForeignKey(
        Deal,
        related_name="activity_logs",
        on_delete=models.CASCADE,
        help_text="Сделка"
    )

    action_type = models.CharField(
        max_length=50,
        choices=ActionType.choices,
        default=ActionType.CUSTOM,
        help_text="Тип действия"
    )

    description = models.TextField(help_text="Описание действия")

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        help_text="Пользователь, выполнивший действие"
    )

    old_value = models.TextField(blank=True, help_text="Старое значение")
    new_value = models.TextField(blank=True, help_text="Новое значение")

    created_at = models.DateTimeField(auto_now_add=True, help_text="Время действия")

    class Meta:
        ordering = ["-created_at"]
        verbose_name = "Лог активности"
        verbose_name_plural = "Логи активности"
        indexes = [
            models.Index(fields=["deal", "-created_at"]),
        ]

    def __str__(self) -> str:
        return f"{self.deal.title} — {self.get_action_type_display()} ({self.created_at.strftime('%d.%m.%Y %H:%M')})"
