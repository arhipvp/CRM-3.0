import re
from datetime import date
from decimal import Decimal, InvalidOperation

from apps.clients.models import Client
from apps.deals.models import InsuranceCompany
from django.core.exceptions import ValidationError as DjangoValidationError
from django.core.validators import URLValidator
from rest_framework import serializers

from . import models


class RecordSerializer(serializers.ModelSerializer):
    class Meta:
        fields = "__all__"
        read_only_fields = ["id", "deleted_at", "created_at", "updated_at"]
        validators = []

    def validate_source_links(self, value):
        if not isinstance(value, list) or len(value) > 100:
            raise serializers.ValidationError("Укажите список не более 100 ссылок.")
        for link in value:
            if not isinstance(link, dict) or set(link) - {"url", "label"}:
                raise serializers.ValidationError("Ожидаются поля url и label.")
            try:
                URLValidator(schemes=["http", "https"])(link.get("url", ""))
            except DjangoValidationError as exc:
                raise serializers.ValidationError(
                    "Некорректная HTTP(S) ссылка."
                ) from exc
            if (
                not isinstance(link.get("label", ""), str)
                or len(link.get("label", "")) > 255
            ):
                raise serializers.ValidationError(
                    "Подпись ссылки не длиннее 255 символов."
                )
        return value

    def to_internal_value(self, data):
        data = data.copy()
        value = data.get("experience_start")
        if value and len(str(value)) == 4 and str(value).isdigit():
            data["experience_start"] = f"{value}-12-31"
        return super().to_internal_value(data)

    def validate(self, attrs):
        for name, value in attrs.items():
            if isinstance(value, Decimal) and (not value.is_finite() or value < 0):
                raise serializers.ValidationError(
                    {name: "Значение должно быть неотрицательным."}
                )
            if isinstance(value, (models.CurrentRecord, Client)) and (
                value.deleted_at
                or (isinstance(value, models.CurrentRecord) and not value.is_current)
            ):
                if (
                    not self.instance
                    or getattr(self.instance, f"{name}_id", None) != value.pk
                ):
                    raise serializers.ValidationError(
                        {name: "Запись неактуальна или удалена."}
                    )
        if attrs.get(
            "has_no_plate", getattr(self.instance, "has_no_plate", False)
        ) and attrs.get("plate", getattr(self.instance, "plate", "")):
            raise serializers.ValidationError(
                {"plate": "Снимите отметку «Без госномера»."}
            )
        if attrs.get("vin") and not re.fullmatch(
            r"[A-HJ-NPR-Z0-9]{17}", attrs["vin"].upper()
        ):
            raise serializers.ValidationError(
                {"vin": "VIN должен содержать 17 латинских букв и цифр без I, O, Q."}
            )
        if attrs.get("vin"):
            attrs["vin"] = attrs["vin"].upper()
        for key in ("year", "construction_year"):
            if (
                attrs.get(key) is not None
                and not 1800 <= attrs[key] <= date.today().year + 1
            ):
                raise serializers.ValidationError({key: "Некорректный год."})
        issue = attrs.get("issue_date", getattr(self.instance, "issue_date", None))
        expiry = attrs.get("expiry_date", getattr(self.instance, "expiry_date", None))
        if issue and expiry and expiry < issue:
            raise serializers.ValidationError(
                {"expiry_date": "Дата окончания раньше выдачи."}
            )
        agreement = attrs.get(
            "agreement_date", getattr(self.instance, "agreement_date", None)
        )
        end = attrs.get("end_date", getattr(self.instance, "end_date", None))
        if agreement and end and end < agreement:
            raise serializers.ValidationError(
                {"end_date": "Дата окончания кредита раньше даты договора."}
            )
        if self.instance:
            for field in ("deal", "client", "vehicle", "mortgage"):
                if isinstance(self.instance, models.InsuranceRequest) and field in {
                    "vehicle",
                    "mortgage",
                }:
                    continue
                if field in attrs and getattr(
                    self.instance, f"{field}_id", None
                ) != getattr(attrs[field], "pk", None):
                    raise serializers.ValidationError(
                        {field: "Перенос записи запрещён."}
                    )
        return attrs


def record_serializer(model):
    return type(
        f"{model.__name__}Serializer",
        (RecordSerializer,),
        {"Meta": type("Meta", (RecordSerializer.Meta,), {"model": model})},
    )


class ParticipantSerializer(RecordSerializer):
    client_name = serializers.CharField(source="client.name", read_only=True)
    client_deleted_at = serializers.DateTimeField(
        source="client.deleted_at", read_only=True
    )

    class Meta(RecordSerializer.Meta):
        model = models.DealParticipant

    def validate(self, attrs):
        attrs = super().validate(attrs)
        deal = attrs.get("deal", getattr(self.instance, "deal", None))
        client = attrs.get("client", getattr(self.instance, "client", None))
        existing = models.DealParticipant.objects.filter(deal=deal, client=client)
        if self.instance:
            existing = existing.exclude(pk=self.instance.pk)
        if existing.exists():
            raise serializers.ValidationError("Человек уже добавлен в сделку.")
        return attrs


PassportSerializer = record_serializer(models.ClientPassport)
DriverLicenseSerializer = record_serializer(models.DriverLicense)
VehicleSerializer = record_serializer(models.Vehicle)
VehicleRegistrationSerializer = record_serializer(models.VehicleRegistration)
VehicleTitleSerializer = record_serializer(models.VehicleTitle)
MortgageSerializer = record_serializer(models.Mortgage)
MortgageSerializer._declared_fields["bank_name"] = serializers.CharField(
    source="bank.name", read_only=True, default=""
)
MortgageBalanceSerializer = record_serializer(models.MortgageBalance)
PlatformSerializer = record_serializer(models.Platform)


class RequestVariantSerializer(RecordSerializer):
    class Meta(RecordSerializer.Meta):
        model = models.RequestVariant
        read_only_fields = RecordSerializer.Meta.read_only_fields + [
            "insurance_request",
            "request_version",
            "insurance_company",
            "platform",
            "deductible",
            "is_current",
        ]

    def validate(self, attrs):
        attrs = super().validate(attrs)
        if (
            attrs.get("status", getattr(self.instance, "status", None))
            in {"failed", "declined"}
            and not attrs.get(
                "explanation", getattr(self.instance, "explanation", "")
            ).strip()
        ):
            raise serializers.ValidationError({"explanation": "Укажите причину."})
        if self.instance and (
            not self.instance.insurance_request.is_current
            or self.instance.request_version.number
            != self.instance.insurance_request.version
        ):
            raise serializers.ValidationError(
                "Вариант закрыт или относится к старой версии."
            )
        return attrs


class InsuranceRequestSerializer(RecordSerializer):
    variants = RequestVariantSerializer(many=True, read_only=True)
    missing_fields = serializers.SerializerMethodField()
    sources_changed = serializers.SerializerMethodField()
    linked_quotes = serializers.SerializerMethodField()
    linked_policies = serializers.SerializerMethodField()

    def get_linked_quotes(self, obj):
        return [
            {
                "id": str(q.pk),
                "insurance_company": (
                    str(q.insurance_company_id) if q.insurance_company_id else None
                ),
                "insurance_company_name": (
                    q.insurance_company.name if q.insurance_company else ""
                ),
                "premium": str(q.premium),
                "sum_insured": (
                    str(q.sum_insured) if q.sum_insured is not None else None
                ),
                "deductible": str(q.deductible) if q.deductible is not None else None,
                "official_dealer": q.official_dealer,
                "request_variant": (
                    str(q.request_variant_id) if q.request_variant_id else None
                ),
                "request_version": q.request_version_id,
                "comments": q.comments,
            }
            for q in obj.quotes.select_related("insurance_company").all()
        ]

    def get_linked_policies(self, obj):
        return [
            {
                "id": str(p.pk),
                "number": p.number,
                "insurance_company_name": (
                    p.insurance_company.name if p.insurance_company else ""
                ),
            }
            for p in obj.policies.select_related("insurance_company").all()
        ]

    def get_sources_changed(self, obj):
        from .services import request_snapshot

        latest = obj.versions.first()
        return latest is None or latest.snapshot != request_snapshot(obj)

    class Meta(RecordSerializer.Meta):
        model = models.InsuranceRequest
        read_only_fields = RecordSerializer.Meta.read_only_fields + [
            "version",
            "mortgage_bank",
            "mortgage_amount",
            "mortgage_amount_date",
            "is_current",
        ]

    def get_missing_fields(self, obj):
        fields = ["policyholder", "owner", "start_date", "end_date"]
        if obj.mortgage_id:
            fields += ["borrower", "mortgage_balance"]
            if "жизн" in obj.insurance_type.name.casefold():
                fields.append("insured_person")
        missing = [name for name in fields if not getattr(obj, name)]
        if obj.vehicle_id and not obj.unlimited_drivers and not obj.drivers.exists():
            missing.append("drivers")
        return missing

    def validate(self, attrs):
        attrs = super().validate(attrs)

        def value(name, default=None):
            return attrs.get(name, getattr(self.instance, name, default))

        deal = value("deal")
        vehicle, mortgage = value("vehicle"), value("mortgage")
        if bool(vehicle) == bool(mortgage):
            raise serializers.ValidationError("Выберите ровно один объект.")
        obj = vehicle or mortgage
        if obj.deal_id != deal.pk:
            raise serializers.ValidationError("Объект принадлежит другой сделке.")
        participants = set(
            models.DealParticipant.objects.filter(
                deal=deal,
                is_current=True,
                client__deleted_at__isnull=True,
            ).values_list("client_id", flat=True)
        )
        for name in ["policyholder", "owner", "borrower", "insured_person"]:
            person = value(name)
            if person and person.pk not in participants:
                raise serializers.ValidationError(
                    {name: "Человек не является актуальным участником сделки."}
                )
        drivers = attrs.get(
            "drivers", list(self.instance.drivers.all()) if self.instance else []
        )
        if any(driver.pk not in participants for driver in drivers):
            raise serializers.ValidationError(
                {"drivers": "Выберите участников сделки."}
            )
        if value("unlimited_drivers", False) and drivers:
            raise serializers.ValidationError(
                {"drivers": "Выберите список водителей или без ограничений."}
            )
        if mortgage and (drivers or value("unlimited_drivers", False)):
            raise serializers.ValidationError(
                {"drivers": "Водители относятся только к автомобилю."}
            )
        if vehicle and (
            value("borrower") or value("insured_person") or value("mortgage_balance")
        ):
            raise serializers.ValidationError(
                "Ипотечные роли и остаток не относятся к автомобилю."
            )
        if (
            value("start_date")
            and value("end_date")
            and value("end_date") < value("start_date")
        ):
            raise serializers.ValidationError(
                {"end_date": "Дата окончания раньше начала."}
            )
        targets = value("targets", [])
        if not isinstance(targets, list) or not targets or len(targets) > 100:
            raise serializers.ValidationError(
                {"targets": "Выберите от 1 до 100 направлений расчёта."}
            )
        normalized = []
        for target in targets:
            try:
                company = InsuranceCompany.objects.get(pk=target["insurance_company"])
                platform = models.Platform.objects.get(
                    pk=target["platform"], is_current=True
                )
            except (
                KeyError,
                TypeError,
                ValueError,
                DjangoValidationError,
                InsuranceCompany.DoesNotExist,
                models.Platform.DoesNotExist,
            ) as exc:
                raise serializers.ValidationError(
                    {"targets": "Недоступный страховщик или платформа."}
                ) from exc
            item = {"insurance_company": str(company.pk), "platform": str(platform.pk)}
            if item in normalized:
                raise serializers.ValidationError(
                    {"targets": "Повтор направления расчёта."}
                )
            normalized.append(item)
        attrs["targets"] = normalized
        casco = "каско" in value("insurance_type").name.casefold()
        type_name = value("insurance_type").name.casefold()
        if "осаго" in type_name and not vehicle:
            raise serializers.ValidationError("ОСАГО требует автомобиль.")
        if (
            any(word in type_name for word in ("ипотек", "жизн", "недвижим"))
            and not mortgage
        ):
            raise serializers.ValidationError("Этот вид страхования требует ипотеку.")
        if not casco and (
            value("official_dealer") is not None
            or any(
                value(name)
                for name in ("deductibles", "vehicle_value_mode", "vehicle_value")
            )
        ):
            raise serializers.ValidationError(
                "Условия КАСКО допустимы только для КАСКО."
            )
        if casco:
            if not isinstance(value("deductibles", []), list):
                raise serializers.ValidationError(
                    {"deductibles": "Ожидается список франшиз."}
                )
            if not vehicle:
                raise serializers.ValidationError("КАСКО требует автомобиль.")
            values = value("deductibles", [])
            try:
                numbers = [Decimal(str(v)) for v in values]
                valid = (
                    bool(numbers)
                    and len(numbers) <= 20
                    and all(
                        n.is_finite()
                        and 0 <= n <= Decimal("9999999999.99")
                        and n.as_tuple().exponent >= -2
                        for n in numbers
                    )
                    and len(set(numbers)) == len(numbers)
                )
            except (InvalidOperation, TypeError):
                valid = False
            if not valid:
                raise serializers.ValidationError(
                    {
                        "deductibles": "Укажите разные неотрицательные франшизы, до двух знаков после запятой."
                    }
                )
            attrs["deductibles"] = [str(n) for n in numbers]
            if value("official_dealer") is None:
                raise serializers.ValidationError(
                    {"official_dealer": "Выберите условия ремонта."}
                )
            if value("vehicle_value_mode") not in {"fixed", "maximum"} or (
                value("vehicle_value_mode") == "fixed"
                and (not value("vehicle_value") or value("vehicle_value") <= 0)
            ):
                raise serializers.ValidationError(
                    {"vehicle_value": "Укажите стоимость или выберите максимум."}
                )
        balance = value("mortgage_balance")
        if balance and (not mortgage or balance.mortgage_id != mortgage.pk):
            raise serializers.ValidationError(
                {"mortgage_balance": "Остаток относится к другой ипотеке."}
            )
        return attrs

    def create(self, validated_data):
        from .services import save_request

        return save_request(self, validated_data)

    def update(self, instance, validated_data):
        from .services import save_request

        return save_request(self, validated_data, instance)
