from django.db import migrations


def sync_client_from_insured(apps, schema_editor):
    Policy = apps.get_model("policies", "Policy")
    table = Policy._meta.db_table
    sql = f"""
        UPDATE {table}
        SET client_id = insured_client_id
        WHERE insured_client_id IS NOT NULL
          AND (client_id IS NULL OR client_id <> insured_client_id)
    """
    with schema_editor.connection.cursor() as cursor:
        cursor.execute(sql)
        updated = cursor.rowcount
    print(f"[policies.0015] synced client_id from insured_client_id: {updated}")


class Migration(migrations.Migration):
    dependencies = [
        ("policies", "0014_policy_number_not_empty"),
    ]

    operations = [
        migrations.RunPython(sync_client_from_insured, migrations.RunPython.noop),
    ]
