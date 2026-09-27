"""Transactional preparation operations; deliberately no external integrations."""

import hashlib
import json
import uuid

from apps.clients.models import Client
from apps.clients.serializers import ClientSerializer
from apps.deals.models import Bank, InsuranceCompany, InsuranceType
from apps.insurance_requests import models as domain
from apps.insurance_requests import serializers as inputs
from apps.insurance_requests.services import record_data
from django.core.serializers.json import DjangoJSONEncoder
from django.db import connection
from django.db.models import Q
from django.utils import timezone
from rest_framework import serializers

from .write_views import StrictSerializer

ENTITIES = {
    "client": ClientSerializer,
    "participant": inputs.ParticipantSerializer,
    "passport": inputs.PassportSerializer,
    "driver_license": inputs.DriverLicenseSerializer,
    "vehicle": inputs.VehicleSerializer,
    "vehicle_registration": inputs.VehicleRegistrationSerializer,
    "vehicle_title": inputs.VehicleTitleSerializer,
    "mortgage": inputs.MortgageSerializer,
    "mortgage_balance": inputs.MortgageBalanceSerializer,
    "platform": inputs.PlatformSerializer,
    "request": inputs.InsuranceRequestSerializer,
}
CLIENT_FIELDS = {
    "name",
    "phone",
    "email",
    "birth_date",
    "sex",
    "birth_place",
    "registration_address",
    "notes",
}
DOCUMENTS = {"passport", "driver_license", "vehicle_registration", "vehicle_title"}


def plain(value):
    return json.loads(json.dumps(value, cls=DjangoJSONEncoder, sort_keys=True))


def digest(value):
    return hashlib.sha256(
        json.dumps(plain(value), sort_keys=True, separators=(",", ":")).encode()
    ).hexdigest()


class OperationInput(StrictSerializer):
    ref = serializers.RegexField(r"^[A-Za-z][A-Za-z0-9_]{0,63}$")
    entity = serializers.ChoiceField(choices=list(ENTITIES))
    id = serializers.UUIDField(required=False)
    data = serializers.DictField()
    source = serializers.CharField(max_length=1000, trim_whitespace=True)


class PreparationInput(StrictSerializer):
    operations = OperationInput(many=True, allow_empty=False)

    def validate_operations(self, values):
        if len(values) > 50 or len({op["ref"] for op in values}) != len(values):
            raise serializers.ValidationError(
                "At most 50 operations with unique refs required."
            )
        return values


class ApplyInput(PreparationInput):
    preview_token = serializers.CharField(max_length=4000)
    confirmations = serializers.ListField(child=serializers.DictField())


def resolve(value, refs):
    if isinstance(value, str) and value.startswith("@"):
        if value[1:] not in refs:
            raise serializers.ValidationError(
                "Reference must name an earlier operation."
            )
        return refs[value[1:]]
    if isinstance(value, dict):
        return {key: resolve(item, refs) for key, item in value.items()}
    if isinstance(value, list):
        return [resolve(item, refs) for item in value]
    return value


def baseline(deal, operations):
    """Lock records read by preparation and hash values, including source documents."""
    ids = set()

    def collect(value):
        if isinstance(value, dict):
            for item in value.values():
                collect(item)
        elif isinstance(value, list):
            for item in value:
                collect(item)
        else:
            try:
                ids.add(uuid.UUID(str(value)))
            except (ValueError, TypeError, AttributeError):
                pass

    collect(operations)
    participants = list(
        domain.DealParticipant.objects.with_deleted()
        .select_for_update()
        .filter(deal=deal)
    )
    client_ids = (
        ids
        | {p.client_id for p in participants}
        | ({deal.client_id} if deal.client_id else set())
    )
    vehicle_ids = (
        set(
            domain.Vehicle.objects.with_deleted()
            .filter(deal=deal)
            .values_list("pk", flat=True)
        )
        | ids
    )
    mortgage_ids = (
        set(
            domain.Mortgage.objects.with_deleted()
            .filter(deal=deal)
            .values_list("pk", flat=True)
        )
        | ids
    )
    result = {"deal": record_data(deal)}
    for entity, serializer in ENTITIES.items():
        model = serializer.Meta.model
        condition = Q(pk__in=ids)
        if entity == "client":
            condition |= Q(pk__in=client_ids)
        elif entity in {"participant", "vehicle", "mortgage", "request"}:
            condition |= Q(deal=deal)
        elif entity in {"passport", "driver_license"}:
            condition |= Q(client_id__in=client_ids)
        elif entity in {"vehicle_registration", "vehicle_title"}:
            condition |= Q(vehicle_id__in=vehicle_ids)
        elif entity == "mortgage_balance":
            condition |= Q(mortgage_id__in=mortgage_ids)
        values = []
        for instance in (
            model.objects.with_deleted()
            .select_for_update()
            .filter(condition)
            .order_by("pk")
        ):
            data = record_data(instance)
            data["deleted_at"] = instance.deleted_at
            data["updated_at"] = instance.updated_at
            if entity == "request":
                data["drivers"] = sorted(
                    str(pk) for pk in instance.drivers.values_list("pk", flat=True)
                )
            values.append(data)
        result[entity] = values
    for model in (Bank, InsuranceCompany, InsuranceType):
        result[model._meta.label_lower] = [
            {
                "id": str(instance.pk),
                "name": instance.name,
                "deleted_at": instance.deleted_at,
                "updated_at": instance.updated_at,
            }
            for instance in model.objects.with_deleted()
            .select_for_update()
            .filter(pk__in=ids)
            .order_by("pk")
        ]
    return digest(result)


def parent_deal(instance):
    if hasattr(instance, "deal_id"):
        return instance.deal_id
    if hasattr(instance, "vehicle_id"):
        return instance.vehicle.deal_id
    if hasattr(instance, "mortgage_id"):
        return instance.mortgage.deal_id
    return None


def scope(instance, deal, entity, *, creating=False):
    if instance.deleted_at is not None:
        raise serializers.ValidationError("Deleted records cannot be prepared.")
    owner = parent_deal(instance)
    if owner and owner != deal.pk:
        raise serializers.ValidationError("Record belongs to another deal.")
    if not creating and hasattr(instance, "is_current") and not instance.is_current:
        raise serializers.ValidationError(
            "Inactive or closed records cannot be prepared."
        )
    person_id = (
        instance.pk if entity == "client" else getattr(instance, "client_id", None)
    )
    if entity != "participant" and person_id and not (creating and entity == "client"):
        if not domain.DealParticipant.objects.filter(
            deal=deal,
            client_id=person_id,
            is_current=True,
            client__deleted_at__isnull=True,
        ).exists():
            raise serializers.ValidationError(
                "Client must first be added to this deal."
            )


def run_operations(deal, operations, namespace):
    refs, results, confirmations, missing, changes = {}, [], [], {}, []
    for op in operations:
        entity, ref = op["entity"], op["ref"]
        serializer_class = ENTITIES[entity]
        model = serializer_class.Meta.model
        instance = None
        if op.get("id"):
            instance = model.objects.with_deleted().filter(pk=op["id"]).first()
            if instance is None:
                raise serializers.ValidationError({ref: "Record not found."})
            scope(instance, deal, entity)
            if entity == "platform":
                raise serializers.ValidationError(
                    "Existing platforms cannot be changed."
                )
        data = resolve(op["data"], refs)
        field_map = serializer_class().fields
        allowed = (
            CLIENT_FIELDS
            if entity == "client"
            else {name for name, field in field_map.items() if not field.read_only}
            - {"is_current"}
        )
        forbidden = set(data) - allowed
        if forbidden:
            raise serializers.ValidationError(
                {ref: {name: "Field cannot be written." for name in sorted(forbidden)}}
            )
        if entity in {"participant", "vehicle", "mortgage", "request"}:
            if data.get("deal") and str(data["deal"]) != str(deal.pk):
                raise serializers.ValidationError({ref: "Foreign deal."})
            data["deal"] = str(deal.pk)
        serializer = serializer_class(
            instance=instance, data=data, partial=instance is not None
        )
        serializer.is_valid(raise_exception=True)
        before = plain(serializer_class(instance).data) if instance else None
        candidate = (
            model(
                **{k: v for k, v in serializer.validated_data.items() if k != "drivers"}
            )
            if instance is None
            else instance
        )
        scope(candidate, deal, entity, creating=instance is None)
        if instance is None:
            duplicate = None
            if entity == "vehicle" and data.get("vin"):
                duplicate = model.objects.filter(
                    deal=deal, vin__iexact=data["vin"]
                ).first()
            elif entity == "client" and data.get("birth_date"):
                if connection.vendor == "postgresql":
                    identity = (
                        data.get("name", "").strip().casefold()
                        + "|"
                        + str(data["birth_date"])
                    )
                    lock_id = int.from_bytes(
                        hashlib.sha256(identity.encode()).digest()[:8],
                        "big",
                        signed=True,
                    )
                    with connection.cursor() as cursor:
                        cursor.execute("SELECT pg_advisory_xact_lock(%s)", [lock_id])
                duplicate = model.objects.filter(
                    name__iexact=data.get("name", "").strip(),
                    birth_date=data["birth_date"],
                ).first()
            elif entity in DOCUMENTS and data.get("number"):
                owner_field = (
                    "client" if entity in {"passport", "driver_license"} else "vehicle"
                )
                duplicate = model.objects.filter(
                    **{
                        owner_field: serializer.validated_data[owner_field],
                        "series": data.get("series", ""),
                        "number": data["number"],
                    }
                ).first()
            if duplicate:
                raise serializers.ValidationError(
                    {
                        ref: {
                            "duplicate_id": str(duplicate.pk),
                            "detail": "Use existing record after verification.",
                        }
                    }
                )
        if entity in DOCUMENTS and instance is None:
            owner_field = (
                "client" if entity in {"passport", "driver_license"} else "vehicle"
            )
            for previous in model.objects.filter(
                **{owner_field: serializer.validated_data[owner_field]}, is_current=True
            ):
                confirmations.append(
                    {
                        "ref": ref,
                        "field": "deactivate_document",
                        "old": {
                            "entity": entity,
                            "id": str(previous.pk),
                            "is_current": True,
                        },
                        "new": {"is_current": False},
                        "source": op["source"],
                    }
                )
                changes.append(
                    {
                        "kind": "replace",
                        "entity": entity,
                        "id": str(previous.pk),
                        **confirmations[-1],
                    }
                )
        # Client model signals provision Drive folders. This API intentionally uses
        # bulk persistence and its own audit; neither preview nor apply invokes Drive.
        if entity == "client":
            if instance is None:
                instance = Client(
                    id=uuid.uuid5(namespace, ref), **serializer.validated_data
                )
                instance.created_by_id = deal.seller_id
                Client.objects.bulk_create([instance])
            else:
                for key, value in serializer.validated_data.items():
                    setattr(instance, key, value)
                instance.updated_at = timezone.now()
                Client.objects.bulk_update(
                    [instance], list(serializer.validated_data) + ["updated_at"]
                )
        else:
            instance = serializer.save(
                **({"id": uuid.uuid5(namespace, ref)} if instance is None else {})
            )
        after = plain(serializer_class(instance).data)
        if before is None:
            changes.append(
                {
                    "kind": "create",
                    "ref": ref,
                    "entity": entity,
                    "id": str(instance.pk),
                    "field": "*",
                    "old": None,
                    "new": {field: after.get(field) for field in data},
                    "source": op["source"],
                }
            )
        if before:
            for field in data:
                old, new = before.get(field), after.get(field)
                if old == new:
                    continue
                kind = "replace"
                if old is None or old == "" or old == []:
                    kind = "fill"
                if (
                    field == "source_links"
                    and isinstance(old, list)
                    and all(item in new for item in old)
                ):
                    kind = "add_links"
                changes.append(
                    {
                        "kind": kind,
                        "ref": ref,
                        "entity": entity,
                        "id": str(instance.pk),
                        "field": field,
                        "old": old,
                        "new": new,
                        "source": op["source"],
                    }
                )
                if kind != "replace":
                    continue
                confirmations.append(
                    {
                        "ref": ref,
                        "field": field,
                        "old": old,
                        "new": new,
                        "source": op["source"],
                    }
                )
        domain.RecordHistory.objects.create(
            model_name=instance._meta.label_lower,
            record_id=instance.pk,
            actor=None,
            action="codex_prepare",
            snapshot={
                "author": "Codex",
                "source": op["source"],
                "before": before,
                "after": after,
            },
        )
        refs[ref] = str(instance.pk)
        results.append({"ref": ref, "entity": entity, "id": str(instance.pk)})
        if entity == "request":
            results[-1]["version"] = instance.version
            missing[ref] = after["missing_fields"]
    return {
        "deal_id": str(deal.pk),
        "results": results,
        "confirmations": confirmations,
        "missing_fields": missing,
        "changes": changes,
    }
