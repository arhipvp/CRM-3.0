from django.contrib.auth.models import AnonymousUser, User

from .models import RolePermission


def user_has_permission(
    user: User | AnonymousUser | None, resource: str, action: str
) -> bool:
    """
    Returns True when the authenticated user holds the specified permission via
    their assigned roles.
    """
    if not user or not user.is_authenticated:
        return False

    user_id = getattr(user, "id", None)
    if not user_id:
        return False

    return RolePermission.objects.filter(
        role__userrole__user_id=user_id,
        permission__resource=resource,
        permission__action=action,
        permission__deleted_at__isnull=True,
    ).exists()
