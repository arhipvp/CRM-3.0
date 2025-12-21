from apps.common.admin_widgets import SafeAdminFileWidget
from django.test import SimpleTestCase


class SafeAdminFileWidgetTests(SimpleTestCase):
    def test_is_initial_returns_false_when_url_raises(self):
        class BrokenValue:
            @property
            def url(self):
                raise ValueError("broken file url")

        widget = SafeAdminFileWidget()
        self.assertFalse(widget.is_initial(BrokenValue()))

    def test_is_initial_returns_true_when_url_exists(self):
        class OkValue:
            url = "/media/x.pdf"

        widget = SafeAdminFileWidget()
        self.assertTrue(widget.is_initial(OkValue()))
