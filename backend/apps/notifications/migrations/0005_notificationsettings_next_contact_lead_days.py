from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("notifications", "0004_notificationsettings_notify_policy_expiry"),
    ]

    operations = [
        migrations.AddField(
            model_name="notificationsettings",
            name="next_contact_lead_days",
            field=models.PositiveSmallIntegerField(
                default=90,
                help_text="Days before event for next contact",
            ),
        ),
    ]
