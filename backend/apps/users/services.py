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

    return RolePermission.objects.filter(
        role__userrole__user=user,
        permission__resource=resource,
        permission__action=action,
        permission__deleted_at__isnull=True,
    ).exists()
