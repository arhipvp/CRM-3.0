from django.conf import settings
from django.db import models
from apps.common.models import SoftDeleteModel


class Deal(SoftDeleteModel):
    """
    Сделка - центральная сущность системы.
    Замыкает на себя клиента, продавца, исполнителя, полисы и прочие сущности.
    """

    class DealStatus(models.TextChoices):
        OPEN = 'open', 'Открыта'
        WON = 'won', 'Выиграна'
        LOST = 'lost', 'Потеряна'
        ON_HOLD = 'on_hold', 'В ожидании'

    title = models.CharField(max_length=255, help_text="Название сделки")
    description = models.TextField(blank=True, help_text="Описание сделки")

    # Основные связи
    client = models.ForeignKey(
        'clients.Client',
        related_name='deals',
        on_delete=models.PROTECT,
        help_text="Клиент"
    )

    # Участники сделки
    seller = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        related_name='sold_deals',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        help_text="Продавец"
    )
    executor = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        related_name='executed_deals',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        help_text="Исполнитель"
    )

    # Параметры
    probability = models.PositiveIntegerField(default=0, help_text="Вероятность (0-100%)")

    # Статус и этап
    status = models.CharField(
        max_length=20,
        choices=DealStatus.choices,
        default=DealStatus.OPEN,
        help_text="Статус сделки"
    )
    stage_name = models.CharField(max_length=120, blank=True, help_text="Этап")

    # Даты
    expected_close = models.DateField(null=True, blank=True, help_text="Ожидаемая дата закрытия")

    # Дополнительная информация
    source = models.CharField(max_length=100, blank=True, help_text="Источник")
    loss_reason = models.CharField(max_length=255, blank=True, help_text="Причина отказа")
    channel = models.CharField(max_length=100, blank=True, help_text="Канал продаж")

    class Meta:
        ordering = ['-created_at']
        verbose_name = 'Сделка'
        verbose_name_plural = 'Сделки'

    def __str__(self) -> str:
        return self.title
