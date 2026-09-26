from apps.common.permissions import EditProtectedMixin
from apps.deals.permissions import (
    build_deal_visibility_q,
    can_modify_deal,
    is_admin_user,
)
from django.core.exceptions import ValidationError as DjangoValidationError
from django.db import transaction
from rest_framework import permissions, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import PermissionDenied, ValidationError
from rest_framework.response import Response

from . import models, serializers
from .services import record_data, request_passport


class RecordViewSet(viewsets.ModelViewSet):
    permission_classes = [permissions.IsAuthenticated]
    parent_field = None
    deal_path = None

    def get_queryset(self):
        model = self.serializer_class.Meta.model
        qs = (
            model.objects.with_deleted()
            if (
                self.request.method in {"GET", "HEAD", "OPTIONS"}
                and self.request.query_params.get("include_deleted") == "true"
            )
            or self.action == "restore"
            else model.objects.all()
        )
        if self.deal_path:
            prefix = self.deal_path + "__"
            qs = qs.filter(**{prefix + "deleted_at__isnull": True})
            if not is_admin_user(self.request.user):
                qs = qs.filter(
                    build_deal_visibility_q(self.request.user, prefix=prefix)
                ).distinct()
        if model is models.RequestVariant:
            qs = qs.filter(insurance_request__deleted_at__isnull=True)
        if model in {models.ClientPassport, models.DriverLicense}:
            qs = qs.filter(client__deleted_at__isnull=True)
        for key in ("client", "vehicle", "mortgage", "insurance_request"):
            if key in self.request.query_params and any(
                f.name == key for f in model._meta.fields
            ):
                try:
                    qs = qs.filter(**{key + "_id": self.request.query_params[key]})
                except DjangoValidationError as exc:
                    raise ValidationError(
                        {key: "Укажите корректный идентификатор."}
                    ) from exc
        if self.deal_path and self.request.query_params.get("deal"):
            try:
                qs = qs.filter(
                    **{self.deal_path + "_id": self.request.query_params["deal"]}
                )
            except DjangoValidationError as exc:
                raise ValidationError(
                    {"deal": "Укажите корректный идентификатор сделки."}
                ) from exc
        current = self.request.query_params.get("is_current")
        if current in {"true", "false"}:
            qs = qs.filter(is_current=current == "true")
        return qs

    def authorize(self, instance):
        if self.deal_path:
            deal = instance
            for part in self.deal_path.split("__"):
                deal = getattr(deal, part)
            if deal.deleted_at or not can_modify_deal(self.request.user, deal):
                raise PermissionDenied("Нет права изменять данные сделки.")
        elif hasattr(instance, "client"):
            client = instance.client
            checker = EditProtectedMixin()
            checker.owner_field = "created_by"
            if client.deleted_at or not checker._can_modify(self.request.user, client):
                raise PermissionDenied("Нет права изменять документы клиента.")

    def audit(self, instance, operation):
        models.RecordHistory.objects.create(
            model_name=instance._meta.label_lower,
            record_id=instance.pk,
            actor=self.request.user,
            action=operation,
            snapshot=record_data(instance),
        )

    @transaction.atomic
    def perform_create(self, serializer):
        candidate = serializer.Meta.model(
            **{k: v for k, v in serializer.validated_data.items() if k != "drivers"}
        )
        self.authorize(candidate)
        instance = serializer.save()
        self.audit(instance, "create")

    @transaction.atomic
    def perform_update(self, serializer):
        self.authorize(serializer.instance)
        self.audit(serializer.instance, "before_update")
        self.audit(serializer.save(), "update")

    @transaction.atomic
    def perform_destroy(self, instance):
        self.authorize(instance)
        instance.delete()
        self.audit(instance, "delete")

    @action(detail=True, methods=["post"])
    @transaction.atomic
    def restore(self, request, pk=None):
        instance = self.get_object()
        self.authorize(instance)
        if (
            isinstance(instance, models.DealParticipant)
            and models.DealParticipant.objects.filter(
                deal=instance.deal, client=instance.client
            )
            .exclude(pk=instance.pk)
            .exists()
        ):
            raise ValidationError("Этот человек уже добавлен в сделку.")
        instance.restore()
        self.audit(instance, "restore")
        return Response(self.get_serializer(instance).data)

    @action(detail=True, methods=["get"])
    def history(self, request, pk=None):
        instance = self.get_object()
        records = models.RecordHistory.objects.filter(
            model_name=instance._meta.label_lower, record_id=instance.pk
        ).order_by("-created_at")[:100]
        return Response(
            [
                {
                    "id": r.pk,
                    "action": r.action,
                    "created_at": r.created_at,
                    "snapshot": r.snapshot,
                }
                for r in records
            ]
        )


class InsuranceRequestViewSet(RecordViewSet):
    serializer_class = serializers.InsuranceRequestSerializer
    deal_path = "deal"

    @action(detail=True, methods=["post"])
    def close(self, request, pk=None):
        return self.set_open(False)

    @action(detail=True, methods=["post"])
    def reopen(self, request, pk=None):
        return self.set_open(True)

    @transaction.atomic
    def set_open(self, current):
        instance = self.get_object()
        self.authorize(instance)
        instance.is_current = current
        instance.save(update_fields=["is_current", "updated_at"])
        self.audit(instance, "reopen" if current else "close")
        return Response(self.get_serializer(instance).data)

    @action(detail=True, methods=["post"])
    def copy(self, request, pk=None):
        instance = self.get_object()
        self.authorize(instance)
        data = record_data(instance)
        data["title"] += " (копия)"
        data["drivers"] = [
            str(pk) for pk in instance.drivers.values_list("pk", flat=True)
        ]
        serializer = self.get_serializer(data=data)
        serializer.is_valid(raise_exception=True)
        self.perform_create(serializer)
        return Response(serializer.data, status=201)

    @action(detail=True, methods=["get"])
    def passport(self, request, pk=None):
        return Response(request_passport(self.get_object()))

    @action(detail=True, methods=["get"])
    def versions(self, request, pk=None):
        return Response(
            [
                {
                    "id": v.pk,
                    "number": v.number,
                    "snapshot": v.snapshot,
                    "created_at": v.created_at,
                }
                for v in self.get_object().versions.all()
            ]
        )


class VariantViewSet(RecordViewSet):
    serializer_class = serializers.RequestVariantSerializer
    deal_path = "insurance_request__deal"
    http_method_names = ["get", "patch", "head", "options"]


def record_viewset(serializer, deal_path=None):
    return type(
        serializer.Meta.model.__name__ + "ViewSet",
        (RecordViewSet,),
        {"serializer_class": serializer, "deal_path": deal_path},
    )
