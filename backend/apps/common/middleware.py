import time

from django.conf import settings
from django.db import connection


class PerformanceTimingMiddleware:
    """Expose opt-in request timing data for local and staging diagnostics."""

    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        if not settings.PERFORMANCE_TIMING_ENABLED:
            return self.get_response(request)

        query_count_before = len(connection.queries)
        started_at = time.perf_counter()
        response = self.get_response(request)
        duration_ms = (time.perf_counter() - started_at) * 1000
        query_count = max(0, len(connection.queries) - query_count_before)

        metrics = [f"app;dur={duration_ms:.1f}"]
        if settings.DEBUG:
            metrics.append(f'db;desc="{query_count} queries"')
        response["Server-Timing"] = ", ".join(metrics)
        response["X-Response-Time-Ms"] = f"{duration_ms:.1f}"
        if not response.streaming:
            response["X-Response-Bytes"] = str(len(response.content))
        return response
