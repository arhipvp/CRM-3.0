from decimal import Decimal

from django.db.models import Sum

from ..models import FinancialRecord, Payment


def recalculate_payment_paid_balance(payment_id) -> Decimal:
    if not payment_id:
        return Decimal("0")
    total = FinancialRecord.objects.filter(
        payment_id=payment_id, date__isnull=False
    ).aggregate(total=Sum("amount"))["total"] or Decimal("0")
    Payment.objects.with_deleted().filter(pk=payment_id).update(paid_balance=total)
    return total


def recalculate_payment_paid_balances(payment_ids) -> None:
    for payment_id in set(filter(None, payment_ids)):
        recalculate_payment_paid_balance(payment_id)
