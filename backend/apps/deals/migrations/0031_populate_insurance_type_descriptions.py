from django.db import migrations

INSURANCE_TYPE_DESCRIPTIONS = {
    "ОСАГО": "Обязательное страхование гражданской ответственности владельцев ТС.",
    "КАСКО": "Добровольное страхование автомобиля от ущерба, угона или полной гибели.",
    "Каско": "Добровольное страхование автомобиля от ущерба, угона или полной гибели.",
    "ДГО": (
        "Добровольная дополнительная гражданская ответственность автовладельца "
        "сверх ОСАГО; признаки: ДГО, ДСАГО, добровольная гражданская "
        "ответственность, лимит ответственности."
    ),
    "ДСАГО": (
        "Добровольная дополнительная гражданская ответственность автовладельца "
        "сверх ОСАГО; признаки: ДГО, ДСАГО, добровольная гражданская "
        "ответственность, лимит ответственности."
    ),
    "ДГО/ДСАГО": (
        "Добровольная дополнительная гражданская ответственность автовладельца "
        "сверх ОСАГО; признаки: ДГО, ДСАГО, добровольная гражданская "
        "ответственность, лимит ответственности."
    ),
    "GAP": "Покрытие финансового разрыва или потери стоимости автомобиля.",
    "Авто. Прочее страхование": (
        "Автомобильный полис, который не относится к ОСАГО, КАСКО, ДГО/ДСАГО или GAP."
    ),
}


def populate_descriptions(apps, schema_editor):
    InsuranceType = apps.get_model("deals", "InsuranceType")

    for name, description in INSURANCE_TYPE_DESCRIPTIONS.items():
        InsuranceType.objects.filter(name=name, description="").update(
            description=description
        )


def clear_seeded_descriptions(apps, schema_editor):
    InsuranceType = apps.get_model("deals", "InsuranceType")

    for name, description in INSURANCE_TYPE_DESCRIPTIONS.items():
        InsuranceType.objects.filter(name=name, description=description).update(
            description=""
        )


class Migration(migrations.Migration):
    dependencies = [
        ("deals", "0030_quote_deductible_decimal"),
    ]

    operations = [
        migrations.RunPython(populate_descriptions, clear_seeded_descriptions),
    ]
