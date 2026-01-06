from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("notes", "0003_add_note_author"),
    ]

    operations = [
        migrations.AddField(
            model_name="note",
            name="attachments",
            field=models.JSONField(blank=True, default=list, help_text="Drive attachments metadata"),
        ),
    ]
