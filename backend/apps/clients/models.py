from django.db import models
from apps.common.models import SoftDeleteModel


class Client(SoftDeleteModel):
    """Клиент - персона"""

    name = models.CharField(max_length=255, help_text="ФИО клиента")
    phone = models.CharField(max_length=20, blank=True, help_text="Номер телефона")
    birth_date = models.DateField(null=True, blank=True, help_text="Дата рождения")

    class Meta:
        ordering = ['name']

    def __str__(self) -> str:
        return self.name
