from apps.common.models import SoftDeleteModel
from django.conf import settings
from django.db import models, transaction
from django.db.models import Q


class CurrentRecord(SoftDeleteModel):
    is_current = models.BooleanField(default=True)

    class Meta:
        abstract = True
        ordering = ["-created_at"]


class LinkedRecord(CurrentRecord):
    source_links = models.JSONField(default=list, blank=True)

    class Meta(CurrentRecord.Meta):
        abstract = True


class DealParticipant(CurrentRecord):
    deal = models.ForeignKey(
        "deals.Deal", on_delete=models.CASCADE, related_name="participants"
    )
    client = models.ForeignKey(
        "clients.Client", on_delete=models.PROTECT, related_name="deal_participations"
    )

    class Meta(CurrentRecord.Meta):
        constraints = [
            models.UniqueConstraint(
                fields=["deal", "client"],
                condition=Q(deleted_at__isnull=True),
                name="unique_live_deal_participant",
            )
        ]


class PersonalDocument(LinkedRecord):
    client = models.ForeignKey("clients.Client", on_delete=models.PROTECT)
    series = models.CharField(max_length=30, blank=True)
    number = models.CharField(max_length=50, blank=True)
    issue_date = models.DateField(null=True, blank=True)
    current_owner_field = "client"

    class Meta(LinkedRecord.Meta):
        abstract = True
        constraints = [
            models.UniqueConstraint(
                fields=["client"],
                condition=Q(is_current=True, deleted_at__isnull=True),
                name="%(class)s_current_client",
            )
        ]

    def save(self, *args, **kwargs):
        with transaction.atomic():
            owner = self._meta.get_field(self.current_owner_field).remote_field.model
            owner.objects.with_deleted().select_for_update().get(
                pk=getattr(self, f"{self.current_owner_field}_id")
            )
            if self.is_current and self.deleted_at is None:
                previous = (
                    type(self)
                    .objects.filter(
                        **{
                            self.current_owner_field: getattr(
                                self, self.current_owner_field
                            )
                        },
                        is_current=True,
                    )
                    .exclude(pk=self.pk)
                )
                from .services import record_data

                for document in previous:
                    RecordHistory.objects.create(
                        model_name=document._meta.label_lower,
                        record_id=document.pk,
                        actor=None,
                        action="before_deactivate",
                        snapshot=record_data(document),
                    )
                    document.is_current = False
                    models.Model.save(
                        document, update_fields=["is_current", "updated_at"]
                    )
                    RecordHistory.objects.create(
                        model_name=document._meta.label_lower,
                        record_id=document.pk,
                        actor=None,
                        action="deactivate",
                        snapshot=record_data(document),
                    )
            return models.Model.save(self, *args, **kwargs)


class ClientPassport(PersonalDocument):
    issued_by = models.CharField(max_length=500, blank=True)
    department_code = models.CharField(max_length=20, blank=True)


class DriverLicense(PersonalDocument):
    country = models.CharField(max_length=100, default="РФ")
    expiry_date = models.DateField(null=True, blank=True)
    experience_start = models.DateField(null=True, blank=True)


class Vehicle(LinkedRecord):
    deal = models.ForeignKey(
        "deals.Deal", on_delete=models.CASCADE, related_name="vehicles"
    )
    title = models.CharField(max_length=255)
    vin = models.CharField(max_length=17, blank=True)
    brand = models.CharField(max_length=100, blank=True)
    model = models.CharField(max_length=100, blank=True)
    year = models.PositiveSmallIntegerField(null=True, blank=True)
    plate = models.CharField(max_length=30, blank=True)
    has_no_plate = models.BooleanField(default=False)
    power_hp = models.DecimalField(
        max_digits=8, decimal_places=2, null=True, blank=True
    )
    mileage = models.PositiveIntegerField(null=True, blank=True)
    mileage_date = models.DateField(null=True, blank=True)
    key_count = models.PositiveSmallIntegerField(default=2)
    notes = models.TextField(blank=True)


class VehicleDocument(LinkedRecord):
    vehicle = models.ForeignKey(Vehicle, on_delete=models.PROTECT)
    series = models.CharField(max_length=30, blank=True)
    number = models.CharField(max_length=50, blank=True)
    issue_date = models.DateField(null=True, blank=True)
    current_owner_field = "vehicle"
    save = PersonalDocument.save

    class Meta(LinkedRecord.Meta):
        abstract = True
        constraints = [
            models.UniqueConstraint(
                fields=["vehicle"],
                condition=Q(is_current=True, deleted_at__isnull=True),
                name="%(class)s_current_vehicle",
            )
        ]


class VehicleRegistration(VehicleDocument):
    pass


class VehicleTitle(VehicleDocument):
    document_type = models.CharField(
        max_length=4, choices=[("pts", "ПТС"), ("epts", "ЭПТС")], default="pts"
    )


class Mortgage(LinkedRecord):
    deal = models.ForeignKey(
        "deals.Deal", on_delete=models.CASCADE, related_name="mortgages"
    )
    title = models.CharField(max_length=255)
    bank = models.ForeignKey(
        "deals.Bank", on_delete=models.PROTECT, null=True, blank=True
    )
    agreement_number = models.CharField(max_length=255, blank=True)
    agreement_date = models.DateField(null=True, blank=True)
    end_date = models.DateField(null=True, blank=True)
    interest_rate = models.DecimalField(
        max_digits=7, decimal_places=3, null=True, blank=True
    )
    property_type = models.CharField(max_length=100, blank=True)
    address = models.TextField(blank=True)
    cadastral_number = models.CharField(max_length=100, blank=True)
    area = models.DecimalField(max_digits=12, decimal_places=2, null=True, blank=True)
    construction_year = models.PositiveSmallIntegerField(null=True, blank=True)
    notes = models.TextField(blank=True)


class MortgageBalance(LinkedRecord):
    mortgage = models.ForeignKey(
        Mortgage, on_delete=models.PROTECT, related_name="balances"
    )
    amount = models.DecimalField(max_digits=16, decimal_places=2)
    as_of_date = models.DateField()


class Platform(CurrentRecord):
    name = models.CharField(max_length=255, unique=True)


class InsuranceRequest(CurrentRecord):
    deal = models.ForeignKey(
        "deals.Deal", on_delete=models.CASCADE, related_name="insurance_requests"
    )
    title = models.CharField(max_length=255)
    insurance_type = models.ForeignKey("deals.InsuranceType", on_delete=models.PROTECT)
    vehicle = models.ForeignKey(
        Vehicle, on_delete=models.PROTECT, null=True, blank=True
    )
    mortgage = models.ForeignKey(
        Mortgage, on_delete=models.PROTECT, null=True, blank=True
    )
    start_date = models.DateField(null=True, blank=True)
    end_date = models.DateField(null=True, blank=True)
    notes = models.TextField(blank=True)
    policyholder = models.ForeignKey(
        "clients.Client",
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        related_name="policyholder_requests",
    )
    owner = models.ForeignKey(
        "clients.Client",
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        related_name="owner_requests",
    )
    borrower = models.ForeignKey(
        "clients.Client",
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        related_name="borrower_requests",
    )
    insured_person = models.ForeignKey(
        "clients.Client",
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        related_name="insured_requests",
    )
    drivers = models.ManyToManyField(
        "clients.Client", blank=True, related_name="driver_requests"
    )
    unlimited_drivers = models.BooleanField(default=False)
    targets = models.JSONField(default=list)
    deductibles = models.JSONField(default=list, blank=True)
    official_dealer = models.BooleanField(null=True, blank=True)
    vehicle_value_mode = models.CharField(
        max_length=10,
        choices=[("fixed", "Фиксированная"), ("maximum", "Максимальная")],
        blank=True,
    )
    vehicle_value = models.DecimalField(
        max_digits=16, decimal_places=2, null=True, blank=True
    )
    mortgage_balance = models.ForeignKey(
        MortgageBalance, on_delete=models.PROTECT, null=True, blank=True
    )
    mortgage_bank = models.ForeignKey(
        "deals.Bank", on_delete=models.PROTECT, null=True, blank=True
    )
    mortgage_amount = models.DecimalField(
        max_digits=16, decimal_places=2, null=True, blank=True
    )
    mortgage_amount_date = models.DateField(null=True, blank=True)
    version = models.PositiveIntegerField(default=0)

    class Meta(CurrentRecord.Meta):
        constraints = [
            models.CheckConstraint(
                condition=(
                    Q(vehicle__isnull=False, mortgage__isnull=True)
                    | Q(vehicle__isnull=True, mortgage__isnull=False)
                ),
                name="request_exactly_one_object",
            )
        ]


class RequestVersion(models.Model):
    insurance_request = models.ForeignKey(
        InsuranceRequest, on_delete=models.PROTECT, related_name="versions"
    )
    number = models.PositiveIntegerField()
    snapshot = models.JSONField(default=dict)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=["insurance_request", "number"], name="request_version_number"
            )
        ]
        ordering = ["-number"]


class RequestVariant(CurrentRecord):
    insurance_request = models.ForeignKey(
        InsuranceRequest, on_delete=models.PROTECT, related_name="variants"
    )
    request_version = models.ForeignKey(
        RequestVersion, on_delete=models.PROTECT, related_name="variants"
    )
    insurance_company = models.ForeignKey(
        "deals.InsuranceCompany", on_delete=models.PROTECT
    )
    platform = models.ForeignKey(Platform, on_delete=models.PROTECT)
    deductible = models.DecimalField(
        max_digits=12, decimal_places=2, null=True, blank=True
    )
    status = models.CharField(
        max_length=20,
        default="pending",
        choices=[
            ("pending", "Ожидает расчёта"),
            ("quoted", "Предложения получены"),
            ("declined", "Отказ"),
            ("failed", "Не удалось рассчитать"),
        ],
    )
    explanation = models.TextField(blank=True)


class RecordHistory(models.Model):
    model_name = models.CharField(max_length=100)
    record_id = models.UUIDField()
    actor = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True
    )
    action = models.CharField(max_length=20)
    snapshot = models.JSONField(default=dict)
    created_at = models.DateTimeField(auto_now_add=True)
