import uuid
from unittest.mock import patch

import jsonschema
from apps.ai_assistant.models import AiConversation, AiRun
from apps.clients.models import Client
from apps.deals.models import Deal
from apps.notes.models import Note
from apps.tasks.models import Task
from apps.users.models import AuditLog
from django.contrib.auth import get_user_model
from django.test import TestCase

from ..contracts import SCOPES, Principal
from ..models import McpAccessGrant
from ..tools import execute_tool, get_registry, list_tools


class McpFixture(TestCase):
    def setUp(self):
        for target in (
            "apps.clients.signals.ensure_client_folder",
            "apps.deals.signals.ensure_deal_folder",
            "apps.policies.signals.ensure_policy_folder",
        ):
            mocker = patch(target, return_value=None)
            mocker.start()
            self.addCleanup(mocker.stop)
        self.user = get_user_model().objects.create_user(
            username="mcp-owner", password="test"
        )
        self.other = get_user_model().objects.create_user(
            username="mcp-other", password="test"
        )
        self.grant = McpAccessGrant.objects.create(user=self.user)
        self.principal = Principal(self.user, "chatgpt-test", frozenset(SCOPES))
        self.customer = Client.objects.create(
            name="Тестовый клиент", created_by=self.user, phone="79000000000"
        )
        self.deal = Deal.objects.create(
            title="Своя сделка",
            client=self.customer,
            seller=self.user,
            executor=self.user,
        )
        self.foreign = Deal.objects.create(
            title="Чужая сделка", client=self.customer, seller=self.other
        )

    def call(self, name, arguments=None, principal=None):
        return execute_tool(name, arguments or {}, principal or self.principal)

    def write(self, name, arguments=None, request_id=None):
        return self.call(
            name, {**(arguments or {}), "request_id": str(request_id or uuid.uuid4())}
        )


class ToolTests(McpFixture):
    def test_named_registry_and_valid_schemas(self):
        tools = list_tools(self.principal)
        names = [tool.name for tool in tools]
        self.assertEqual(len(names), len(set(names)))
        self.assertGreater(len(names), 100)
        for forbidden in (
            "sber_issuance",
            "password",
            "permissions",
            "roles",
            "reconnect",
        ):
            self.assertFalse(any(forbidden in name for name in names))
        for tool in tools:
            wire = tool.model_dump(by_alias=True)
            jsonschema.Draft202012Validator.check_schema(wire["inputSchema"])
            self.assertIn("securitySchemes", wire["_meta"])
        self.assertTrue(
            next(
                tool for tool in tools if tool.name == "crm_list_clients"
            ).annotations.read_only_hint
        )
        self.assertTrue(
            next(
                tool for tool in tools if tool.name == "crm_apply_change"
            ).annotations.destructive_hint
        )

    def test_read_preserves_user_visibility(self):
        result = self.call("crm_list_deals")
        self.assertNotIn("error", result, result)
        payload = result["data"]
        rows = payload["results"] if isinstance(payload, dict) else payload
        ids = [row["id"] for row in rows]
        self.assertIn(str(self.deal.pk), ids)
        self.assertNotIn(str(self.foreign.pk), ids)
        self.assertEqual(
            self.call("crm_get_deals", {"id": str(self.foreign.pk)})["error"]["status"],
            404,
        )

    def test_unknown_endpoints_and_author_spoofing_rejected(self):
        self.assertEqual(
            self.call("crm_http", {"url": "/admin/"})["error"]["code"], "unknown_tool"
        )
        result = self.write(
            "crm_create_notes",
            {
                "data": {
                    "deal": str(self.deal.pk),
                    "body": "Примечание",
                    "author_name": "Admin",
                }
            },
        )
        self.assertEqual(result["error"]["code"], "invalid_arguments")
        self.assertFalse(Note.objects.exists())

    def test_create_note_is_idempotent_and_uses_real_author(self):
        key = uuid.uuid4()
        body = {"data": {"deal": str(self.deal.pk), "body": "Проверено"}}
        first = self.write("crm_create_notes", body, key)
        self.assertNotIn("error", first, first)
        second = self.write("crm_create_notes", body, key)
        self.assertEqual(first["data"]["id"], second["data"]["id"])
        self.assertTrue(second["replayed"])
        self.assertEqual(Note.objects.count(), 1)
        self.assertEqual(Note.objects.get().author_id, self.user.pk)
        conflict = self.write(
            "crm_create_notes",
            {"data": {"deal": str(self.deal.pk), "body": "Другое"}},
            key,
        )
        self.assertEqual(conflict["error"]["code"], "idempotency_conflict")

    def test_forged_task_deal_relation_cannot_create_visibility(self):
        result = self.write(
            "crm_create_tasks",
            {
                "data": {
                    "title": "Подмена",
                    "deal": str(self.foreign.pk),
                    "assignee": self.user.pk,
                }
            },
        )
        self.assertEqual(result["error"]["status"], 403, result)
        self.assertFalse(Task.objects.exists())

    def test_task_assignee_can_complete_but_not_edit_title(self):
        task = Task.objects.create(
            title="Завершить",
            deal=self.foreign,
            assignee=self.user,
            created_by=self.other,
        )
        result = self.write(
            "crm_update_tasks",
            {
                "id": str(task.pk),
                "data": {"status": "done", "completion_comment": "Сделано"},
            },
        )
        self.assertNotIn("error", result, result)
        task.refresh_from_db()
        self.assertEqual(task.completed_by_id, self.user.pk)
        result = self.write(
            "crm_update_tasks", {"id": str(task.pk), "data": {"title": "Подмена"}}
        )
        self.assertEqual(result["error"]["status"], 403, result)

    def test_grant_revocation_and_scope_changes_apply_immediately(self):
        self.grant.enabled = False
        self.grant.save()
        self.assertEqual(self.call("crm_list_clients")["error"]["status"], 403)
        self.grant.enabled = True
        self.grant.scopes = ["crm.read"]
        self.grant.save()
        result = self.write("crm_create_clients", {"data": {"name": "Новый"}})
        self.assertEqual(result["error"]["status"], 403)

    def test_client_audit_has_real_actor_and_chatgpt_channel(self):
        result = self.write(
            "crm_create_clients", {"data": {"name": "Клиент из ChatGPT"}}
        )
        self.assertNotIn("error", result, result)
        logs = AuditLog.objects.filter(
            object_type="client", object_id=result["data"]["id"]
        )
        self.assertTrue(logs.exists())
        self.assertTrue(
            all(
                log.actor_id == self.user.pk and "[ChatGPT]" in log.description
                for log in logs
            )
        )

    def test_financial_writes_cannot_bypass_preview(self):
        result = self.write(
            "crm_create_statements",
            {"data": {"name": "Ведомость", "statement_type": "income"}},
        )
        self.assertEqual(result["error"]["code"], "preview_required")

    def test_ai_ask_creates_one_owned_run(self):
        conversation = AiConversation.objects.create(owner=self.user)
        key = uuid.uuid4()
        body = {
            "id": str(conversation.pk),
            "data": {"content": "Что покрывают правила?"},
        }
        first = self.write("crm_ai_ask", body, key)
        self.assertNotIn("error", first, first)
        second = self.write("crm_ai_ask", body, key)
        self.assertTrue(second["replayed"])
        self.assertEqual(AiRun.objects.count(), 1)
        result = self.call("crm_ai_get_run", {"id": first["data"]["run_id"]})
        self.assertEqual(result["run"]["status"], "queued")

    def test_ai_does_not_access_another_users_chat(self):
        conversation = AiConversation.objects.create(owner=self.other)
        self.assertEqual(
            self.call("crm_ai_messages", {"id": str(conversation.pk)})["error"][
                "status"
            ],
            404,
        )

    def test_schemas_exclude_files_and_admin_mutations(self):
        registry = get_registry()
        self.assertNotIn(
            "file",
            registry["crm_update_documents"].input_schema["properties"]["data"][
                "properties"
            ],
        )
        self.assertFalse(
            any(
                name in registry
                for name in (
                    "crm_create_users",
                    "crm_create_banks",
                    "crm_create_platforms",
                    "crm_delete_mailboxes",
                )
            )
        )
