from django.contrib.admin.widgets import AdminFileWidget


class SafeAdminFileWidget(AdminFileWidget):
    """
    Django's ClearableFileInput (used by AdminFileWidget) calls `value.url` inside
    `is_initial()`. If the stored file name is invalid/corrupted, `value.url` may
    raise (ValueError/SuspiciousFileOperation/etc.) and break admin pages.
    """

    def is_initial(self, value):
        if not value:
            return False
        try:
            return bool(getattr(value, "url", False))
        except Exception:
            return False
