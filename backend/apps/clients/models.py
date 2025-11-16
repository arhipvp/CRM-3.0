from apps.common.models import SoftDeleteModel
from django.db import models


class Client(SoftDeleteModel):
    """Клиент - страхователь"""

    name = models.CharField(max_length=255, help_text="Имя клиента")
    phone = models.CharField(max_length=20, blank=True, help_text="Контактный телефон")
    birth_date = models.DateField(null=True, blank=True, help_text="Дата рождения")
    notes = models.TextField(blank=True, help_text="Примечание о клиенте")
    drive_folder_id = models.CharField(
        max_length=255, blank=True, null=True, help_text="Google Drive folder ID"
    )

    class Meta:
        ordering = ["name"]

    def __str__(self) -> str:
        return self.name
