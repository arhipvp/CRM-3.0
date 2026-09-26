import json

from django.core.serializers.json import DjangoJSONEncoder
from django.db import transaction
from django.forms.models import model_to_dict
from rest_framework.exceptions import ValidationError

from . import models


def record_data(instance):
    data = model_to_dict(
        instance, exclude=[field.name for field in instance._meta.many_to_many]
    )
    data["id"] = str(instance.pk)
    return json.loads(json.dumps(data, cls=DjangoJSONEncoder))


def request_snapshot(instance):
    data = record_data(instance)
    for field in ("is_current", "deleted_at"):
        data.pop(field, None)
    data["drivers"] = [str(pk) for pk in instance.drivers.values_list("pk", flat=True)]
    people = set(data["drivers"])
    people.update(
        str(getattr(instance, f"{role}_id"))
        for role in ("policyholder", "owner", "borrower", "insured_person")
        if getattr(instance, f"{role}_id")
    )
    from apps.clients.models import Client

    data["people"] = [
        record_data(person) for person in Client.objects.filter(pk__in=people)
    ]
    data["passports"] = [
        record_data(doc)
        for doc in models.ClientPassport.objects.filter(
            client_id__in=people, is_current=True
        )
    ]
    data["driver_licenses"] = [
        record_data(doc)
        for doc in models.DriverLicense.objects.filter(
            client_id__in=people, is_current=True
        )
    ]
    data["object"] = record_data(instance.vehicle or instance.mortgage)
    if instance.vehicle_id:
        data["vehicle_registrations"] = [
            record_data(doc)
            for doc in models.VehicleRegistration.objects.filter(
                vehicle=instance.vehicle, is_current=True
            )
        ]
        data["vehicle_titles"] = [
            record_data(doc)
            for doc in models.VehicleTitle.objects.filter(
                vehicle=instance.vehicle, is_current=True
            )
        ]
    return data


@transaction.atomic
def save_request(serializer, attrs, instance=None):
    drivers = attrs.pop("drivers", None)
    if instance:
        instance = models.InsuranceRequest.objects.select_for_update().get(
            pk=instance.pk
        )
        if not instance.is_current:
            raise ValidationError("Верните закрытую заявку в работу.")
        for key, value in attrs.items():
            setattr(instance, key, value)
    else:
        instance = models.InsuranceRequest(**attrs)
    balance = instance.mortgage_balance
    if balance and (instance.version == 0 or "mortgage_balance" in attrs):
        instance.mortgage_bank = instance.mortgage.bank
        instance.mortgage_amount = balance.amount
        instance.mortgage_amount_date = balance.as_of_date
    elif not balance:
        instance.mortgage_bank = None
        instance.mortgage_amount = None
        instance.mortgage_amount_date = None
    instance.save()
    if drivers is not None:
        instance.drivers.set(drivers)
    snapshot = request_snapshot(instance)
    previous = instance.versions.first()
    comparable = dict(snapshot)
    comparable.pop("version", None)
    old = dict(previous.snapshot) if previous else None
    if old:
        old.pop("version", None)
    if old != comparable:
        instance.version += 1
        instance.save(update_fields=["version", "updated_at"])
        snapshot["version"] = instance.version
        version = models.RequestVersion.objects.create(
            insurance_request=instance, number=instance.version, snapshot=snapshot
        )
        instance.variants.update(is_current=False)
        casco = "каско" in instance.insurance_type.name.casefold()
        for target in instance.targets:
            for deductible in instance.deductibles if casco else [None]:
                models.RequestVariant.objects.create(
                    insurance_request=instance,
                    request_version=version,
                    insurance_company_id=target["insurance_company"],
                    platform_id=target["platform"],
                    deductible=deductible,
                )
    return instance


def request_passport(instance, version=None):
    selected = instance.versions.get(number=version or instance.version)
    return {
        "schema_version": 1,
        "insurance_request": str(instance.pk),
        "version": selected.number,
        "snapshot": selected.snapshot,
        "variants": [record_data(v) for v in selected.variants.all()],
        "sources_changed": selected.snapshot != request_snapshot(instance),
    }


def serialize_deal_data(deal):
    participants = list(models.DealParticipant.objects.filter(deal=deal))
    people = [p.client for p in participants if not p.client.deleted_at]
    vehicles = models.Vehicle.objects.filter(deal=deal)
    mortgages = models.Mortgage.objects.filter(deal=deal)
    return {
        "schema_version": 1,
        "deal": str(deal.pk),
        "participants": [record_data(p) for p in participants],
        "people": [record_data(p) for p in people],
        "passports": [
            record_data(p)
            for p in models.ClientPassport.objects.filter(client__in=people)
        ],
        "driver_licenses": [
            record_data(p)
            for p in models.DriverLicense.objects.filter(client__in=people)
        ],
        "vehicles": [record_data(v) for v in vehicles],
        "vehicle_registrations": [
            record_data(v)
            for v in models.VehicleRegistration.objects.filter(vehicle__in=vehicles)
        ],
        "vehicle_titles": [
            record_data(v)
            for v in models.VehicleTitle.objects.filter(vehicle__in=vehicles)
        ],
        "mortgages": [record_data(m) for m in mortgages],
        "mortgage_balances": [
            record_data(b)
            for b in models.MortgageBalance.objects.filter(mortgage__in=mortgages)
        ],
        "requests": [
            record_data(r) for r in models.InsuranceRequest.objects.filter(deal=deal)
        ],
    }
