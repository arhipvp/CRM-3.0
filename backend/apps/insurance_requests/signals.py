from django.db import connections
from django.db.models.signals import post_migrate, post_save
from django.dispatch import receiver

from .models import DealParticipant


@receiver(post_save, sender="deals.Deal")
@receiver(post_save, sender="policies.Policy")
def add_participant(sender, instance, raw=False, **kwargs):
    if raw or not instance.client_id or instance.deleted_at:
        return
    deal_id = (
        instance.pk if sender._meta.label_lower == "deals.deal" else instance.deal_id
    )
    if (
        not DealParticipant.objects.with_deleted()
        .filter(deal_id=deal_id, client_id=instance.client_id)
        .exists()
    ):
        DealParticipant.objects.create(deal_id=deal_id, client_id=instance.client_id)


@receiver(post_migrate)
def initialize_participants(sender, using="default", apps=None, **kwargs):
    if sender.label != "insurance_requests":
        return
    backfill_participants(using=using, apps=apps)


def backfill_participants(using="default", apps=None):
    if apps is None:
        from django.apps import apps
    try:
        Deal = apps.get_model("deals", "Deal")
        Policy = apps.get_model("policies", "Policy")
        Participant = apps.get_model("insurance_requests", "DealParticipant")
    except LookupError:
        return 0
    tables = set(connections[using].introspection.table_names())
    if not {model._meta.db_table for model in (Deal, Policy, Participant)} <= tables:
        return 0

    count = 0
    pairs = set(
        Deal._base_manager.using(using)
        .filter(deleted_at__isnull=True)
        .exclude(client_id=None)
        .values_list("pk", "client_id")
    )
    pairs.update(
        Policy._base_manager.using(using)
        .filter(deleted_at__isnull=True, deal__deleted_at__isnull=True)
        .exclude(client_id=None)
        .values_list("deal_id", "client_id")
    )
    for deal_id, client_id in pairs:
        if (
            not Participant._base_manager.using(using)
            .filter(deal_id=deal_id, client_id=client_id)
            .exists()
        ):
            Participant._base_manager.using(using).create(
                deal_id=deal_id, client_id=client_id
            )
            count += 1
    return count


@receiver(post_save, sender="deals.Quote")
def mark_variant_quoted(sender, instance, raw=False, **kwargs):
    if raw or not instance.request_variant_id or instance.deleted_at:
        return
    from django.db.models import F

    from .models import RequestVariant

    RequestVariant.objects.filter(
        pk=instance.request_variant_id,
        is_current=True,
        insurance_request__is_current=True,
        request_version__number=F("insurance_request__version"),
    ).update(status="quoted", explanation="")
