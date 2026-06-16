from apps.finances.models import FinancialRecord
from django.core.exceptions import ValidationError as DjangoValidationError
from rest_framework.exceptions import ValidationError as DRFValidationError

from ..models import Policy


def delete_policy_with_rules(policy: Policy) -> None:
    paid_payments = policy.payments.filter(
        actual_date__isnull=False,
        deleted_at__isnull=True,
    )
    if paid_payments.exists():
        raise DRFValidationError(
            {"detail": "Нельзя удалить полис: есть оплаченные платежи."}
        )

    paid_records = FinancialRecord.objects.filter(
        payment__policy=policy,
        payment__deleted_at__isnull=True,
        date__isnull=False,
        deleted_at__isnull=True,
    )
    if paid_records.exists():
        raise DRFValidationError(
            {"detail": "Нельзя удалить полис: есть оплаченные финансовые записи."}
        )

    try:
        policy.delete()
    except DjangoValidationError as exc:
        raise DRFValidationError(exc.messages) from exc
