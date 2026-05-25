import re

from django.db import migrations, models


def normalize_statement_names(apps, schema_editor):
    Statement = apps.get_model("finances", "Statement")
    for statement in Statement.objects.all().only("id", "name"):
        normalized_name = re.sub(r"\s+", " ", (statement.name or "").strip())
        statement.name = normalized_name
        statement.name_normalized = normalized_name.casefold()
        statement.save(update_fields=["name", "name_normalized"])


class Migration(migrations.Migration):
    dependencies = [
        (
            "finances",
            "0010_rename_finances_st_statement_8a37a1_idx_finances_st_stateme_b85b04_idx_and_more",
        ),
    ]

    operations = [
        migrations.AddField(
            model_name="statement",
            name="name_normalized",
            field=models.CharField(
                db_index=True,
                default="",
                editable=False,
                help_text="Нормализованное название для проверки уникальности",
                max_length=255,
            ),
            preserve_default=False,
        ),
        migrations.RunPython(
            normalize_statement_names,
            migrations.RunPython.noop,
        ),
        migrations.AddConstraint(
            model_name="statement",
            constraint=models.UniqueConstraint(
                condition=models.Q(deleted_at__isnull=True),
                fields=("name_normalized",),
                name="uniq_active_statement_normalized_name",
            ),
        ),
    ]
