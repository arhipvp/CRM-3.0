from django.db import migrations, models
import django.db.models.deletion

import apps.documents.models


class Migration(migrations.Migration):
    dependencies = [
        ("deals", "0022_alter_quote_insurance_company"),
        ("documents", "0004_knowledgedocument"),
    ]

    operations = [
        migrations.AddField(
            model_name="knowledgedocument",
            name="file",
            field=models.FileField(
                blank=True,
                help_text="Файл документа",
                null=True,
                upload_to=apps.documents.models.knowledge_document_upload_path,
            ),
        ),
        migrations.AlterField(
            model_name="knowledgedocument",
            name="drive_file_id",
            field=models.CharField(
                blank=True,
                help_text="ID файла в Google Drive (legacy)",
                max_length=128,
                null=True,
            ),
        ),
        migrations.AddField(
            model_name="knowledgedocument",
            name="insurance_type",
            field=models.ForeignKey(
                blank=True,
                help_text="Вид страхования",
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name="knowledge_documents",
                to="deals.insurancetype",
            ),
        ),
    ]
