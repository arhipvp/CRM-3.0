"""Regressions for the business contract actually advertised to MCP clients."""

import copy
from types import SimpleNamespace
from unittest.mock import patch

import jsonschema
from django.conf import settings
from django.test import SimpleTestCase
from starlette.testclient import TestClient

from .. import server, tools
from ..contracts import SCOPES, Principal
from ..tools import get_registry, list_tools


def named_fields(schema, path=()):
    """Visit named properties, including nullable fields and array members."""
    for name, field in schema.get("properties", {}).items():
        yield (*path, name), field
        yield from named_fields(field, (*path, name))
    for keyword in ("anyOf", "oneOf", "allOf"):
        for alternative in schema.get(keyword, []):
            yield from named_fields(alternative, path)
    if isinstance(schema.get("items"), dict):
        yield from named_fields(schema["items"], (*path, "[]"))


def description(schema):
    parts = [schema.get("description", "")]
    for keyword in ("anyOf", "oneOf", "allOf"):
        parts.extend(description(item) for item in schema.get(keyword, []))
    return " ".join(parts).lower()


def validation_contract(value):
    """Ignore schema documentation while retaining all validation constraints."""
    if isinstance(value, list):
        return [validation_contract(item) for item in value]
    if not isinstance(value, dict):
        return value
    return {
        key: validation_contract(item)
        for key, item in value.items()
        if key not in {"description", "title", "examples", "default", "format"}
    }


class McpDescriptionTests(SimpleTestCase):
    @classmethod
    def setUpClass(cls):
        super().setUpClass()
        cls.tools = {tool.name: tool.model_dump(by_alias=True) for tool in list_tools()}

    def schema(self, name):
        return self.tools[name]["inputSchema"]

    def data_fields(self, name):
        return self.schema(name)["properties"]["data"]["properties"]

    def assert_terms(self, text, *groups):
        for alternatives in groups:
            if isinstance(alternatives, str):
                alternatives = (alternatives,)
            self.assertTrue(
                any(term.lower() in text.lower() for term in alternatives),
                f"Missing one of {alternatives!r} in {text!r}",
            )

    def test_all_advertised_properties_have_descriptions_and_valid_schemas(self):
        self.assertGreater(len(self.tools), 200)
        for name, tool in self.tools.items():
            with self.subTest(tool=name):
                self.assertTrue(tool["description"].strip())
                jsonschema.Draft202012Validator.check_schema(tool["inputSchema"])
                for path, field in named_fields(tool["inputSchema"]):
                    with self.subTest(field=".".join(path)):
                        self.assertTrue(description(field).strip())

    def test_premium_payment_and_agent_settlement_are_distinguished(self):
        fields = self.data_fields("crm_create_payments")
        self.assert_terms(description(fields["amount"]), "premium", "rub")
        self.assert_terms(description(fields["actual_date"]), "premium", "paid")
        self.assert_terms(
            description(fields["paid_balance"]),
            ("commission", "financial"),
            ("not", "never"),
            "premium",
        )
        self.assert_terms(
            self.tools["crm_get_payments"]["description"],
            "actual_date",
            "paid_balance",
            "premium",
        )

    def test_financial_operation_amount_and_date_have_their_own_meanings(self):
        fields = self.data_fields("crm_create_financial_records")
        self.assert_terms(
            description(fields["amount"]),
            ("commission", "income"),
            ("negative", "sign"),
            "expense",
        )
        self.assert_terms(
            description(fields["date"]),
            ("commission", "settlement", "expense"),
            ("null", "unpaid"),
        )
        self.assertNotEqual(
            description(fields["date"]),
            description(self.data_fields("crm_create_payments")["actual_date"]),
        )
        self.assert_terms(
            self.tools["crm_update_financial_records"]["description"],
            ("type", "income", "expense"),
            ("preserv", "retain", "unchanged", "does not change"),
        )

    def test_policy_import_describes_each_nested_financial_level(self):
        fields = self.data_fields("crm_create_policy_draft")
        payment = fields["payments"]["items"]["properties"]
        self.assert_terms(description(payment["amount"]), "premium")
        self.assert_terms(description(payment["actual_date"]), "premium", "paid")
        for side in ("incomes", "expenses"):
            with self.subTest(side=side):
                record = payment[side]["items"]["properties"]
                self.assert_terms(
                    description(record["amount"]),
                    ("commission", "income", "expense", "cost"),
                )
                self.assert_terms(
                    description(record["date"]),
                    ("settlement", "commission", "expense"),
                    ("null", "unpaid"),
                )
                self.assertNotEqual(
                    description(payment["amount"]), description(record["amount"])
                )
        self.assert_terms(
            self.tools["crm_create_policy_draft"]["description"],
            ("1 rub", "1.00", "one rub"),
            "files_pending",
            "request_id",
        )

    def test_draft_update_explains_graph_replacement(self):
        self.assert_terms(
            self.tools["crm_update_policy_draft"]["description"],
            ("replac", "full graph"),
            ("omitt", "missing", "absent"),
            ("delet", "remov"),
        )

    def test_statement_percent_base_is_financial_balance_not_premium(self):
        fields = self.data_fields("crm_statement_apply_amount")
        text = description(fields["value"])
        self.assert_terms(text, "percent", "paid_balance", "premium", "not")
        self.assert_terms(
            self.tools["crm_statement_mark_paid"]["description"],
            "paid_at",
            ("record", "operation"),
            "date",
        )

    def test_financial_filters_distinguish_premium_and_record_settlement(self):
        tool = "crm_list_financial_records"
        filters = self.schema(tool)["properties"]["filters"]
        fields = filters["properties"]
        self.assert_terms(description(fields["payment_paid"]), "premium", "actual_date")
        self.assert_terms(
            description(fields["paid_only"]), "financial", "date", "settled"
        )
        self.assert_terms(
            description(fields["unpaid_only"]), "financial", "null", "unsettled"
        )
        self.assertNotEqual(
            description(fields["payment_paid"]), description(fields["paid_only"])
        )
        # An unpaid commission may belong to a paid insurance premium. Both
        # filters must survive validation before the handler receives them.
        examples = (
            {"payment_paid": True, "unpaid_only": True},
            {"payment_paid": False, "paid_only": True},
        )
        execution_filters = get_registry()[tool].input_schema["properties"]["filters"]
        for example in examples:
            with self.subTest(filters=example):
                jsonschema.validate(example, filters)
                jsonschema.validate(example, execution_filters)

    def test_same_primitive_schema_has_independent_identifier_descriptions(self):
        passport = self.schema("crm_get_request_passport")["properties"]
        self.assert_terms(description(passport["id"]), "deal")
        self.assert_terms(
            description(passport["request_id"]),
            ("insurance-request", "insurance request"),
        )
        self.assertNotEqual(
            description(passport["id"]), description(passport["request_id"])
        )
        event = self.schema("crm_update_deal_event")["properties"]
        self.assert_terms(description(event["id"]), "crm", ("deal", "record"))
        self.assert_terms(description(event["event_id"]), "event", "timeline")
        self.assertNotEqual(description(event["id"]), description(event["event_id"]))

    def test_policy_name_filters_are_distinct_from_write_relation_ids(self):
        filters = self.schema("crm_list_policies")["properties"]["filters"][
            "properties"
        ]
        for key in ("sales_channel", "insurance_company", "insurance_type"):
            with self.subTest(filter=key):
                self.assert_terms(
                    description(filters[key]),
                    ("name", "text"),
                    ("contains", "substring", "icontains"),
                )
        write = self.data_fields("crm_create_policy_draft")["sales_channel"]
        self.assert_terms(description(write), "crm", "id", "crm_list_sales_channels")
        self.assertNotEqual(description(filters["sales_channel"]), description(write))

    def test_file_import_and_upload_identifiers_are_unambiguous(self):
        source = self.data_fields("crm_create_policy_draft")["source_file_ids"]
        self.assert_terms(description(source), "d_", "drive", "mov")
        for name in (
            "crm_create_policies",
            "crm_update_policies",
            "crm_update_policy_draft",
        ):
            with self.subTest(tool=name):
                self.assertNotIn("source_file_ids", self.data_fields(name))
        upload = self.schema("crm_upload_file")["properties"]["file"]["properties"]
        self.assert_terms(description(upload["file_id"]), "chatgpt")
        file_id = self.schema("crm_download_file")["properties"]["file_id"]
        self.assert_terms(description(file_id), "crm_list_files")

    def test_upload_accepts_standard_chatgpt_attachment_and_explains_import(self):
        tool = self.tools["crm_upload_file"]
        self.assertEqual(tool["_meta"]["openai/fileParams"], ["file"])
        fields = tool["inputSchema"]["properties"]
        file = fields["file"]
        self.assertEqual(set(file["required"]), {"download_url", "file_id"})
        self.assertTrue(
            {"download_url", "file_id", "mime_type", "file_name"}
            <= file["properties"].keys()
        )
        jsonschema.validate(
            {
                "owner_type": "deal",
                "owner_id": "00000000-0000-4000-8000-000000000001",
                "file": {
                    "download_url": "https://files.oaiusercontent.com/test-attachment",
                    "file_id": "file-test-attachment",
                },
                "request_id": "00000000-0000-4000-8000-000000000002",
            },
            tool["inputSchema"],
        )
        self.assert_terms(
            tool["description"],
            "original",
            "crm_create_policy_draft",
            "source_file_ids",
            "25 mib",
            "request_id",
        )

    def test_dates_and_nested_ids_have_machine_readable_formats(self):
        fields = dict(named_fields(self.schema("crm_create_policy_draft")))
        date = fields[("data", "payments", "[]", "actual_date")]
        self.assertIn(
            "date",
            [date.get("format"), *[v.get("format") for v in date.get("anyOf", [])]],
        )
        payment_id = fields[("data", "payments", "[]", "id")]
        self.assertEqual(payment_id.get("format"), "uuid")

    def test_preview_apply_document_exact_arguments_and_retry_identity(self):
        for name in ("crm_preview_change", "crm_apply_change"):
            fields = self.schema(name)["properties"]
            with self.subTest(tool=name):
                self.assert_terms(description(fields["tool_name"]), "tool")
                self.assert_terms(
                    description(fields["arguments"]),
                    ("tool", "target"),
                    ("schema", "input", "parameter"),
                )
        fields = self.schema("crm_apply_change")["properties"]
        self.assert_terms(description(fields["preview_token"]), "preview")
        self.assert_terms(description(fields["request_id"]), "uuid", "same")
        request = self.schema("crm_create_tasks")["properties"]["request_id"]
        self.assert_terms(description(request), "uuid", ("retry", "repeat"))

    def test_advertised_metadata_preserves_contract_and_cached_registry(self):
        get_registry.cache_clear()
        registry = get_registry()
        before = {
            name: copy.deepcopy(spec.input_schema) for name, spec in registry.items()
        }
        first = [tool.model_dump(by_alias=True) for tool in list_tools()]
        second = [tool.model_dump(by_alias=True) for tool in list_tools()]
        self.assertEqual(first, second)
        self.assertEqual(
            before, {name: spec.input_schema for name, spec in registry.items()}
        )
        for tool in first:
            if tool["name"] not in registry:
                continue
            spec = registry[tool["name"]]
            advertised = copy.deepcopy(tool["inputSchema"])
            if spec.mutating:
                advertised["properties"].pop("request_id")
                advertised["required"].remove("request_id")
            with self.subTest(tool=spec.name):
                self.assertEqual(
                    validation_contract(advertised),
                    validation_contract(spec.input_schema),
                )

    def test_first_tools_list_does_not_annotate_shared_schema_constants(self):
        get_registry.cache_clear()
        self.addCleanup(get_registry.cache_clear)
        # setUpClass already advertises the production registry. A fresh shared
        # primitive also catches accidental mutation during the very first list.
        with patch.object(tools, "TEXT", {"type": "string"}):
            list_tools()
            self.assertEqual(tools.TEXT, {"type": "string"})

    def test_real_tools_list_transports_the_financial_field_descriptions(self):
        principal = Principal(
            SimpleNamespace(pk=1, username="contract-test"),
            "contract-client",
            frozenset(SCOPES),
        )
        with patch.object(server, "authenticate_bearer", return_value=principal):
            with TestClient(
                server.create_application(), base_url=settings.MCP_OAUTH_ISSUER
            ) as client:
                response = client.post(
                    "/mcp",
                    headers={
                        "Authorization": "Bearer contract-test",
                        "Accept": "application/json, text/event-stream",
                        "MCP-Protocol-Version": "2025-03-26",
                    },
                    json={
                        "jsonrpc": "2.0",
                        "id": 1,
                        "method": "tools/list",
                        "params": {},
                    },
                )
        self.assertEqual(response.status_code, 200, response.text)
        transmitted = {
            tool["name"]: tool for tool in response.json()["result"]["tools"]
        }
        for name in (
            "crm_create_payments",
            "crm_create_financial_records",
            "crm_create_policy_draft",
        ):
            with self.subTest(tool=name):
                self.assertEqual(transmitted[name]["inputSchema"], self.schema(name))
                self.assertEqual(
                    transmitted[name]["description"], self.tools[name]["description"]
                )
