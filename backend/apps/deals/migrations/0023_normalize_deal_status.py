from django.db import migrations


def normalize_deal_status(apps, schema_editor):
    Deal = apps.get_model("deals", "Deal")
    allowed = {"open", "on_hold", "won", "lost"}
    legacy_map = {
        "onhold": "on_hold",
        "on-hold": "on_hold",
        "on hold": "on_hold",
    }

    updates = []
    for deal in Deal.objects.all().only("id", "status"):
        raw = deal.status
        if raw is None:
            normalized = "open"
        else:
            normalized = str(raw).strip().lower()
            normalized = legacy_map.get(normalized, normalized)
            if normalized == "":
                normalized = "open"
        if normalized not in allowed:
            normalized = "open"
        if deal.status != normalized:
            deal.status = normalized
            updates.append(deal)

    if updates:
        Deal.objects.bulk_update(updates, ["status"])


class Migration(migrations.Migration):
    dependencies = [
        ("deals", "0022_alter_quote_insurance_company"),
    ]

    operations = [
        migrations.RunPython(normalize_deal_status, migrations.RunPython.noop),
    ]
