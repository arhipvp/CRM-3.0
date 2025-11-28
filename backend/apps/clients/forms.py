import re
from datetime import date

from django import forms
from django.core.exceptions import ValidationError

from .models import Client


class ClientAdminForm(forms.ModelForm):
    """Форма админки клиентов."""

    class Meta:
        model = Client
        fields = ("name", "phone", "email", "birth_date", "notes")

    def clean_name(self):
        name = self.cleaned_data.get("name", "").strip()
        if not name:
            raise ValidationError("Имя клиента должно быть заполнено.")
        if len(name) < 2:
            raise ValidationError("Имя клиента должно содержать минимум 2 символа.")
        if len(name) > 255:
            raise ValidationError("Имя клиента не может превышать 255 символов.")
        return name

    def clean_phone(self):
        phone = self.cleaned_data.get("phone", "").strip()
        if phone and not re.match(r"^[\d\s\(\)\-\+]*$", phone):
            raise ValidationError(
                "Телефон может содержать только цифры и служебные символы."
            )
        return phone

    def clean_birth_date(self):
        birth_date = self.cleaned_data.get("birth_date")
        if birth_date and birth_date > date.today():
            raise ValidationError("Дата рождения не может быть в будущем.")
        if birth_date and (date.today() - birth_date).days // 365 > 150:
            raise ValidationError("Проверьте корректность даты рождения.")
        return birth_date

    def clean(self):
        cleaned_data = super().clean()
        name = cleaned_data.get("name", "").strip()
        phone = cleaned_data.get("phone", "").strip()
        email = cleaned_data.get("email", "").strip()
        if not name and not (phone or email):
            raise ValidationError(
                "Provide at least a phone number or an email address."
            )
        return cleaned_data
