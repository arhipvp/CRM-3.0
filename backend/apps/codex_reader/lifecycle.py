"""Scoped, reversible Codex lifecycle changes with dependency inspection."""

from apps.insurance_requests import models as domain
from apps.insurance_requests.services import record_data
from django.db import models
from django.db.models import Q
from django.utils import timezone
from rest_framework import serializers

from .preparation import (
    DOCUMENTS,
    ENTITIES,
)
from .preparation import baseline as preparation_baseline
from .preparation import (
    digest,
    plain,
)
from .write_views import StrictSerializer

MODELS = {
    name: serializer.Meta.model
    for name, serializer in ENTITIES.items()
    if name not in {"client", "platform"}
}
MODELS["variant"] = domain.RequestVariant


class LifecycleOperation(StrictSerializer):
    ref = serializers.RegexField(r"^[A-Za-z][A-Za-z0-9_]{0,63}$")
    entity = serializers.ChoiceField(choices=list(MODELS))
    id = serializers.UUIDField()
    action = serializers.ChoiceField(
        choices=[
            "activate",
            "deactivate",
            "delete",
            "restore",
            "close",
            "reopen",
            "set_status",
        ]
    )
    source = serializers.CharField(max_length=1000)
    status = serializers.ChoiceField(
        choices=["pending", "declined", "failed"], required=False
    )
    explanation = serializers.CharField(
        max_length=5000, required=False, allow_blank=True
    )

    def validate(self, attrs):
        entity, action = attrs["entity"], attrs["action"]
        allowed = (
            {"close", "reopen", "delete", "restore"}
            if entity == "request"
            else (
                {"set_status"}
                if entity == "variant"
                else {"activate", "deactivate", "delete", "restore"}
            )
        )
        if action not in allowed:
            raise serializers.ValidationError("Unsupported action for this entity.")
        if action == "set_status":
            if "status" not in attrs or (
                attrs["status"] != "pending"
                and not attrs.get("explanation", "").strip()
            ):
                raise serializers.ValidationError(
                    "Status and a reason for failure/refusal are required."
                )
        elif "status" in attrs or "explanation" in attrs:
            raise serializers.ValidationError("Status fields only apply to variants.")
        return attrs


class LifecycleInput(StrictSerializer):
    operations = LifecycleOperation(many=True, allow_empty=False)

    def validate_operations(self, values):
        if (
            len(values) > 50
            or len({op["ref"] for op in values}) != len(values)
            or len({(op["entity"], op["id"]) for op in values}) != len(values)
        ):
            raise serializers.ValidationError(
                "At most 50 unique refs and records required."
            )
        return values


class LifecycleApplyInput(LifecycleInput):
    preview_token = serializers.CharField(max_length=4000)
    confirmations = serializers.ListField(child=serializers.DictField())


def scoped_record(deal, entity, pk):
    obj = (
        MODELS[entity].objects.with_deleted().select_for_update().filter(pk=pk).first()
    )
    if obj is None:
        raise serializers.ValidationError("Record unavailable in this deal.")
    if entity in {"passport", "driver_license"}:
        valid = (
            not obj.client.deleted_at
            and domain.DealParticipant.objects.with_deleted()
            .filter(deal=deal, client_id=obj.client_id)
            .exists()
        )
    else:
        owner = (
            obj.insurance_request.deal_id
            if entity == "variant"
            else (
                obj.vehicle.deal_id
                if entity in {"vehicle_registration", "vehicle_title"}
                else (
                    obj.mortgage.deal_id
                    if entity == "mortgage_balance"
                    else obj.deal_id
                )
            )
        )
        valid = owner == deal.pk
    if not valid:
        raise serializers.ValidationError("Record unavailable in this deal.")
    return obj


def person_condition(person):
    return (
        Q(policyholder_id=person)
        | Q(owner_id=person)
        | Q(borrower_id=person)
        | Q(insured_person_id=person)
        | Q(drivers__pk=person)
    )


def dependencies(obj, entity):
    qs = domain.InsuranceRequest.objects.filter(
        is_current=True, deal__deleted_at__isnull=True
    )
    if entity in {"participant", "passport", "driver_license"}:
        qs = qs.filter(person_condition(obj.client_id))
        if entity == "participant":
            qs = qs.filter(deal_id=obj.deal_id)
    elif entity == "vehicle":
        qs = qs.filter(vehicle=obj)
    elif entity in {"vehicle_registration", "vehicle_title"}:
        qs = qs.filter(vehicle_id=obj.vehicle_id)
    elif entity == "mortgage":
        qs = qs.filter(mortgage=obj)
    elif entity == "mortgage_balance":
        qs = qs.filter(mortgage_balance=obj)
    else:
        return []
    return [
        {"id": str(r.pk), "title": r.title, "deal_id": str(r.deal_id)}
        for r in qs.distinct().order_by("pk")
    ]


def baseline(deal, operations):
    state = {"preparation": preparation_baseline(deal, operations)}
    people = set(
        domain.DealParticipant.objects.with_deleted()
        .filter(deal=deal)
        .values_list("client_id", flat=True)
    )
    condition = Q(deal=deal)
    for person in people:
        condition |= person_condition(person)
    # Lock cross-deal requests too: personal documents are shared.
    ids = list(
        domain.InsuranceRequest.objects.with_deleted()
        .filter(condition)
        .values_list("pk", flat=True)
        .distinct()
    )
    requests = list(
        domain.InsuranceRequest.objects.with_deleted()
        .select_for_update()
        .filter(pk__in=ids)
        .order_by("pk")
    )
    state["requests"] = [
        {
            **record_data(r),
            "updated_at": r.updated_at,
            "deleted_at": r.deleted_at,
            "drivers": sorted(str(pk) for pk in r.drivers.values_list("pk", flat=True)),
        }
        for r in requests
    ]
    variants = list(
        domain.RequestVariant.objects.with_deleted()
        .select_for_update()
        .filter(insurance_request_id__in=ids)
        .order_by("pk")
    )
    state["variants"] = [
        {
            **record_data(v),
            "updated_at": v.updated_at,
            "deleted_at": v.deleted_at,
            "quotes": sorted(
                str(pk) for pk in v.quotes.with_deleted().values_list("pk", flat=True)
            ),
        }
        for v in variants
    ]
    return digest(state)


def audit(obj, before, source):
    domain.RecordHistory.objects.create(
        model_name=obj._meta.label_lower,
        record_id=obj.pk,
        actor=None,
        action="codex_lifecycle",
        snapshot={
            "author": "Codex",
            "source": source,
            "before": plain(before),
            "after": plain(record_data(obj)),
        },
    )


def availability(obj, entity):
    if entity == "participant":
        return not obj.client.deleted_at
    if entity in {"passport", "driver_license"}:
        return not obj.client.deleted_at
    if entity in {"vehicle_registration", "vehicle_title"}:
        return not obj.vehicle.deleted_at and obj.vehicle.is_current
    if entity == "mortgage_balance":
        return not obj.mortgage.deleted_at and obj.mortgage.is_current
    return True


def reopen_errors(obj):
    errors = []
    target = obj.vehicle or obj.mortgage
    if target.deleted_at or not target.is_current:
        errors.append("Object is deleted or inactive.")
    people = set(obj.drivers.values_list("pk", flat=True))
    people.update(
        getattr(obj, role + "_id")
        for role in ("policyholder", "owner", "borrower", "insured_person")
        if getattr(obj, role + "_id")
    )
    available = set(
        domain.DealParticipant.objects.filter(
            deal_id=obj.deal_id, is_current=True, client__deleted_at__isnull=True
        ).values_list("client_id", flat=True)
    )
    if people - available:
        errors.append("A selected person is unavailable in this deal.")
    if obj.mortgage_balance_id and (
        obj.mortgage_balance.deleted_at or not obj.mortgage_balance.is_current
    ):
        errors.append("Selected mortgage balance is unavailable.")
    return errors


def run_operations(deal, operations):
    results, changes, confirmations, blockers, affected = [], [], [], [], []
    for op in operations:
        entity, action = op["entity"], op["action"]
        obj = scoped_record(deal, entity, op["id"])
        before = record_data(obj)
        reasons = []
        if obj.deleted_at and action != "restore":
            reasons.append("Restore the deleted record first.")
        if action == "restore" and not obj.deleted_at:
            reasons.append("Record is not deleted.")
        links = dependencies(obj, entity)
        if action in {"delete", "deactivate"} and links:
            blockers.append(
                {
                    "ref": op["ref"],
                    "reason": "Used by open requests.",
                    "requests": links,
                }
            )
            continue
        if action in {"activate", "restore"} and not availability(obj, entity):
            reasons.append("Parent record is deleted or inactive.")
        if entity == "request" and action == "reopen":
            reasons.extend(reopen_errors(obj))
        if (
            entity == "participant"
            and action == "restore"
            and domain.DealParticipant.objects.filter(
                deal_id=obj.deal_id, client_id=obj.client_id
            )
            .exclude(pk=obj.pk)
            .exists()
        ):
            reasons.append("A live participation already exists.")
        if entity == "variant":
            req = obj.insurance_request
            if (
                req.deleted_at
                or not req.is_current
                or not obj.is_current
                or obj.request_version.number != req.version
            ):
                reasons.append(
                    "Variant must belong to the current open request version."
                )
            if obj.status == "quoted" or obj.quotes.with_deleted().exists():
                reasons.append("Variant has offers and cannot be reset manually.")
        if reasons:
            blockers.append({"ref": op["ref"], "reasons": reasons, "requests": []})
            continue
        if entity in DOCUMENTS and action == "activate":
            owner_field = obj.current_owner_field
            for previous in (
                MODELS[entity]
                .objects.select_for_update()
                .filter(
                    **{
                        owner_field + "_id": getattr(obj, owner_field + "_id"),
                        "is_current": True,
                    }
                )
                .exclude(pk=obj.pk)
            ):
                confirmations.append(
                    {
                        "ref": op["ref"],
                        "entity": entity,
                        "id": str(previous.pk),
                        "field": "is_current",
                        "old": True,
                        "new": False,
                        "source": op["source"],
                    }
                )
                old = record_data(previous)
                previous.is_current = False
                models.Model.save(previous, update_fields=["is_current", "updated_at"])
                audit(previous, old, op["source"])
            affected.extend(links)
        if action == "set_status":
            obj.status = op["status"]
            obj.explanation = (
                op.get("explanation", "") if obj.status != "pending" else ""
            )
        elif action == "delete":
            obj.deleted_at = timezone.now()
            obj.is_current = False
        elif action == "restore":
            obj.deleted_at = None
            obj.is_current = False
        else:
            obj.is_current = action in {"activate", "reopen"}
        # Explicit soft deletion only; never call cascading delete methods.
        obj.save()
        audit(obj, before, op["source"])
        changes.append(
            {
                "ref": op["ref"],
                "entity": entity,
                "id": str(obj.pk),
                "action": action,
                "before": plain(before),
                "after": plain(record_data(obj)),
            }
        )
        results.append({"ref": op["ref"], "entity": entity, "id": str(obj.pk)})
    return {
        "deal_id": str(deal.pk),
        "results": results,
        "changes": changes,
        "confirmations": confirmations,
        "blockers": blockers,
        "affected_requests": list({r["id"]: r for r in affected}.values()),
    }
