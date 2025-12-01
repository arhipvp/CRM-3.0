from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("deals", "0019_merge_20251128_0437"),
    ]

    operations = [
        migrations.AddField(
            model_name="deal",
            name="closing_reason",
            field=models.TextField(blank=True, default="", help_text="Closing reason"),
        ),
    ]
