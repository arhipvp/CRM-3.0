import uuid

from django.db import migrations, models


def _populate_insurance_references(apps, schema_editor):
    InsuranceCompany = apps.get_model("deals", "InsuranceCompany")
    InsuranceType = apps.get_model("deals", "InsuranceType")
    Quote = apps.get_model("deals", "Quote")

    company_cache: dict[str, object] = {}
    type_cache: dict[str, object] = {}
    default_company = "Не указано"
    default_type = "Не указано"

    for quote in Quote.objects.all().iterator():
        company_key = (getattr(quote, "insurer", None) or "").strip() or default_company
        company = company_cache.get(company_key)
        if company is None:
            company = InsuranceCompany.objects.create(name=company_key)
            company_cache[company_key] = company
        quote.insurance_company_temp_id = company.id

        type_key = (
            getattr(quote, "insurance_type_text", None) or ""
        ).strip() or default_type
        insurance_type = type_cache.get(type_key)
        if insurance_type is None:
            insurance_type = InsuranceType.objects.create(name=type_key)
            type_cache[type_key] = insurance_type
        quote.insurance_type_temp_id = insurance_type.id

        quote.save(update_fields=["insurance_company_temp", "insurance_type_temp"])


class Migration(migrations.Migration):

    dependencies = [
        ("deals", "0009_alter_deal_options"),
    ]

    operations = [
        migrations.CreateModel(
            name="InsuranceCompany",
            fields=[
                (
                    "id",
                    models.UUIDField(
                        default=uuid.uuid4,
                        editable=False,
                        primary_key=True,
                        serialize=False,
                    ),
                ),
                (
                    "deleted_at",
                    models.DateTimeField(blank=True, default=None, null=True),
                ),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                ("name", models.CharField(max_length=255, unique=True)),
                ("description", models.TextField(blank=True)),
            ],
            options={
                "ordering": ["name"],
                "verbose_name": "Страховая компания",
                "verbose_name_plural": "Страховые компании",
            },
        ),
        migrations.CreateModel(
            name="InsuranceType",
            fields=[
                (
                    "id",
                    models.UUIDField(
                        default=uuid.uuid4,
                        editable=False,
                        primary_key=True,
                        serialize=False,
                    ),
                ),
                (
                    "deleted_at",
                    models.DateTimeField(blank=True, default=None, null=True),
                ),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                ("name", models.CharField(max_length=255, unique=True)),
                ("description", models.TextField(blank=True)),
            ],
            options={
                "ordering": ["name"],
                "verbose_name": "Вид страхования",
                "verbose_name_plural": "Виды страхования",
            },
        ),
        migrations.RenameField(
            model_name="quote",
            old_name="insurance_type",
            new_name="insurance_type_text",
        ),
        migrations.AddField(
            model_name="quote",
            name="insurance_company_temp",
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=models.PROTECT,
                related_name="quotes",
                to="deals.InsuranceCompany",
            ),
        ),
        migrations.AddField(
            model_name="quote",
            name="insurance_type_temp",
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=models.PROTECT,
                related_name="quotes",
                to="deals.InsuranceType",
            ),
        ),
        migrations.RunPython(
            code=_populate_insurance_references,
            reverse_code=migrations.RunPython.noop,
        ),
        migrations.RemoveField(model_name="quote", name="insurer"),
        migrations.RemoveField(model_name="quote", name="insurance_type_text"),
        migrations.RenameField(
            model_name="quote",
            old_name="insurance_company_temp",
            new_name="insurance_company",
        ),
        migrations.RenameField(
            model_name="quote",
            old_name="insurance_type_temp",
            new_name="insurance_type",
        ),
        migrations.AlterField(
            model_name="quote",
            name="insurance_company",
            field=models.ForeignKey(
                on_delete=models.PROTECT,
                related_name="quotes",
                to="deals.InsuranceCompany",
            ),
        ),
        migrations.AlterField(
            model_name="quote",
            name="insurance_type",
            field=models.ForeignKey(
                on_delete=models.PROTECT,
                related_name="quotes",
                to="deals.InsuranceType",
            ),
        ),
    ]
