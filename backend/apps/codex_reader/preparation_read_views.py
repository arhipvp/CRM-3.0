"""Read-only lookups used to prepare a request without duplicate people."""

import uuid

from apps.clients.models import Client
from apps.deals.models import Bank, InsuranceCompany, InsuranceType
from apps.insurance_requests.models import (
    ClientPassport,
    DriverLicense,
    LeasingCompany,
    Platform,
)
from django.db.models import Q
from django.shortcuts import get_object_or_404
from rest_framework.response import Response

from .request_views import _bounded, _data
from .views import CodexReadView, _page


class ClientSearchView(CodexReadView):
    def get(self, request):
        query = request.query_params.get("q", "").strip()
        if not query or len(query) > 200:
            return Response(
                {"detail": "q must contain 1 to 200 characters."}, status=400
            )
        match = (
            Q(name__icontains=query)
            | Q(phone__icontains=query)
            | Q(email__icontains=query)
        )
        try:
            match |= Q(pk=uuid.UUID(query))
        except ValueError:
            pass
        page = _page(request, Client.objects.filter(match).order_by("name", "pk"))
        if isinstance(page, Response):
            return page
        page["results"] = [
            {
                "id": str(client.pk),
                "name": client.name,
                "birth_date": client.birth_date,
                "phone": client.phone,
                "email": client.email,
            }
            for client in page["results"]
        ]
        return _bounded(page)


class ClientPreparationDetailView(CodexReadView):
    def get(self, request, client_id):
        client = get_object_or_404(Client.objects, pk=client_id)
        return _bounded(
            {
                "schema_version": 1,
                "client": _data(client),
                "passports": [
                    _data(doc) for doc in ClientPassport.objects.filter(client=client)
                ],
                "driver_licenses": [
                    _data(doc) for doc in DriverLicense.objects.filter(client=client)
                ],
            }
        )


class PreparationReferencesView(CodexReadView):
    def get(self, request):
        models = {
            "insurance_companies": InsuranceCompany,
            "insurance_types": InsuranceType,
            "banks": Bank,
            "platforms": Platform,
            "leasing_companies": LeasingCompany,
        }
        kind = request.query_params.get("kind")
        if kind not in models:
            return Response({"detail": "Unsupported reference kind."}, status=400)
        queryset = models[kind].objects.all()
        if kind in {"platforms", "leasing_companies"}:
            queryset = queryset.filter(is_current=True)
        query = request.query_params.get("q", "").strip()
        if len(query) > 200:
            return Response({"detail": "q must not exceed 200 characters."}, status=400)
        if query:
            queryset = queryset.filter(name__icontains=query)
        page = _page(request, queryset.order_by("name", "pk"))
        if isinstance(page, Response):
            return page
        page["results"] = [
            {"id": str(item.pk), "name": item.name} for item in page["results"]
        ]
        return _bounded(page)
