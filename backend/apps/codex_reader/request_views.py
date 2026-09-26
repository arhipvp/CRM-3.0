"""Bounded read-only snapshots of structured deal data and insurance requests."""

import json

from apps.insurance_requests.models import (
    ClientPassport,
    DealParticipant,
    DriverLicense,
    InsuranceRequest,
    Mortgage,
    MortgageBalance,
    RequestVersion,
    Vehicle,
    VehicleRegistration,
    VehicleTitle,
)
from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework.response import Response

from .views import MAX_PASSPORT_BYTES, CodexReadView, _deal, _model_data


def _data(record):
    return _model_data(record, max_text=None)


def _bounded(payload):
    if (
        len(json.dumps(payload, ensure_ascii=False, default=str).encode("utf-8"))
        > MAX_PASSPORT_BYTES
    ):
        return Response(
            {"code": "passport_too_large", "detail": "Structured data exceeds 5 MiB."},
            status=413,
        )
    return Response(payload)


class DealStructuredDataView(CodexReadView):
    def get(self, request, deal_id):
        deal = _deal(deal_id)
        participants = list(
            DealParticipant.objects.filter(deal=deal).select_related("client")
        )
        client_ids = [p.client_id for p in participants if p.client.deleted_at is None]
        vehicles = list(Vehicle.objects.filter(deal=deal))
        mortgages = list(Mortgage.objects.filter(deal=deal).select_related("bank"))
        payload = {
            "schema_version": 1,
            "generated_at": timezone.now().isoformat(),
            "deal_id": str(deal.pk),
            "participants": [_data(item) for item in participants],
            "clients": [
                _data(p.client) for p in participants if p.client.deleted_at is None
            ],
            "passports": [
                _data(item)
                for item in ClientPassport.objects.filter(client_id__in=client_ids)
            ],
            "driver_licenses": [
                _data(item)
                for item in DriverLicense.objects.filter(client_id__in=client_ids)
            ],
            "vehicles": [_data(item) for item in vehicles],
            "vehicle_registrations": [
                _data(item)
                for item in VehicleRegistration.objects.filter(vehicle__in=vehicles)
            ],
            "vehicle_titles": [
                _data(item)
                for item in VehicleTitle.objects.filter(vehicle__in=vehicles)
            ],
            "mortgages": [
                {**_data(item), "bank_name": item.bank.name if item.bank else None}
                for item in mortgages
            ],
            "mortgage_balances": [
                _data(item)
                for item in MortgageBalance.objects.filter(mortgage__in=mortgages)
            ],
            "requests": [
                {
                    **_data(item),
                    "drivers": [
                        str(pk) for pk in item.drivers.values_list("pk", flat=True)
                    ],
                }
                for item in InsuranceRequest.objects.filter(deal=deal).prefetch_related(
                    "drivers"
                )
            ],
        }
        return _bounded(payload)


class RequestPassportView(CodexReadView):
    def get(self, request, deal_id, request_id):
        deal = _deal(deal_id)
        application = get_object_or_404(
            InsuranceRequest.objects, pk=request_id, deal=deal
        )
        versions = RequestVersion.objects.filter(insurance_request=application)
        raw_version = request.query_params.get("version")
        if raw_version is not None:
            try:
                version_id = int(raw_version)
            except (TypeError, ValueError):
                return Response(
                    {"detail": "version must be an integer ID."}, status=400
                )
            version = get_object_or_404(versions, pk=version_id)
        else:
            version = get_object_or_404(versions, number=application.version)
        from apps.insurance_requests.services import request_snapshot

        live = request_snapshot(application)
        saved = dict(version.snapshot)
        for field in ("is_current", "version"):
            live.pop(field, None)
            saved.pop(field, None)
        sources_changed = live != saved
        variants = version.variants.filter(deleted_at__isnull=True).select_related(
            "insurance_company", "platform"
        )
        return _bounded(
            {
                "schema_version": 1,
                "generated_at": timezone.now().isoformat(),
                "deal_id": str(deal.pk),
                "request_id": str(application.pk),
                "is_current": application.is_current,
                "current_version_number": application.version,
                "request_version_id": version.pk,
                "version_number": version.number,
                "snapshot": version.snapshot,
                "sources_changed": sources_changed,
                "variants": [
                    {
                        **_data(item),
                        "insurance_company_name": item.insurance_company.name,
                        "platform_name": item.platform.name,
                    }
                    for item in variants
                ],
                "quotes": [
                    _data(item) for item in deal.quotes.filter(request_version=version)
                ],
                "policies": [
                    _data(item)
                    for item in deal.policies.filter(insurance_request=application)
                ],
                "warnings": (
                    ["This snapshot belongs to an earlier request version."]
                    if version.number != application.version
                    else []
                )
                + (
                    ["Source data changed; refresh the request before calculating."]
                    if sources_changed
                    else []
                ),
            }
        )
