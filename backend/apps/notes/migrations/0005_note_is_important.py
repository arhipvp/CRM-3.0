from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("notes", "0004_note_attachments"),
    ]

    operations = [
        migrations.AddField(
            model_name="note",
            name="is_important",
            field=models.BooleanField(default=False, help_text="Важная заметка"),
        ),
    ]
