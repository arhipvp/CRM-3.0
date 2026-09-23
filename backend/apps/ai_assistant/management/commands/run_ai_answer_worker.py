from __future__ import annotations

import logging
import os
import threading
import time
import uuid

from apps.ai_assistant.worker import process_next_answer, recover_interrupted_runs
from django.core.management.base import BaseCommand
from django.db import close_old_connections

logger = logging.getLogger(__name__)


class Command(BaseCommand):
    help = "Process durable AI answer jobs independently of browser connections."

    def add_arguments(self, parser):
        parser.add_argument("--once", action="store_true")
        parser.add_argument("--poll-seconds", type=float, default=2)
        parser.add_argument(
            "--concurrency",
            type=int,
            default=int(os.getenv("AI_ANSWER_CONCURRENCY", "2")),
        )

    def handle(self, *args, **options):
        worker_id = str(uuid.uuid4())
        if options["once"]:
            recover_interrupted_runs()
            process_next_answer(worker_id)
            return

        def answer_loop(slot: int):
            slot_id = f"{worker_id}:{slot}"
            while True:
                try:
                    close_old_connections()
                    worked = process_next_answer(slot_id)
                except Exception:
                    logger.exception("AI answer worker slot %s crashed", slot)
                    worked = False
                if not worked:
                    time.sleep(max(0.2, options["poll_seconds"]))

        for slot in range(max(1, options["concurrency"])):
            threading.Thread(target=answer_loop, args=(slot,), daemon=True).start()
        while True:
            close_old_connections()
            recover_interrupted_runs()
            time.sleep(5)
