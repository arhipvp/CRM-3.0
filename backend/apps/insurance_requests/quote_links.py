"""Validate links to requests without changing historical snapshots."""

from decimal import Decimal

from rest_framework.exceptions import ValidationError


def _effective(attrs, instance, field):
    return attrs.get(field, getattr(instance, field, None))


def validate_quote_links(attrs, instance=None):
    attrs = attrs.copy()
    variant = _effective(attrs, instance, "request_variant")
    application = _effective(attrs, instance, "insurance_request")
    version = _effective(attrs, instance, "request_version")
    if not any((variant, application, version)):
        return attrs
    if variant is None:
        raise ValidationError({"request_variant": "Выберите вариант расчёта заявки."})
    if application and application.pk != variant.insurance_request_id:
        raise ValidationError(
            {"insurance_request": "Вариант относится к другой заявке."}
        )
    if version and version.pk != variant.request_version_id:
        raise ValidationError({"request_version": "Вариант относится к другой версии."})
    application = variant.insurance_request
    version = variant.request_version
    if version.insurance_request_id != application.pk:
        raise ValidationError({"request_version": "Версия относится к другой заявке."})
    deal = _effective(attrs, instance, "deal")
    if deal is None or deal.pk != application.deal_id or deal.deleted_at:
        raise ValidationError(
            {"insurance_request": "Заявка не принадлежит этой сделке."}
        )
    historical = instance is not None and instance.request_variant_id == variant.pk
    if not historical and (
        application.deleted_at
        or not application.is_current
        or variant.deleted_at
        or not variant.is_current
        or version.number != application.version
    ):
        raise ValidationError(
            {"request_variant": "Выберите актуальный вариант открытой заявки."}
        )
    if not historical:
        from .services import request_snapshot

        live = request_snapshot(application)
        saved = dict(version.snapshot)
        for field in ("is_current", "version"):
            live.pop(field, None)
            saved.pop(field, None)
        if live != saved:
            raise ValidationError(
                {
                    "request_version": "Исходные данные изменились. Сохраните новую версию заявки перед расчётом."
                }
            )
    company = _effective(attrs, instance, "insurance_company")
    if company is None or company.pk != variant.insurance_company_id:
        raise ValidationError(
            {"insurance_company": "Страховщик не соответствует варианту заявки."}
        )
    kind = _effective(attrs, instance, "insurance_type")
    # Insurance type is checked against the saved version, not a later edited request.
    snapshot = version.snapshot
    expected_type = snapshot.get("insurance_type", str(application.insurance_type_id))
    if kind is None or str(kind.pk) != str(expected_type):
        raise ValidationError(
            {"insurance_type": "Вид страхования не соответствует заявке."}
        )
    if variant.deductible is not None:
        actual = _effective(attrs, instance, "deductible")
        if actual is None or Decimal(str(actual)) != variant.deductible:
            raise ValidationError(
                {"deductible": "Франшиза не соответствует варианту заявки."}
            )
        if _effective(attrs, instance, "official_dealer") != snapshot.get(
            "official_dealer"
        ):
            raise ValidationError(
                {"official_dealer": "Условие ремонта не соответствует заявке."}
            )
        if snapshot.get("vehicle_value_mode") == "fixed":
            amount = _effective(attrs, instance, "sum_insured")
            expected = snapshot.get("vehicle_value")
            if (
                amount is None
                or expected is None
                or Decimal(str(amount)) != Decimal(str(expected))
            ):
                raise ValidationError(
                    {"sum_insured": "Страховая сумма не соответствует заявке."}
                )
    attrs.update(
        insurance_request=application, request_version=version, request_variant=variant
    )
    return attrs


def validate_policy_link(attrs, instance=None):
    attrs = attrs.copy()
    application = _effective(attrs, instance, "insurance_request")
    if application is None:
        return attrs
    deal = _effective(attrs, instance, "deal")
    if deal is None or deal.pk != application.deal_id or deal.deleted_at:
        raise ValidationError(
            {"insurance_request": "Заявка не принадлежит этой сделке."}
        )
    if (
        instance is None or instance.insurance_request_id != application.pk
    ) and application.deleted_at:
        raise ValidationError({"insurance_request": "Удалённую заявку нельзя выбрать."})
    kind = _effective(attrs, instance, "insurance_type")
    if kind and kind.pk != application.insurance_type_id:
        raise ValidationError(
            {"insurance_type": "Вид страхования не соответствует заявке."}
        )
    if instance is None and not attrs.get("client") and not attrs.get("client_name"):
        if application.policyholder_id:
            attrs["client"] = application.policyholder
        else:
            raise ValidationError({"client": "Укажите страхователя полиса."})
    return attrs
