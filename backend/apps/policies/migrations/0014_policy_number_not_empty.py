from django.db import migrations, models
from django.db.models import Q


class Migration(migrations.Migration):
    dependencies = [
        ("policies", "0013_normalize_policy_status"),
    ]

    operations = [
        migrations.AddConstraint(
            model_name="policy",
            constraint=models.CheckConstraint(
                check=~Q(number__regex=r"^\s*$"),
                name="policies_number_not_empty",
            ),
        ),
    ]
