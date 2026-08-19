from apps.finances.models import Payment
from apps.finances.services.balances import recalculate_payment_paid_balances
from django.core.management.base import BaseCommand


class Command(BaseCommand):
    help = "Recalculate denormalized paid balances for all payments."

    def handle(self, *args, **options):
        payment_ids = (
            Payment.objects.with_deleted().values_list("id", flat=True).iterator()
        )
        recalculate_payment_paid_balances(payment_ids)
        self.stdout.write(self.style.SUCCESS("Paid balances recalculated."))
