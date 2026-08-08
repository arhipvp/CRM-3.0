from apps.common.middleware import PerformanceTimingMiddleware
from django.http import HttpResponse, StreamingHttpResponse
from django.test import RequestFactory, SimpleTestCase, override_settings


class PerformanceTimingMiddlewareTests(SimpleTestCase):
    def setUp(self):
        self.request = RequestFactory().get("/health/")

    @override_settings(PERFORMANCE_TIMING_ENABLED=False)
    def test_does_not_add_headers_when_disabled(self):
        response = PerformanceTimingMiddleware(lambda request: HttpResponse("ok"))(
            self.request
        )

        self.assertNotIn("Server-Timing", response)

    @override_settings(PERFORMANCE_TIMING_ENABLED=True, DEBUG=False)
    def test_adds_duration_and_payload_headers(self):
        response = PerformanceTimingMiddleware(lambda request: HttpResponse("ok"))(
            self.request
        )

        self.assertIn("app;dur=", response["Server-Timing"])
        self.assertEqual(response["X-Response-Bytes"], "2")

    @override_settings(PERFORMANCE_TIMING_ENABLED=True, DEBUG=False)
    def test_streaming_response_has_no_payload_size_header(self):
        response = PerformanceTimingMiddleware(
            lambda request: StreamingHttpResponse(iter([b"ok"]))
        )(self.request)

        self.assertIn("Server-Timing", response)
        self.assertNotIn("X-Response-Bytes", response)
