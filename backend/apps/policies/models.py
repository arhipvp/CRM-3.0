from apps.common.models import SoftDeleteModel
from django.db import models
from django.db.models import Q


class Policy(SoftDeleteModel):
    """Insurance policy bound to a deal."""

    class PolicyStatus(models.TextChoices):
        ACTIVE = "active", "Active"
        INACTIVE = "inactive", "Inactive"
        EXPIRED = "expired", "Expired"
        CANCELED = "canceled", "Canceled"

    number = models.CharField(max_length=50, help_text="Policy number")
    insurance_company = models.ForeignKey(
        "deals.InsuranceCompany",
        related_name="policies",
        on_delete=models.SET_NULL,
        help_text="Insurance company",
        null=True,
        blank=True,
    )
    insurance_type = models.ForeignKey(
        "deals.InsuranceType",
        related_name="policies",
        on_delete=models.SET_NULL,
        help_text="Insurance type",
        null=True,
        blank=True,
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

    # LEGACY/DEPRECATED:
    # Поле оставлено только для обратной совместимости со старыми данными/API.
    # В актуальной бизнес-логике источником "страхователя" является поле `client`.
    # Новые сценарии должны ориентироваться на `client`, а не на `insured_client`.
    insured_client = models.ForeignKey(
        "clients.Client",
        related_name="insured_policies",
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        help_text="(Legacy) Insured client; kept for backward compatibility.",
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
    sales_channel = models.ForeignKey(
        "deals.SalesChannel",
        related_name="policies",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        help_text="Канал продаж",
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
        choices=PolicyStatus.choices,
        default=PolicyStatus.ACTIVE,
        help_text="Status (active, inactive, expired, canceled).",
    )
    drive_folder_id = models.CharField(
        max_length=255, blank=True, null=True, help_text="Google Drive folder ID"
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
            models.Index(fields=["insured_client"]),
            models.Index(
                fields=["sales_channel"], name="policies_po_sales_c_51cd4d_idx"
            ),
        ]
        constraints = [
            models.UniqueConstraint(
                fields=["number"],
                condition=Q(deleted_at__isnull=True),
                name="policies_unique_active_number",
            ),
            models.CheckConstraint(
                check=~Q(number__regex=r"^\s*$"),
                name="policies_number_not_empty",
            ),
        ]

    def __str__(self) -> str:
        company = self.insurance_company.name if self.insurance_company else "-"
        type_name = self.insurance_type.name if self.insurance_type else "-"
        client_name = self.client.name if self.client else None
        client_suffix = f" - {client_name}" if client_name else ""
        return f"Policy {self.number} ({type_name} - {company}){client_suffix}"

    def save(self, *args, **kwargs):
        deal_client_id = getattr(self.deal, "client_id", None)
        if self.deal_id and not deal_client_id:
            from apps.deals.models import Deal

            deal_client_id = (
                Deal.objects.filter(pk=self.deal_id)
                .values_list("client_id", flat=True)
                .first()
            )

        resolved_client_id = self.client_id or deal_client_id
        if resolved_client_id and not self.client_id:
            self.client_id = resolved_client_id
        # LEGACY/DEPRECATED behavior:
        # поддерживаем historical mirror в insured_client для обратной совместимости.
        if self.client_id and not self.insured_client_id:
            self.insured_client_id = self.client_id

        super().save(*args, **kwargs)

    def delete(self, *args, **kwargs):
        """Когда удаляем платежи при удалении полиса."""
        for payment in self.payments.all():
            payment.delete()
        super().delete(*args, **kwargs)
