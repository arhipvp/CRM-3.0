import openai
from apps.common.ai_errors import classify_ai_error, sanitize_provider_text
from django.test import SimpleTestCase


class _HttpError(Exception):
    def __init__(self, status_code: int, body: str = "provider message") -> None:
        self.status_code = status_code
        self.body = body
        super().__init__(body)


class AIErrorClassificationTests(SimpleTestCase):
    def test_http_errors_are_classified(self):
        cases = [
            (402, "ai_insufficient_funds", False),
            (408, "ai_timeout", True),
            (429, "ai_rate_limited", True),
            (401, "ai_authentication_failed", False),
            (403, "ai_authentication_failed", False),
            (502, "ai_provider_unavailable", True),
            (503, "ai_provider_unavailable", True),
            (400, "ai_invalid_request", False),
        ]
        for status_code, code, retryable in cases:
            with self.subTest(status_code=status_code):
                error = classify_ai_error(
                    _HttpError(status_code, "<b>Provider explanation</b>"),
                    timeout_seconds=30,
                )
                self.assertEqual(error.code, code)
                self.assertEqual(error.retryable, retryable)
                self.assertIn("Provider explanation", error.message)
                self.assertNotIn("<b>", error.message)

    def test_network_error_is_retryable_provider_unavailable(self):
        class NetworkError(openai.APIConnectionError):
            pass

        error = classify_ai_error(NetworkError.__new__(NetworkError))
        self.assertEqual(error.code, "ai_provider_unavailable")
        self.assertTrue(error.retryable)

    def test_unknown_error_uses_safe_fallback(self):
        error = classify_ai_error(RuntimeError("unexpected"))
        self.assertEqual(error.code, "ai_unknown_error")
        self.assertTrue(error.retryable)
        self.assertNotIn("unexpected", error.message)

    def test_provider_text_is_limited_and_redacted(self):
        text = sanitize_provider_text("<p>Oops bearer secret-token</p>" + "x" * 600)
        self.assertNotIn("<p>", text)
        self.assertNotIn("secret-token", text)
        self.assertLessEqual(len(text), 500)
