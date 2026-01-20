from django.db import migrations, models
from django.db.models.functions import Length, Trim


class Migration(migrations.Migration):
    dependencies = [
        ("policies", "0013_normalize_policy_status"),
    ]

    operations = [
        migrations.AddConstraint(
            model_name="policy",
            constraint=models.CheckConstraint(
                check=Length(Trim("number")).gt(0),
                name="policies_number_not_empty",
            ),
        ),
    ]
