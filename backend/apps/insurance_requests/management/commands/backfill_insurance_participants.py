from apps.insurance_requests.signals import backfill_participants
from django.core.management.base import BaseCommand


class Command(BaseCommand):
    help = "Add missing participants without reactivating removed records."

    def handle(self, *args, **options):
        self.stdout.write(str(backfill_participants()))
