"""Guard settlement dates at the public financial-write boundaries."""

from rest_framework.exceptions import ValidationError

RECORD_DATE_ERROR = (
    "Дата финансовой записи меняется только через выплату ведомости "
    "или отмену её выплаты."
)


def validate_record_date(data, *, current_date=None):
    if "date" in data and data["date"] != current_date:
        raise ValidationError({"date": RECORD_DATE_ERROR})
