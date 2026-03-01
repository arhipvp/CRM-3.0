from django.test import SimpleTestCase

from .services import extract_quota_left


class ExtractQuotaLeftTests(SimpleTestCase):
    def test_extracts_quota_from_left_exceeded_error(self):
        self.assertEqual(
            extract_quota_left("mailbox_quota_left_exceeded (quota left: 128)"),
            128,
        )

    def test_extracts_quota_from_quota_exceeded_error(self):
        self.assertEqual(extract_quota_left("mailbox_quota_exceeded, 20"), 20)

    def test_returns_none_for_unrelated_error(self):
        self.assertIsNone(extract_quota_left("some_other_error"))

    def test_returns_none_when_value_is_not_positive(self):
        self.assertIsNone(extract_quota_left("mailbox_quota_exceeded, 0"))
