from django.db import migrations


def forwards(apps, schema_editor):
    Statement = apps.get_model("finances", "Statement")
    FinancialRecord = apps.get_model("finances", "FinancialRecord")

    # If a statement has paid_at set, all its records should be "conducted" with that date.
    for statement in Statement.objects.filter(paid_at__isnull=False).only("id", "paid_at"):
        FinancialRecord.objects.filter(
            statement_id=statement.id,
            deleted_at__isnull=True,
            date__isnull=True,
        ).update(date=statement.paid_at)


def backwards(apps, schema_editor):
    # No safe reverse operation.
    return


class Migration(migrations.Migration):
    dependencies = [
        ("finances", "0008_statement_drive_folder_id"),
    ]

    operations = [
        migrations.RunPython(forwards, backwards),
    ]
