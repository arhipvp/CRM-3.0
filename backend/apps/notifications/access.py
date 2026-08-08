from django.conf import settings


def is_drive_reconnect_user(user) -> bool:
    """Return whether the configured Drive owner may rotate OAuth credentials."""
    if not getattr(user, "is_authenticated", False):
        return False

    allowed_id = int(getattr(settings, "GOOGLE_DRIVE_RECONNECT_ALLOWED_USER_ID", 4))
    allowed_username = str(
        getattr(settings, "GOOGLE_DRIVE_RECONNECT_ALLOWED_USERNAME", "Vova") or ""
    ).strip()
    if allowed_username and user.username == allowed_username:
        return True
    return bool(allowed_id and user.id == allowed_id)
