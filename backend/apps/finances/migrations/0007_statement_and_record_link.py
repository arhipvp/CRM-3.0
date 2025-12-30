from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion
import uuid


class Migration(migrations.Migration):
    dependencies = [
        ("finances", "0006_remove_payment_status"),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.CreateModel(
            name="Statement",
            fields=[
                (
                    "id",
                    models.UUIDField(
                        default=uuid.uuid4, editable=False, primary_key=True, serialize=False
                    ),
                ),
                ("deleted_at", models.DateTimeField(blank=True, default=None, null=True)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                ("name", models.CharField(help_text="Название", max_length=255)),
                (
                    "statement_type",
                    models.CharField(
                        choices=[("income", "Доход"), ("expense", "Расход")],
                        help_text="Тип ведомости",
                        max_length=20,
                    ),
                ),
                (
                    "counterparty",
                    models.CharField(
                        blank=True, help_text="Контрагент", max_length=255
                    ),
                ),
                (
                    "status",
                    models.CharField(
                        choices=[("draft", "Черновик"), ("paid", "Выплачена")],
                        default="draft",
                        max_length=20,
                    ),
                ),
                ("paid_at", models.DateField(blank=True, help_text="Дата оплаты", null=True)),
                ("comment", models.TextField(blank=True, help_text="Комментарий")),
                (
                    "created_by",
                    models.ForeignKey(
                        blank=True,
                        help_text="Создал",
                        null=True,
                        on_delete=django.db.models.deletion.SET_NULL,
                        related_name="finance_statements",
                        to=settings.AUTH_USER_MODEL,
                    ),
                ),
            ],
            options={
                "verbose_name": "Ведомость",
                "verbose_name_plural": "Ведомости",
                "ordering": ["-created_at"],
            },
        ),
        migrations.AddIndex(
            model_name="statement",
            index=models.Index(fields=["statement_type"], name="finances_st_statement_8a37a1_idx"),
        ),
        migrations.AddIndex(
            model_name="statement",
            index=models.Index(fields=["status"], name="finances_st_status_ef2a8b_idx"),
        ),
        migrations.AddField(
            model_name="financialrecord",
            name="statement",
            field=models.ForeignKey(
                blank=True,
                help_text="Ведомость",
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name="records",
                to="finances.statement",
            ),
        ),
    ]
