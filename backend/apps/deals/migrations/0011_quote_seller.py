from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("deals", "0010_add_insurance_references"),
    ]

    operations = [
        migrations.AddField(
            model_name="quote",
            name="seller",
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=models.SET_NULL,
                related_name="quotes",
                to=settings.AUTH_USER_MODEL,
            ),
        ),
    ]
