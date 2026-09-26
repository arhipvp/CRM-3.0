"""Exercise the generated migration on an isolated historical SQLite schema.

Old repository migrations cannot bootstrap SQLite from zero; their historical
model state supplies the baseline, then the real new migration is executed.
"""

import tempfile
import unittest
from pathlib import Path

from django.conf import settings
from django.db import connections
from django.db.migrations.executor import MigrationExecutor
from django.db.migrations.loader import MigrationLoader
from django.db.migrations.recorder import MigrationRecorder
from django.test import override_settings


class RemoveClientCurrentMigrationTests(unittest.TestCase):
    def test_removing_flag_preserves_people_documents_roles_and_snapshot(self):
        alias = "client_current_migration_probe"
        migration = ("clients", "0017_remove_client_is_current")
        with tempfile.TemporaryDirectory(prefix="crm-client-migration-") as folder:
            config = dict(settings.DATABASES["default"])
            config.update(
                ENGINE="django.db.backends.sqlite3",
                NAME=str(Path(folder) / "migration.sqlite3"),
                OPTIONS={},
            )
            connections.databases[alias] = config
            connection = connections[alias]
            try:
                with override_settings(MIGRATION_MODULES={}):
                    loader = MigrationLoader(connection)
                    baseline = set(loader.disk_migrations) - {migration}
                    state = loader.project_state(list(baseline))
                    with connection.schema_editor() as editor:
                        for model in state.apps.get_models():
                            if model._meta.managed and not model._meta.proxy:
                                editor.create_model(model)
                    recorder = MigrationRecorder(connection)
                    recorder.ensure_schema()
                    for app, name in baseline:
                        recorder.record_applied(app, name)

                    def create(app, model_name, **values):
                        model = state.apps.get_model(app, model_name)
                        return model._base_manager.using(alias).create(**values)

                    first = create("clients", "Client", name="Первый", is_current=True)
                    second = create(
                        "clients", "Client", name="Второй", is_current=False
                    )
                    deal = create("deals", "Deal", title="Сделка", client=first)
                    for client, current in ((first, True), (second, False)):
                        create(
                            "insurance_requests",
                            "DealParticipant",
                            deal=deal,
                            client=client,
                            is_current=current,
                        )
                        create(
                            "insurance_requests",
                            "ClientPassport",
                            client=client,
                            number="123",
                            is_current=current,
                        )
                        create(
                            "insurance_requests",
                            "DriverLicense",
                            client=client,
                            number="456",
                            is_current=current,
                        )
                    vehicle = create(
                        "insurance_requests", "Vehicle", deal=deal, title="Машина"
                    )
                    kind = create("deals", "InsuranceType", name="КАСКО")
                    request = create(
                        "insurance_requests",
                        "InsuranceRequest",
                        deal=deal,
                        title="Заявка",
                        vehicle=vehicle,
                        insurance_type=kind,
                        policyholder=first,
                        owner=second,
                        version=1,
                    )
                    request.drivers.add(second)
                    snapshot = {
                        "people": [
                            {"id": str(first.pk), "is_current": True},
                            {"id": str(second.pk), "is_current": False},
                        ],
                        "version": 1,
                    }
                    create(
                        "insurance_requests",
                        "RequestVersion",
                        insurance_request=request,
                        number=1,
                        snapshot=snapshot,
                    )

                    executor = MigrationExecutor(connection)
                    final_state = executor.migrate(executor.loader.graph.leaf_nodes())
                    Client = final_state.apps.get_model("clients", "Client")
                    self.assertNotIn(
                        "is_current", [field.name for field in Client._meta.fields]
                    )
                    self.assertEqual(Client._base_manager.using(alias).count(), 2)
                    for name in ("DealParticipant", "ClientPassport", "DriverLicense"):
                        Model = final_state.apps.get_model("insurance_requests", name)
                        values = dict(
                            Model._base_manager.using(alias).values_list(
                                "client_id", "is_current"
                            )
                        )
                        self.assertEqual(values, {first.pk: True, second.pk: False})
                    Request = final_state.apps.get_model(
                        "insurance_requests", "InsuranceRequest"
                    )
                    saved = Request._base_manager.using(alias).get(pk=request.pk)
                    self.assertEqual(
                        (saved.policyholder_id, saved.owner_id), (first.pk, second.pk)
                    )
                    self.assertEqual(
                        list(saved.drivers.values_list("pk", flat=True)), [second.pk]
                    )
                    Version = final_state.apps.get_model(
                        "insurance_requests", "RequestVersion"
                    )
                    self.assertEqual(
                        Version.objects.using(alias)
                        .get(insurance_request_id=request.pk)
                        .snapshot,
                        snapshot,
                    )
                    self.assertIn(
                        migration, MigrationLoader(connection).applied_migrations
                    )
            finally:
                connection.close()
                del connections[alias]
                connections.databases.pop(alias, None)
