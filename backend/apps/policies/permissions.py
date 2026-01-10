from apps.deals.models import Deal
from apps.users.models import UserRole


def user_is_admin(user) -> bool:
    if not user or not user.is_authenticated:
        return False
    return UserRole.objects.filter(user=user, role__name="Admin").exists()


def user_can_modify_deal(user, deal: Deal | None) -> bool:
    if not user or not user.is_authenticated:
        return False
    if user_is_admin(user):
        return True
    if not deal:
        return False
    return deal.seller_id == user.id or deal.executor_id == user.id
