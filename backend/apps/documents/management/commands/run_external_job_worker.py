import time

from apps.documents.external_jobs import process_next_external_job
from django.conf import settings
from django.core.management.base import BaseCommand


class Command(BaseCommand):
    help = "Обрабатывает DB-backed задания долгих внешних интеграций."

    def add_arguments(self, parser):
        parser.add_argument(
            "--once",
            action="store_true",
            help="Обработать не более одного задания и завершиться.",
        )
        parser.add_argument("--poll-seconds", type=float, default=None)

    def handle(self, *args, **options):
        poll_seconds = options["poll_seconds"]
        if poll_seconds is None:
            poll_seconds = getattr(settings, "EXTERNAL_JOB_POLL_SECONDS", 1.0)
        while True:
            processed = process_next_external_job()
            if options["once"]:
                return
            if not processed:
                time.sleep(max(0.1, poll_seconds))
