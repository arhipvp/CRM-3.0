from django.db import models

from apps.common.models import SoftDeleteModel


class Client(SoftDeleteModel):
    """Клиент - страхователь"""

    name = models.CharField(max_length=255, help_text="Имя клиента")
    phone = models.CharField(max_length=20, blank=True, help_text="Контактный телефон")
    birth_date = models.DateField(null=True, blank=True, help_text="Дата рождения")
    notes = models.TextField(blank=True, help_text="Примечание о клиенте")

    class Meta:
        ordering = ["name"]

    def __str__(self) -> str:
        return self.name
