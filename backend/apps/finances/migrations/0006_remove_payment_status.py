from django.db import migrations


class Migration(migrations.Migration):

    dependencies = [
        ("finances", "0005_remove_financialtransaction_deal_and_more"),
    ]

    operations = [
        migrations.RemoveField(
            model_name="payment",
            name="status",
        ),
    ]
