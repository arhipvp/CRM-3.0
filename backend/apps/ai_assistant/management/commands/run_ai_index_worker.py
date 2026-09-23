from __future__ import annotations

import time

from apps.ai_assistant.worker import process_next_document
from django.core.management.base import BaseCommand
from django.db import close_old_connections


class Command(BaseCommand):
    help = "Index uploaded insurance documents outside the answer worker."

    def add_arguments(self, parser):
        parser.add_argument("--once", action="store_true")
        parser.add_argument("--poll-seconds", type=float, default=2)

    def handle(self, *args, **options):
        while True:
            close_old_connections()
            worked = process_next_document()
            if options["once"]:
                break
            if not worked:
                time.sleep(max(0.2, options["poll_seconds"]))
