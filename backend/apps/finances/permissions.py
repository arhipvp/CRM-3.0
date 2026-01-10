from apps.users.models import UserRole


def is_admin_user(user) -> bool:
    if not user or not user.is_authenticated:
        return False
    return UserRole.objects.filter(user=user, role__name="Admin").exists()


def get_deal_from_payment(payment):
    if not payment:
        return None
    deal = getattr(payment, "deal", None)
    if deal:
        return deal
    policy = getattr(payment, "policy", None)
    if policy:
        return getattr(policy, "deal", None)
    return None


def user_has_deal_access(user, deal, *, allow_executor=True) -> bool:
    if not user or not user.is_authenticated:
        return False
    if is_admin_user(user):
        return True
    if not deal:
        return False
    if allow_executor:
        return deal.seller_id == user.id or deal.executor_id == user.id
    return deal.seller_id == user.id


def parse_bool(value) -> bool:
    if value is None:
        return False
    return str(value).strip().lower() in {"1", "true", "yes", "y", "on"}
