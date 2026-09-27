"""Deal-scoped lifecycle inspection, including explicit recovery views."""

from apps.insurance_requests.models import (
    ClientPassport,
    DealParticipant,
    DriverLicense,
    InsuranceRequest,
    Mortgage,
    MortgageBalance,
    RecordHistory,
    RequestVariant,
    RequestVersion,
    Vehicle,
    VehicleRegistration,
    VehicleTitle,
)
from django.shortcuts import get_object_or_404
from rest_framework.exceptions import ValidationError
from rest_framework.response import Response

from .request_views import _bounded, _data
from .views import CodexReadView, _deal, _page

RECORD_MODELS = {
    "participant": DealParticipant,
    "passport": ClientPassport,
    "driver_license": DriverLicense,
    "vehicle": Vehicle,
    "vehicle_registration": VehicleRegistration,
    "vehicle_title": VehicleTitle,
    "mortgage": Mortgage,
    "mortgage_balance": MortgageBalance,
    "request": InsuranceRequest,
    "variant": RequestVariant,
}


def _records(request, deal, entity):
    if entity not in RECORD_MODELS:
        raise ValidationError({"entity": "Unsupported record entity."})
    deleted = request.query_params.get("deleted", "exclude")
    current = request.query_params.get("current", "all")
    if deleted not in {"exclude", "include", "only"}:
        raise ValidationError({"deleted": "Use exclude, include or only."})
    if current not in {"all", "true", "false"}:
        raise ValidationError({"current": "Use all, true or false."})
    queryset = RECORD_MODELS[entity].objects.with_deleted()
    if entity in {"passport", "driver_license"}:
        # Historical participation keeps recovery possible, but is opt-in.
        participants = DealParticipant.objects.with_deleted().filter(deal=deal)
        if deleted == "exclude":
            participants = participants.filter(
                deleted_at__isnull=True, client__deleted_at__isnull=True
            )
        queryset = queryset.filter(client_id__in=participants.values("client_id"))
    elif entity in {"vehicle_registration", "vehicle_title"}:
        queryset = queryset.filter(vehicle__deal=deal)
        if deleted == "exclude":
            queryset = queryset.filter(vehicle__deleted_at__isnull=True)
    elif entity == "mortgage_balance":
        queryset = queryset.filter(mortgage__deal=deal)
        if deleted == "exclude":
            queryset = queryset.filter(mortgage__deleted_at__isnull=True)
    elif entity == "variant":
        queryset = queryset.filter(insurance_request__deal=deal)
        if deleted == "exclude":
            queryset = queryset.filter(insurance_request__deleted_at__isnull=True)
        queryset = queryset.select_related("insurance_company", "platform")
    else:
        queryset = queryset.filter(deal=deal)
        if entity == "participant" and deleted == "exclude":
            queryset = queryset.filter(client__deleted_at__isnull=True)
    if deleted != "include":
        queryset = queryset.filter(deleted_at__isnull=deleted == "exclude")
    if current != "all":
        queryset = queryset.filter(is_current=current == "true")
    if entity == "request":
        queryset = queryset.prefetch_related("drivers")
    return queryset.order_by("created_at", "pk")


def _record_data(record):
    data = _data(record)
    if isinstance(record, InsuranceRequest):
        data["drivers"] = [
            str(pk) for pk in record.drivers.values_list("pk", flat=True)
        ]
    if isinstance(record, RequestVariant):
        data["insurance_company_name"] = record.insurance_company.name
        data["platform_name"] = record.platform.name
    return data


def _paged(request, queryset, serialize=_data):
    page = _page(request, queryset)
    if isinstance(page, Response):
        return page
    page["results"] = [serialize(record) for record in page["results"]]
    return _bounded(page)


class LifecycleRecordListView(CodexReadView):
    def get(self, request, deal_id, entity):
        return _paged(request, _records(request, _deal(deal_id), entity), _record_data)


class LifecycleRecordDetailView(CodexReadView):
    def get(self, request, deal_id, entity, record_id):
        record = get_object_or_404(
            _records(request, _deal(deal_id), entity), pk=record_id
        )
        return _bounded(_record_data(record))


class LifecycleRecordHistoryView(CodexReadView):
    def get(self, request, deal_id, entity, record_id):
        record = get_object_or_404(
            _records(request, _deal(deal_id), entity), pk=record_id
        )
        return _paged(
            request,
            RecordHistory.objects.filter(
                model_name=record._meta.label_lower, record_id=record.pk
            ).order_by("-created_at", "-pk"),
        )


class RequestVersionsView(CodexReadView):
    def get(self, request, deal_id, request_id):
        application = get_object_or_404(
            _records(request, _deal(deal_id), "request"), pk=request_id
        )
        return _paged(
            request,
            RequestVersion.objects.filter(insurance_request=application).order_by(
                "-number", "-pk"
            ),
        )
