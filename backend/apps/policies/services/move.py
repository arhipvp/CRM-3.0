from apps.common.drive import (
    DriveError,
    ensure_deal_folder,
    ensure_policy_folder_for_deal,
    move_drive_folder_to_parent,
)
from apps.deals.models import Deal
from apps.finances.models import Payment
from django.db import transaction
from rest_framework.exceptions import PermissionDenied, ValidationError

from ..models import Policy
from ..permissions import user_is_admin


def move_policy_to_deal(policy: Policy, target_deal: Deal, user) -> Policy:
    source_deal = policy.deal
    if not user or not user.is_authenticated:
        raise PermissionDenied("Нет доступа к сделке.")
    if not user_is_admin(user) and source_deal.seller_id != user.id:
        raise PermissionDenied("Только продавец исходной сделки может перенести полис.")
    if target_deal.pk == source_deal.pk:
        raise ValidationError({"deal": "Полис уже находится в выбранной сделке."})

    if policy.drive_folder_id:
        target_folder_id = ensure_deal_folder(target_deal)
        if not target_folder_id:
            raise DriveError("Папка целевой сделки не найдена.")
        move_drive_folder_to_parent(policy.drive_folder_id, target_folder_id)
        policy_folder_id = policy.drive_folder_id
    else:
        policy_folder_id = ensure_policy_folder_for_deal(policy, target_deal)

    with transaction.atomic():
        policy.deal = target_deal
        if policy_folder_id:
            policy.drive_folder_id = policy_folder_id
        policy.save(update_fields=["deal", "drive_folder_id", "updated_at"])
        Payment.objects.filter(policy=policy, deleted_at__isnull=True).update(
            deal=target_deal
        )

    return policy
