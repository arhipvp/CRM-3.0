from django.db import migrations, models
from django.db.models import Q


def migrate_deadlines(apps, schema_editor):
    Deal = apps.get_model("deals", "Deal")
    Policy = apps.get_model("policies", "Policy")
    Payment = apps.get_model("finances", "Payment")

    for deal in Deal.objects.all().only(
        "id", "expected_close", "manual_expected_close"
    ):
        manual_deadline = deal.expected_close
        Deal.objects.filter(pk=deal.pk).update(manual_expected_close=manual_deadline)

        policy_deadline = (
            Policy.objects.filter(
                deal_id=deal.pk,
                deleted_at__isnull=True,
                end_date__isnull=False,
                is_renewed=False,
            )
            .order_by("end_date")
            .values_list("end_date", flat=True)
            .first()
        )
        payment_deadline = (
            Payment.objects.filter(
                Q(deal_id=deal.pk) | Q(policy__deal_id=deal.pk),
                deleted_at__isnull=True,
                actual_date__isnull=True,
                scheduled_date__isnull=False,
            )
            .order_by("scheduled_date")
            .values_list("scheduled_date", flat=True)
            .first()
        )
        candidates = [
            value
            for value in (manual_deadline, policy_deadline, payment_deadline)
            if value is not None
        ]
        Deal.objects.filter(pk=deal.pk).update(
            expected_close=min(candidates) if candidates else None
        )


class Migration(migrations.Migration):
    dependencies = [
        ("deals", "0033_alter_dealevent_event_type"),
        ("policies", "0020_remove_policy_renewed_by_policy_is_renewed"),
        ("finances", "0011_statement_unique_normalized_name"),
    ]

    operations = [
        migrations.AddField(
            model_name="deal",
            name="manual_expected_close",
            field=models.DateField(
                blank=True,
                help_text="Ручной крайний срок сделки",
                null=True,
            ),
        ),
        migrations.AlterField(
            model_name="dealevent",
            name="event_type",
            field=models.CharField(
                choices=[
                    ("manual", "Ручное событие"),
                    ("manual_expected_close", "Ручной крайний срок"),
                    ("manual_next_contact", "Следующий контакт вручную"),
                    ("payment_due", "Очередной платеж"),
                    ("policy_expiration", "Окончание полиса"),
                    ("deal_updated", "Сделка изменена"),
                    ("task_created", "Задача создана"),
                    ("task_completed", "Задача завершена"),
                    ("policy_created", "Полис создан"),
                    ("quote_created", "Расчет создан"),
                    ("file_uploaded", "Файл загружен"),
                ],
                max_length=64,
            ),
        ),
        migrations.RunPython(migrate_deadlines, migrations.RunPython.noop),
    ]
