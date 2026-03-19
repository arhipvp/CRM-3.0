from decimal import Decimal, InvalidOperation

from django.db import migrations, models


def parse_legacy_deductible(value):
    if value is None:
        return None

    normalized = str(value).strip().lower()
    if not normalized:
        return None

    for token in ("\xa0", " ", "₽", "руб.", "руб"):
        normalized = normalized.replace(token, "")
    normalized = normalized.replace(",", ".")

    if normalized.count(".") > 1:
        return None

    try:
        return Decimal(normalized)
    except (InvalidOperation, ValueError):
        return None


def forwards_copy_deductible(apps, schema_editor):
    Quote = apps.get_model("deals", "Quote")

    for quote in Quote.objects.all().iterator():
        quote.deductible_amount = parse_legacy_deductible(quote.deductible)
        quote.save(update_fields=["deductible_amount"])


def backwards_copy_deductible(apps, schema_editor):
    Quote = apps.get_model("deals", "Quote")

    for quote in Quote.objects.all().iterator():
        quote.deductible = (
            format(quote.deductible_amount, "f")
            if quote.deductible_amount is not None
            else ""
        )
        quote.save(update_fields=["deductible"])


class Migration(migrations.Migration):
    dependencies = [
        ("deals", "0029_alter_deal_next_contact_date"),
    ]

    operations = [
        migrations.AddField(
            model_name="quote",
            name="deductible_amount",
            field=models.DecimalField(
                blank=True,
                decimal_places=2,
                help_text="Франшиза",
                max_digits=12,
                null=True,
            ),
        ),
        migrations.RunPython(forwards_copy_deductible, backwards_copy_deductible),
        migrations.RenameField(
            model_name="quote",
            old_name="deductible",
            new_name="deductible_legacy",
        ),
        migrations.RenameField(
            model_name="quote",
            old_name="deductible_amount",
            new_name="deductible",
        ),
        migrations.RemoveField(
            model_name="quote",
            name="deductible_legacy",
        ),
    ]
