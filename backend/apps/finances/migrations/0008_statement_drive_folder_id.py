from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("finances", "0007_statement_and_record_link"),
    ]

    operations = [
        migrations.AddField(
            model_name="statement",
            name="drive_folder_id",
            field=models.CharField(
                blank=True,
                null=True,
                max_length=255,
                help_text="Google Drive folder ID",
            ),
        ),
    ]
