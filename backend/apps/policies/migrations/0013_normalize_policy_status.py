from django.db import migrations


def normalize_policy_status(apps, schema_editor):
    Policy = apps.get_model("policies", "Policy")
    allowed = {"active", "inactive", "expired", "canceled"}
    legacy_map = {
        "cancelled": "canceled",
    }

    updates = []
    for policy in Policy.objects.all().only("id", "status"):
        raw = policy.status
        if raw is None:
            normalized = "active"
        else:
            normalized = str(raw).strip().lower()
            normalized = legacy_map.get(normalized, normalized)
            if normalized == "":
                normalized = "active"
        if normalized not in allowed:
            normalized = "active"
        if policy.status != normalized:
            policy.status = normalized
            updates.append(policy)

    if updates:
        Policy.objects.bulk_update(updates, ["status"])


class Migration(migrations.Migration):
    dependencies = [
        ("policies", "0012_policy_insured_client_and_more"),
    ]

    operations = [
        migrations.RunPython(normalize_policy_status, migrations.RunPython.noop),
    ]
