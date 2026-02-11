from apps.users.models import UserRole


def is_admin_user(user) -> bool:
    if not user or not user.is_authenticated:
        return False
    if user.is_superuser:
        return True
    return UserRole.objects.filter(user=user, role__name="Admin").exists()


def is_deal_seller(user, deal) -> bool:
    if not user or not user.is_authenticated or not deal:
        return False
    return deal.seller_id == getattr(user, "id", None)


def is_deal_executor(user, deal) -> bool:
    if not user or not user.is_authenticated or not deal:
        return False
    return deal.executor_id == getattr(user, "id", None)


def can_manage_deal_mailbox(user, deal) -> bool:
    if not user or not user.is_authenticated or not deal:
        return False
    return is_deal_seller(user, deal) or is_deal_executor(user, deal)


def can_modify_deal(user, deal) -> bool:
    if not user or not user.is_authenticated or not deal:
        return False
    return is_admin_user(user) or is_deal_seller(user, deal)


def can_merge_deals(user, deal) -> bool:
    if not user or not user.is_authenticated or not deal:
        return False
    return is_admin_user(user) or is_deal_seller(user, deal)
