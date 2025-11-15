from apps.common.models import SoftDeleteModel
from django.db import models


class Policy(SoftDeleteModel):
    """Insurance policy bound to a deal."""

    number = models.CharField(
        max_length=50, help_text="Policy number", unique=True
    )
    insurance_company = models.ForeignKey(
        "deals.InsuranceCompany",
        related_name="policies",
        on_delete=models.PROTECT,
        help_text="Insurance company",
    )
    insurance_type = models.ForeignKey(
        "deals.InsuranceType",
        related_name="policies",
        on_delete=models.PROTECT,
        help_text="Insurance type",
    )

    deal = models.ForeignKey(
        "deals.Deal",
        related_name="policies",
        on_delete=models.CASCADE,
        help_text="Deal",
    )

    client = models.ForeignKey(
        "clients.Client",
        related_name="policies",
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        help_text="Client",
    )

    is_vehicle = models.BooleanField(
        default=False, help_text="True when the policy is for a vehicle"
    )
    brand = models.CharField(
        max_length=255,
        blank=True,
        help_text="Vehicle make",
        verbose_name="Brand",
    )
    model = models.CharField(
        max_length=255,
        blank=True,
        help_text="Vehicle model",
        verbose_name="Model",
    )
    vin = models.CharField(
        max_length=17,
        blank=True,
        help_text="Vehicle VIN (17 characters)",
    )

    counterparty = models.CharField(
        max_length=255,
        blank=True,
        help_text="Контрагент полиса (физическое или юридическое лицо)",
    )
    start_date = models.DateField(
        null=True,
        blank=True,
        help_text="Policy start date",
    )
    end_date = models.DateField(
        null=True,
        blank=True,
        help_text="Policy end date",
    )

    status = models.CharField(
        max_length=50,
        default="active",
        help_text="Status (active, expired, canceled etc.)",
    )

    class Meta:
        ordering = ["-created_at"]
        verbose_name = "Policy"
        verbose_name_plural = "Policies"
        indexes = [
            models.Index(fields=["number"]),
            models.Index(fields=["deal"]),
            models.Index(fields=["insurance_company"]),
            models.Index(fields=["insurance_type"]),
            models.Index(fields=["client"]),
        ]

    def __str__(self) -> str:
        company = self.insurance_company.name if self.insurance_company else "-"
        type_name = self.insurance_type.name if self.insurance_type else "-"
        client_name = self.client.name if self.client else None
        client_suffix = f" - {client_name}" if client_name else ""
        return f"Policy {self.number} ({type_name} - {company}){client_suffix}"

    def save(self, *args, **kwargs):
        if self.deal_id and not self.client_id:
            client_id = getattr(self.deal, "client_id", None)
            if not client_id:
                from apps.deals.models import Deal

                client_id = (
                    Deal.objects.filter(pk=self.deal_id)
                    .values_list("client_id", flat=True)
                    .first()
                )
            if client_id:
                self.client_id = client_id

        super().save(*args, **kwargs)
