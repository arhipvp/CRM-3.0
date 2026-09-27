import hmac
import uuid

from apps.deals.models import Deal
from django.core import signing
from django.db import IntegrityError, transaction
from django.http import Http404
from rest_framework import serializers
from rest_framework.response import Response

from .models import CodexWriteKey, CodexWriteRequest
from .preparation import ApplyInput, PreparationInput, baseline, digest, run_operations
from .write_views import CodexWriteView

SALT = "crm3-request-preparation-v1"
MAX_BODY = 256 * 1024


class PreparationView(CodexWriteView):
    def parse(self, request, serializer_class):
        if len(request.body) > MAX_BODY:
            raise serializers.ValidationError("Preparation request exceeds 256 KiB.")
        serializer = serializer_class(data=request.data)
        serializer.is_valid(raise_exception=True)
        return serializer.validated_data

    def lock_key(self, request):
        key = CodexWriteKey.objects.select_for_update().get(pk=self.write_key.pk)
        if key.revoked_at:
            self.permission_denied(request, message="Valid Codex write key required.")
        return key

    def deal(self, deal_id):
        deal = Deal.objects.select_for_update().filter(pk=deal_id).first()
        if deal is None:
            raise Http404
        return deal


class PrepPreviewView(PreparationView):
    def post(self, request, deal_id):
        data = self.parse(request, PreparationInput)
        try:
            with transaction.atomic():
                key = self.lock_key(request)
                deal = self.deal(deal_id)
                state = baseline(deal, data["operations"])
                namespace = uuid.uuid4()
                result = run_operations(deal, data["operations"], namespace)
                token = signing.dumps(
                    {
                        "key": str(key.pk),
                        "deal": str(deal.pk),
                        "operations": digest(data["operations"]),
                        "baseline": state,
                        "namespace": str(namespace),
                    },
                    salt=SALT,
                    compress=True,
                )
                transaction.set_rollback(True)
        except IntegrityError as exc:
            raise serializers.ValidationError(
                "Conflicting or duplicate records; refresh data."
            ) from exc
        return Response(
            {**result, "preview_token": token, "expires_in": 1800, "committed": False}
        )


class PrepApplyView(PreparationView):
    def post(self, request, deal_id):
        if len(request.body) > MAX_BODY:
            raise serializers.ValidationError("Preparation request exceeds 256 KiB.")
        # Replay precedes freshness and domain validation; previously accepted
        # operations remain replayable after data changes or token expiry.
        request_hash = digest(
            {"operation": "prepare", "deal_id": str(deal_id), "data": request.data}
        )
        idempotency_key = self._idempotency_key(request)
        try:
            with transaction.atomic():
                key = self.lock_key(request)
                prior = CodexWriteRequest.objects.filter(
                    key=key, idempotency_key=idempotency_key
                ).first()
                if prior:
                    if not hmac.compare_digest(prior.request_hash, request_hash):
                        return Response(
                            {
                                "detail": "Idempotency key already used for another request."
                            },
                            status=409,
                        )
                    return Response({**prior.response, "replayed": True})
                data = self.parse(request, ApplyInput)
                try:
                    token = signing.loads(
                        data["preview_token"], salt=SALT, max_age=1800
                    )
                except signing.BadSignature:
                    return Response(
                        {"detail": "Preview expired or invalid; preview again."},
                        status=409,
                    )
                if (
                    token.get("key") != str(key.pk)
                    or token.get("deal") != str(deal_id)
                    or token.get("operations") != digest(data["operations"])
                ):
                    return Response(
                        {"detail": "Preview does not match this key, deal or payload."},
                        status=409,
                    )
                deal = self.deal(deal_id)
                if token.get("baseline") != baseline(deal, data["operations"]):
                    return Response(
                        {"detail": "Source data changed; preview again."}, status=409
                    )
                result = run_operations(
                    deal, data["operations"], uuid.UUID(token["namespace"])
                )
                if data["confirmations"] != result["confirmations"]:
                    raise serializers.ValidationError(
                        {
                            "confirmations": "Explicit approval of the exact preview replacement list is required."
                        }
                    )
                result = {**result, "committed": True}
                CodexWriteRequest.objects.create(
                    key=key,
                    idempotency_key=idempotency_key,
                    request_hash=request_hash,
                    response=result,
                )
        except IntegrityError as exc:
            raise serializers.ValidationError(
                "Conflicting or duplicate records; refresh data."
            ) from exc
        return Response({**result, "replayed": False}, status=201)
