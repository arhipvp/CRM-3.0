from django.contrib.postgres.operations import TrigramExtension
from django.db import migrations


class Migration(migrations.Migration):
    dependencies = [
        ("clients", "0012_clientsimilarityexclusion"),
        ("deals", "0036_convert_manual_events_to_deadlines"),
        ("policies", "0020_remove_policy_renewed_by_policy_is_renewed"),
        ("finances", "0011_statement_unique_normalized_name"),
    ]

    operations = [TrigramExtension()]
