"""Create-only Codex API, isolated from both the read key and user JWT."""

import hashlib
import hmac
import json
import uuid
from decimal import Decimal
from urllib.parse import urlsplit

from apps.deals.models import Deal, InsuranceCompany, InsuranceType, Quote
from apps.notes.models import Note
from django.db import transaction
from django.http import Http404
from rest_framework import serializers
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import CodexWriteKey, CodexWriteRequest


class StrictSerializer(serializers.Serializer):
    def to_internal_value(self, data):
        if not isinstance(data, dict):
            raise serializers.ValidationError("Expected a JSON object.")
        unknown = set(data) - set(self.fields)
        if unknown:
            raise serializers.ValidationError(
                {field: "Unknown field." for field in sorted(unknown)}
            )
        return super().to_internal_value(data)


class NoteInput(StrictSerializer):
    body = serializers.CharField(max_length=10000, trim_whitespace=True)


class OfferInput(StrictSerializer):
    insurance_company = serializers.CharField(max_length=255, trim_whitespace=True)
    insurance_type = serializers.CharField(max_length=255, trim_whitespace=True)
    premium = serializers.DecimalField(
        max_digits=12, decimal_places=2, min_value=Decimal("0.01")
    )
    sum_insured = serializers.DecimalField(
        max_digits=14,
        decimal_places=2,
        min_value=Decimal("0.01"),
        allow_null=True,
        required=False,
    )
    status = serializers.ChoiceField(choices=("preliminary", "refined"))
    official_dealer = serializers.BooleanField(required=False)
    deductible = serializers.DecimalField(
        max_digits=12,
        decimal_places=2,
        min_value=Decimal("0"),
        allow_null=True,
        required=False,
    )

    def validate(self, attrs):
        if (
            attrs.get("sum_insured") is None
            and attrs["insurance_type"].casefold() != "осаго"
        ):
            raise serializers.ValidationError(
                {"sum_insured": "Required except for OSAGO."}
            )
        if attrs["insurance_type"].casefold() == "каско":
            missing = {}
            if "official_dealer" not in attrs:
                missing["official_dealer"] = "Required for KASKO."
            if attrs.get("deductible") is None:
                missing["deductible"] = "Required for KASKO."
            if missing:
                raise serializers.ValidationError(missing)
        return attrs


class OffersInput(StrictSerializer):
    platform = serializers.CharField(max_length=120, trim_whitespace=True)
    calculation_url = serializers.URLField(max_length=2000)
    period_start = serializers.DateField()
    period_end = serializers.DateField()
    note = serializers.CharField(max_length=10000, trim_whitespace=True)
    offers = OfferInput(many=True, allow_empty=False)

    def validate_calculation_url(self, value):
        parsed = urlsplit(value)
        if (
            parsed.scheme != "https"
            or not parsed.hostname
            or parsed.username
            or parsed.password
        ):
            raise serializers.ValidationError("HTTPS URL without credentials required.")
        return value

    def validate_offers(self, value):
        if len(value) > 30:
            raise serializers.ValidationError("At most 30 offers are accepted.")
        return value

    def validate(self, attrs):
        if attrs["period_end"] < attrs["period_start"]:
            raise serializers.ValidationError({"period_end": "Must not precede start."})
        return attrs


class CodexWriteView(APIView):
    authentication_classes = []
    permission_classes = [AllowAny]
    http_method_names = ["post", "options"]

    def initial(self, request, *args, **kwargs):
        super().initial(request, *args, **kwargs)
        authorization = request.headers.get("Authorization", "")
        if not authorization.startswith("Bearer "):
            self.permission_denied(request, message="Valid Codex write key required.")
        token = authorization[7:]
        parts = token.split("_", 2)
        if len(parts) != 3 or parts[0] != "crm3w" or len(token) > 200:
            self.permission_denied(request, message="Valid Codex write key required.")
        key = CodexWriteKey.objects.filter(
            prefix=parts[1], revoked_at__isnull=True
        ).first()
        digest = hashlib.sha256(token.encode("utf-8")).hexdigest()
        if key is None or not hmac.compare_digest(key.token_hash, digest):
            self.permission_denied(request, message="Valid Codex write key required.")
        self.write_key = key

    def _idempotency_key(self, request):
        raw = request.headers.get("Idempotency-Key", "")
        try:
            return uuid.UUID(raw)
        except (TypeError, ValueError, AttributeError):
            raise serializers.ValidationError(
                {"Idempotency-Key": "A UUID header is required."}
            )

    def _save(self, request, deal_id, serializer_class, operation):
        idempotency_key = self._idempotency_key(request)
        request_hash = hashlib.sha256(
            json.dumps(
                {"deal_id": str(deal_id), "operation": operation, "data": request.data},
                ensure_ascii=False,
                sort_keys=True,
                separators=(",", ":"),
            ).encode("utf-8")
        ).hexdigest()
        with transaction.atomic():
            # Serialize requests for a key, including concurrent attempts to use the same UUID.
            key = CodexWriteKey.objects.select_for_update().get(pk=self.write_key.pk)
            if key.revoked_at is not None:
                self.permission_denied(
                    request, message="Valid Codex write key required."
                )
            prior = CodexWriteRequest.objects.filter(
                key=key, idempotency_key=idempotency_key
            ).first()
            if prior:
                if not hmac.compare_digest(prior.request_hash, request_hash):
                    return Response(
                        {"detail": "Idempotency key already used for another request."},
                        status=409,
                    )
                return Response({**prior.response, "replayed": True}, status=200)
            serializer = serializer_class(data=request.data)
            serializer.is_valid(raise_exception=True)
            deal = Deal.objects.filter(pk=deal_id).first()
            if deal is None:
                raise Http404
            result = self._create(deal, serializer.validated_data)
            CodexWriteRequest.objects.create(
                key=key,
                idempotency_key=idempotency_key,
                request_hash=request_hash,
                response=result,
            )
        return Response({**result, "replayed": False}, status=201)


class CodexNoteCreateView(CodexWriteView):
    def post(self, request, deal_id):
        return self._save(request, deal_id, NoteInput, "note")

    def _create(self, deal, data):
        note = Note(deal=deal, body=data["body"], author_name="Codex")
        note.save()
        return {"note_id": str(note.id), "quote_ids": []}


class CodexOffersCreateView(CodexWriteView):
    def post(self, request, deal_id):
        return self._save(request, deal_id, OffersInput, "offers")

    def _create(self, deal, data):
        quote_ids = []
        for offer in data["offers"]:
            company = InsuranceCompany.objects.filter(
                name__iexact=offer["insurance_company"]
            ).first()
            if company is None:
                if (
                    InsuranceCompany.objects.with_deleted()
                    .filter(name__iexact=offer["insurance_company"])
                    .exists()
                ):
                    raise serializers.ValidationError(
                        {"offers": "Insurance company is inactive."}
                    )
                company, _ = InsuranceCompany.objects.get_or_create(
                    name=offer["insurance_company"]
                )
            insurance_type = InsuranceType.objects.filter(
                name__iexact=offer["insurance_type"]
            ).first()
            if insurance_type is None:
                if (
                    InsuranceType.objects.with_deleted()
                    .filter(name__iexact=offer["insurance_type"])
                    .exists()
                ):
                    raise serializers.ValidationError(
                        {"offers": "Insurance type is inactive."}
                    )
                insurance_type, _ = InsuranceType.objects.get_or_create(
                    name=offer["insurance_type"]
                )
            comments = (
                "Создано: Codex\n"
                f"Платформа: {data['platform']}\n"
                f"Расчёт: {data['calculation_url']}\n"
                f"Период: {data['period_start']:%d.%m.%Y}–{data['period_end']:%d.%m.%Y}\n"
                f"Статус: {'уточнённый' if offer['status'] == 'refined' else 'предварительный'}"
            )
            quote = Quote(
                deal=deal,
                insurance_company=company,
                insurance_type=insurance_type,
                premium=offer["premium"],
                sum_insured=offer.get("sum_insured"),
                deductible=offer.get("deductible"),
                official_dealer=offer.get("official_dealer", False),
                comments=comments,
            )
            quote.save()
            quote_ids.append(str(quote.id))
        note = Note(deal=deal, body=data["note"], author_name="Codex")
        note.save()
        return {"note_id": str(note.id), "quote_ids": quote_ids}
