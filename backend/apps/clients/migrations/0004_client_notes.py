from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("clients", "0003_delete_contact"),
    ]

    operations = [
        migrations.AddField(
            model_name="client",
            name="notes",
            field=models.TextField(blank=True, help_text="Примечание о клиенте"),
        ),
    ]
