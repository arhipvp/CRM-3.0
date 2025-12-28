import uuid

from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):
    dependencies = [
        ("documents", "0005_knowledgedocument_local_storage"),
        ("deals", "0022_alter_quote_insurance_company"),
    ]

    operations = [
        migrations.AddField(
            model_name="knowledgedocument",
            name="open_notebook_source_id",
            field=models.CharField(
                blank=True, help_text="ID источника в Open Notebook", max_length=128
            ),
        ),
        migrations.AddField(
            model_name="knowledgedocument",
            name="open_notebook_status",
            field=models.CharField(
                blank=True,
                help_text="Статус синхронизации с Open Notebook",
                max_length=32,
            ),
        ),
        migrations.AddField(
            model_name="knowledgedocument",
            name="open_notebook_error",
            field=models.TextField(
                blank=True, help_text="Текст последней ошибки синхронизации"
            ),
        ),
        migrations.CreateModel(
            name="KnowledgeNotebook",
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
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                ("deleted_at", models.DateTimeField(blank=True, null=True)),
                (
                    "notebook_id",
                    models.CharField(
                        help_text="ID блокнота в Open Notebook",
                        max_length=128,
                        unique=True,
                    ),
                ),
                (
                    "notebook_name",
                    models.CharField(
                        help_text="Имя блокнота в Open Notebook", max_length=255
                    ),
                ),
                (
                    "insurance_type",
                    models.OneToOneField(
                        help_text="Вид страхования",
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="knowledge_notebook",
                        to="deals.insurancetype",
                    ),
                ),
            ],
            options={
                "ordering": ["-created_at"],
                "verbose_name": "Блокнот Open Notebook",
                "verbose_name_plural": "Блокноты Open Notebook",
            },
        ),
    ]
