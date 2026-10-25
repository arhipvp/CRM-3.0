import json
import uuid
from concurrent.futures import ThreadPoolExecutor
from datetime import timedelta
from types import SimpleNamespace
from unittest.mock import patch

from apps.mcp_connector import server
from apps.mcp_connector.contracts import Principal
from django.conf import settings
from django.contrib.auth import get_user_model
from django.test import SimpleTestCase, TransactionTestCase, override_settings
from django.utils import timezone
from mcp import types
from mcp.types.version import LATEST_MODERN_VERSION
from mcp_types import CLIENT_CAPABILITIES_META_KEY, PROTOCOL_VERSION_META_KEY
from oauth2_provider.models import get_access_token_model, get_application_model
from rest_framework.exceptions import AuthenticationFailed, PermissionDenied
from starlette.testclient import TestClient

from ..contracts import SCOPES
from ..models import McpAccessGrant


class McpTransportTests(SimpleTestCase):
    def setUp(self):
        self.principals = {
            "Bearer alice": Principal(
                SimpleNamespace(pk=1, username="alice"),
                "client-a",
                frozenset({"crm.read"}),
            ),
            "Bearer bob": Principal(
                SimpleNamespace(pk=2, username="bob"),
                "client-b",
                frozenset({"crm.read"}),
            ),
        }

        def authenticate(header):
            if header not in self.principals:
                raise AuthenticationFailed("OAuth authorization is required.")
            return self.principals[header]

        self.auth = patch.object(
            server, "authenticate_bearer", side_effect=authenticate
        ).start()
        self.addCleanup(patch.stopall)
        self.list_tools = patch.object(
            server, "_list_tools", side_effect=self.available_tools
        ).start()
        self.execute = patch.object(
            server, "_execute", side_effect=self.execute_tool
        ).start()
        self.client = TestClient(
            server.create_application(), base_url=settings.MCP_OAUTH_ISSUER
        )
        self.client.__enter__()
        self.addCleanup(self.client.__exit__, None, None, None)

    @staticmethod
    def available_tools():
        principal = server._principal.get()
        return [
            types.Tool(
                name="read_record",
                description=f"Read the record for {principal.user.username}.",
                inputSchema={
                    "type": "object",
                    "properties": {},
                    "additionalProperties": False,
                },
                annotations=types.ToolAnnotations(
                    readOnlyHint=True, destructiveHint=False, openWorldHint=False
                ),
            )
        ]

    @staticmethod
    def execute_tool(name, arguments):
        principal = server._principal.get()
        return {"user": principal.user.username, "text": "Проверенные данные CRM"}

    def legacy(self, method, params=None, *, authorization="Bearer alice"):
        headers = {
            "Accept": "application/json, text/event-stream",
            "MCP-Protocol-Version": "2025-03-26",
        }
        if authorization is not None:
            headers["Authorization"] = authorization
        return self.client.post(
            "/mcp",
            headers=headers,
            json={"jsonrpc": "2.0", "id": 1, "method": method, "params": params or {}},
        )

    def modern(self, method, params=None, *, authorization="Bearer alice"):
        params = dict(params or {})
        params["_meta"] = {
            PROTOCOL_VERSION_META_KEY: LATEST_MODERN_VERSION,
            CLIENT_CAPABILITIES_META_KEY: {},
        }
        headers = {
            "Accept": "application/json",
            "MCP-Protocol-Version": LATEST_MODERN_VERSION,
            "Mcp-Method": method,
        }
        if authorization is not None:
            headers["Authorization"] = authorization
        if "name" in params:
            headers["Mcp-Name"] = params["name"]
        return self.client.post(
            "/mcp",
            headers=headers,
            json={"jsonrpc": "2.0", "id": 1, "method": method, "params": params},
        )

    def test_health_is_public_and_contains_no_private_data(self):
        response = self.client.get("/health/")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json(), {"status": "ok", "service": "crm-mcp"})
        self.auth.assert_not_called()

    def test_initialization_and_tool_calls_require_oauth_challenge(self):
        for method, params in (
            (
                "initialize",
                {
                    "protocolVersion": "2025-03-26",
                    "capabilities": {},
                    "clientInfo": {"name": "test", "version": "1"},
                },
            ),
            ("tools/list", {}),
            ("tools/call", {"name": "read_record", "arguments": {}}),
        ):
            with self.subTest(method=method):
                response = self.legacy(method, params, authorization=None)
                self.assertEqual(response.status_code, 401)
                self.assertIn(
                    "resource_metadata=", response.headers["WWW-Authenticate"]
                )
                self.assertEqual(response.headers["Cache-Control"], "no-store")
        self.execute.assert_not_called()
        self.list_tools.assert_not_called()

    def test_legacy_initialize_list_and_call_are_stateless(self):
        response = self.legacy(
            "initialize",
            {
                "protocolVersion": "2025-03-26",
                "capabilities": {},
                "clientInfo": {"name": "crm-test", "version": "1"},
            },
        )
        self.assertEqual(response.status_code, 200, response.text)
        self.assertEqual(response.json()["result"]["serverInfo"]["name"], "CRM 3.0")
        self.assertNotIn("mcp-session-id", response.headers)
        response = self.legacy("tools/list")
        self.assertEqual(response.status_code, 200, response.text)
        self.assertEqual(response.json()["result"]["tools"][0]["name"], "read_record")
        response = self.legacy("tools/call", {"name": "read_record", "arguments": {}})
        self.assertEqual(response.status_code, 200, response.text)
        result = response.json()["result"]
        self.assertEqual(result["structuredContent"]["user"], "alice")
        self.assertEqual(
            json.loads(result["content"][0]["text"])["text"], "Проверенные данные CRM"
        )

    def test_modern_list_and_call_work_without_initialize(self):
        response = self.modern("tools/list")
        self.assertEqual(response.status_code, 200, response.text)
        self.assertEqual(response.json()["result"]["tools"][0]["name"], "read_record")
        self.assertNotIn("mcp-session-id", response.headers)
        response = self.modern("tools/call", {"name": "read_record", "arguments": {}})
        self.assertEqual(response.status_code, 200, response.text)
        self.assertEqual(
            response.json()["result"]["structuredContent"]["user"], "alice"
        )

    def test_context_is_scoped_to_authenticated_request(self):
        for user in ("alice", "bob", "alice"):
            response = self.modern(
                "tools/call",
                {"name": "read_record", "arguments": {}},
                authorization=f"Bearer {user}",
            )
            self.assertEqual(response.status_code, 200, response.text)
            self.assertEqual(
                response.json()["result"]["structuredContent"]["user"], user
            )
        self.assertIsNone(server._principal.get())

    def test_concurrent_callers_do_not_share_principal(self):
        def call(user):
            return self.modern(
                "tools/call",
                {"name": "read_record", "arguments": {}},
                authorization=f"Bearer {user}",
            ).json()["result"]["structuredContent"]["user"]

        with ThreadPoolExecutor(max_workers=2) as executor:
            result = list(executor.map(call, ["alice", "bob"] * 3))
        self.assertEqual(result, ["alice", "bob"] * 3)
        self.assertIsNone(server._principal.get())

    def test_tool_permission_failure_returns_auth_metadata(self):
        self.execute.side_effect = PermissionDenied(
            "The current role cannot read this record."
        )
        response = self.modern("tools/call", {"name": "read_record", "arguments": {}})
        self.assertEqual(response.status_code, 200, response.text)
        result = response.json()["result"]
        self.assertTrue(result["isError"])
        self.assertIn("resource_metadata=", result["_meta"]["mcp/www_authenticate"][0])

    def test_structured_domain_error_is_not_reported_as_success(self):
        self.execute.side_effect = None
        self.execute.return_value = {
            "ok": False,
            "error": {"code": "invalid", "status": 400, "message": "Invalid data."},
        }
        response = self.modern("tools/call", {"name": "read_record", "arguments": {}})
        self.assertEqual(response.status_code, 200, response.text)
        self.assertTrue(response.json()["result"]["isError"])

    def test_structured_authorization_error_has_linking_challenge(self):
        self.execute.side_effect = None
        self.execute.return_value = {
            "ok": False,
            "error": {"code": "permission_denied", "status": 403, "message": "Denied."},
        }
        response = self.modern("tools/call", {"name": "read_record", "arguments": {}})
        self.assertEqual(response.status_code, 200, response.text)
        result = response.json()["result"]
        self.assertTrue(result["isError"])
        self.assertIn("resource_metadata=", result["_meta"]["mcp/www_authenticate"][0])

    def test_authentication_is_checked_again_for_every_request(self):
        self.assertEqual(self.modern("tools/list").status_code, 200)
        self.auth.side_effect = PermissionDenied("MCP connection was revoked.")
        response = self.modern("tools/list")
        self.assertEqual(response.status_code, 403)
        self.assertIn("resource_metadata=", response.headers["WWW-Authenticate"])
        self.assertEqual(self.list_tools.call_count, 1)

    def test_unexpected_error_does_not_return_exception_or_secret(self):
        self.execute.side_effect = RuntimeError("upstream-client-secret-must-not-leak")
        with self.assertLogs(server.logger, level="ERROR"):
            response = self.modern(
                "tools/call", {"name": "read_record", "arguments": {}}
            )
        self.assertEqual(response.status_code, 200, response.text)
        self.assertTrue(response.json()["result"]["isError"])
        self.assertNotIn("upstream-client-secret", response.text)

    def test_dns_rebinding_host_is_rejected_after_authentication(self):
        response = self.client.post(
            "/mcp",
            headers={"Host": "untrusted.example", "Authorization": "Bearer alice"},
            json={"jsonrpc": "2.0", "id": 1, "method": "tools/list", "params": {}},
        )
        self.assertEqual(response.status_code, 421)
        self.execute.assert_not_called()


@override_settings(GOOGLE_DRIVE_ROOT_FOLDER_ID="")
class AuthenticatedMcpIntegrationTests(TransactionTestCase):
    def test_actual_token_registry_write_replay_and_revocation(self):
        from apps.clients.models import Client
        from apps.deals.models import Deal
        from apps.tasks.models import Task

        user = get_user_model().objects.create_user("mcp-integration")
        access = McpAccessGrant.objects.create(user=user)
        application_model = get_application_model()
        application = application_model.objects.create(
            name="Integration test",
            client_type=application_model.CLIENT_CONFIDENTIAL,
            authorization_grant_type=application_model.GRANT_AUTHORIZATION_CODE,
            redirect_uris="https://chatgpt.com/connector_platform_oauth_redirect",
        )
        token = uuid.uuid4().hex
        get_access_token_model().objects.create(
            user=user,
            application=application,
            token=token,
            scope=" ".join(SCOPES),
            resource=[settings.MCP_PUBLIC_URL],
            expires=timezone.now() + timedelta(minutes=10),
        )
        with patch("apps.clients.signals.ensure_client_folder"), patch(
            "apps.deals.signals.ensure_deal_folder"
        ):
            client = Client.objects.create(name="Integration client", created_by=user)
            deal = Deal.objects.create(
                title="Integration deal", client=client, seller=user
            )
        headers = {
            "Authorization": f"Bearer {token}",
            "Accept": "application/json, text/event-stream",
            "MCP-Protocol-Version": "2025-03-26",
        }
        with TestClient(
            server.create_application(), base_url=settings.MCP_OAUTH_ISSUER
        ) as transport:

            def call(method, params):
                return transport.post(
                    "/mcp",
                    headers=headers,
                    json={
                        "jsonrpc": "2.0",
                        "id": 1,
                        "method": method,
                        "params": params,
                    },
                )

            discovery = call("tools/list", {})
            self.assertEqual(discovery.status_code, 200, discovery.text)
            names = {tool["name"] for tool in discovery.json()["result"]["tools"]}
            self.assertIn("crm_create_tasks", names)
            profile = call("tools/call", {"name": "crm_get_profile", "arguments": {}})
            self.assertFalse(profile.json()["result"].get("isError"), profile.text)
            arguments = {
                "request_id": str(uuid.uuid4()),
                "data": {
                    "title": "Integration task",
                    "deal": str(deal.pk),
                    "assignee": user.pk,
                },
            }
            created = call(
                "tools/call", {"name": "crm_create_tasks", "arguments": arguments}
            )
            result = created.json()["result"]
            self.assertFalse(result.get("isError"), created.text)
            self.assertEqual(result["structuredContent"]["status"], 201)
            replay = call(
                "tools/call", {"name": "crm_create_tasks", "arguments": arguments}
            )
            self.assertTrue(replay.json()["result"]["structuredContent"]["replayed"])
            self.assertEqual(
                Task.objects.filter(deal=deal, title="Integration task").count(), 1
            )
            access.enabled = False
            access.save(update_fields=["enabled"])
            self.assertEqual(call("tools/list", {}).status_code, 403)
