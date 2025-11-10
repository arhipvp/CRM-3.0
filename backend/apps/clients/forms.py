from django import forms
from django.core.exceptions import ValidationError

from .models import Client


class ClientAdminForm(forms.ModelForm):
    """
    Форма для админ-интерфейса клиентов с валидацией.
    """

    class Meta:
        model = Client
        fields = ('name', 'phone', 'birth_date')

    def clean_name(self):
        """Валидация имени клиента."""
        name = self.cleaned_data.get('name', '').strip()
        if not name:
            raise ValidationError("Имя клиента не может быть пустым.")
        if len(name) < 2:
            raise ValidationError("Имя клиента должно содержать минимум 2 символа.")
        if len(name) > 255:
            raise ValidationError("Имя клиента слишком длинное (максимум 255 символов).")
        return name

    def clean_phone(self):
        """Валидация телефона."""
        phone = self.cleaned_data.get('phone', '').strip()
        if phone:
            # Оставляем только цифры, скобки, дефисы, пробелы
            import re
            if not re.match(r'^[\d\s\(\)\-\+]*$', phone):
                raise ValidationError("Телефон содержит недопустимые символы.")
        return phone

    def clean_birth_date(self):
        """Валидация даты рождения."""
        from datetime import date

        birth_date = self.cleaned_data.get('birth_date')
        if birth_date:
            if birth_date > date.today():
                raise ValidationError("Дата рождения не может быть в будущем.")
            age = (date.today() - birth_date).days // 365
            if age > 150:
                raise ValidationError("Некорректная дата рождения (возраст > 150 лет).")
        return birth_date

    def clean(self):
        """Общая валидация формы."""
        cleaned_data = super().clean()
        name = cleaned_data.get('name', '').strip()
        phone = cleaned_data.get('phone', '').strip()

        if not name and not phone:
            raise ValidationError(
                "Необходимо указать хотя бы имя или телефон клиента."
            )

        return cleaned_data
