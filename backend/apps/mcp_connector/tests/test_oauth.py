import base64
import hashlib
import io
from datetime import timedelta
from urllib.parse import parse_qs, urlsplit

from apps.mcp_connector.auth import (
    McpOAuthValidator,
    authenticate_bearer,
    require_access,
)
from apps.mcp_connector.models import McpAccessGrant
from django.conf import settings
from django.contrib.auth import get_user_model
from django.contrib.auth.hashers import check_password
from django.core.management import call_command
from django.core.management.base import CommandError
from django.test import Client, TestCase
from django.utils import timezone
from oauth2_provider.models import (
    get_access_token_model,
    get_application_model,
    get_grant_model,
    get_refresh_token_model,
)
from rest_framework.exceptions import AuthenticationFailed, PermissionDenied


class McpOAuthTests(TestCase):
    def setUp(self):
        self.user = get_user_model().objects.create_user(
            username="Vova", password="test-login-password"
        )
        self.access = McpAccessGrant.objects.create(user=self.user)
        self.secret = "oauth-client-test-secret"
        model = get_application_model()
        self.application = model.objects.create(
            name="ChatGPT test",
            client_type=model.CLIENT_CONFIDENTIAL,
            authorization_grant_type=model.GRANT_AUTHORIZATION_CODE,
            client_secret=self.secret,
            redirect_uris="https://chatgpt.com/connector_platform_oauth_redirect",
        )
        self.verifier = "v" * 64
        self.challenge = (
            base64.urlsafe_b64encode(hashlib.sha256(self.verifier.encode()).digest())
            .decode()
            .rstrip("=")
        )
        self.params = {
            "client_id": self.application.client_id,
            "redirect_uri": self.application.redirect_uris,
            "response_type": "code",
            "scope": "crm.read crm.write",
            "state": "test-oauth-state",
            "resource": settings.MCP_PUBLIC_URL,
            "code_challenge": self.challenge,
            "code_challenge_method": "S256",
        }

    def authorize(self, client=None, **overrides):
        client = client or self.client
        client.force_login(self.user)
        params = {**self.params, **overrides}
        response = client.get("/oauth/authorize/", params)
        self.assertEqual(response.status_code, 200, response.content[:500])
        form = {**params, "allow": "true"}
        if "csrftoken" in client.cookies:
            form["csrfmiddlewaretoken"] = client.cookies["csrftoken"].value
        response = client.post("/oauth/authorize/", form)
        self.assertEqual(response.status_code, 302, response.content[:500])
        query = parse_qs(urlsplit(response["Location"]).query)
        self.assertEqual(query.get("state"), [self.params["state"]])
        self.assertEqual(query.get("iss"), [settings.MCP_OAUTH_ISSUER])
        self.assertIn("code", query, query)
        return query["code"][0]

    def exchange(self, code, **overrides):
        data = {
            "grant_type": "authorization_code",
            "code": code,
            "client_id": self.application.client_id,
            "client_secret": self.secret,
            "redirect_uri": self.application.redirect_uris,
            "code_verifier": self.verifier,
            "resource": settings.MCP_PUBLIC_URL,
            **overrides,
        }
        return self.client.post("/oauth/token/", data)

    def tokens(self):
        response = self.exchange(self.authorize())
        self.assertEqual(response.status_code, 200, response.content[:500])
        return response.json()

    def test_default_consent_offers_the_users_enabled_capabilities(self):
        response = self.exchange(self.authorize(scope=""))
        self.assertEqual(response.status_code, 200, response.content[:500])
        self.assertEqual(set(response.json()["scope"].split()), set(self.access.scopes))

    def test_default_consent_respects_a_read_only_user_grant(self):
        self.access.scopes = ["crm.read"]
        self.access.save(update_fields=["scopes"])
        response = self.exchange(self.authorize(scope=""))
        self.assertEqual(response.status_code, 200, response.content[:500])
        self.assertEqual(response.json()["scope"], "crm.read")

    def refresh(self, token, **overrides):
        data = {
            "grant_type": "refresh_token",
            "refresh_token": token,
            "client_id": self.application.client_id,
            "client_secret": self.secret,
            "resource": settings.MCP_PUBLIC_URL,
            **overrides,
        }
        if data["resource"] is None:
            data.pop("resource")
        return self.client.post(
            "/oauth/token/",
            data,
        )

    def test_discovery_matches_canonical_endpoints_and_s256(self):
        data = self.client.get("/.well-known/oauth-authorization-server").json()
        self.assertEqual(data["issuer"], settings.MCP_OAUTH_ISSUER)
        self.assertEqual(data["code_challenge_methods_supported"], ["S256"])
        self.assertEqual(
            data["authorization_endpoint"],
            f"{settings.MCP_OAUTH_ISSUER}/oauth/authorize/",
        )
        self.assertEqual(
            data["token_endpoint"], f"{settings.MCP_OAUTH_ISSUER}/oauth/token/"
        )
        self.assertEqual(
            data["revocation_endpoint"], f"{settings.MCP_OAUTH_ISSUER}/oauth/revoke/"
        )
        self.assertNotIn("registration_endpoint", data)
        self.assertFalse(data["client_id_metadata_document_supported"])
        self.assertEqual(
            set(data["grant_types_supported"]), {"authorization_code", "refresh_token"}
        )
        for path in (
            "/.well-known/oauth-protected-resource",
            "/.well-known/oauth-protected-resource/mcp",
        ):
            resource = self.client.get(path).json()
            self.assertEqual(resource["resource"], settings.MCP_PUBLIC_URL)
            self.assertEqual(
                resource["authorization_servers"], [settings.MCP_OAUTH_ISSUER]
            )

    def test_s256_authorization_exchange_and_hashed_token_storage(self):
        payload = self.tokens()
        principal = authenticate_bearer(f"Bearer {payload['access_token']}")
        self.assertEqual(principal.user.pk, self.user.pk)
        self.assertEqual(principal.client_id, self.application.client_id)
        self.assertEqual(principal.scopes, {"crm.read", "crm.write"})
        token = get_access_token_model().objects.get(pk=principal.token_id)
        self.assertEqual(token.resource, [settings.MCP_PUBLIC_URL])
        self.assertEqual(token.token, "")
        self.assertEqual(
            token.token_checksum,
            hashlib.sha256(payload["access_token"].encode()).hexdigest(),
        )
        refresh = get_refresh_token_model().objects.get(access_token=token)
        self.assertEqual(refresh.resource, [settings.MCP_PUBLIC_URL])
        self.assertEqual(refresh.token, "")
        self.application.refresh_from_db()
        self.assertNotEqual(self.application.client_secret, self.secret)
        self.assertTrue(check_password(self.secret, self.application.client_secret))

    def test_authorization_requires_login_and_explicit_user_grant(self):
        response = self.client.get("/oauth/authorize/", self.params)
        self.assertEqual(response.status_code, 302)
        self.assertTrue(response["Location"].startswith("/oauth/login/"))
        outsider = get_user_model().objects.create_user(username="outsider")
        self.client.force_login(outsider)
        self.assertEqual(
            self.client.get("/oauth/authorize/", self.params).status_code, 403
        )
        self.assertFalse(McpAccessGrant.objects.filter(user=outsider).exists())

    def test_consent_requires_csrf_and_token_exchange_does_not(self):
        client = Client(enforce_csrf_checks=True)
        client.force_login(self.user)
        self.assertEqual(client.get("/oauth/authorize/", self.params).status_code, 200)
        self.assertEqual(
            client.post(
                "/oauth/authorize/", {**self.params, "allow": "true"}
            ).status_code,
            403,
        )
        code = self.authorize(client)
        response = client.post(
            "/oauth/token/",
            {
                "grant_type": "authorization_code",
                "code": code,
                "client_id": self.application.client_id,
                "client_secret": self.secret,
                "redirect_uri": self.application.redirect_uris,
                "code_verifier": self.verifier,
                "resource": settings.MCP_PUBLIC_URL,
            },
        )
        self.assertEqual(response.status_code, 200, response.content[:500])

    def test_login_requires_csrf_and_rejects_external_next_url(self):
        client = Client(enforce_csrf_checks=True)
        self.assertEqual(client.get("/oauth/login/").status_code, 200)
        data = {
            "username": self.user.username,
            "password": "test-login-password",
            "next": "https://untrusted.example/",
        }
        self.assertEqual(client.post("/oauth/login/", data).status_code, 403)
        data["csrfmiddlewaretoken"] = client.cookies["csrftoken"].value
        response = client.post("/oauth/login/", data)
        self.assertEqual(response.status_code, 302)
        self.assertEqual(response["Location"], "/")

    def test_authorization_rejects_missing_wrong_or_multiple_resources(self):
        self.client.force_login(self.user)
        for resource in (
            None,
            "https://other.example/mcp",
            [settings.MCP_PUBLIC_URL] * 2,
        ):
            params = self.params.copy()
            if resource is None:
                params.pop("resource")
            else:
                params["resource"] = resource
            with self.subTest(resource=resource):
                response = self.client.get("/oauth/authorize/", params)
                self.assertEqual(response.status_code, 403)

    def test_token_exchange_rejects_wrong_verifier_or_resource(self):
        response = self.exchange(self.authorize(), code_verifier="w" * 64)
        self.assertEqual(response.status_code, 400)
        response = self.exchange(self.authorize(), resource="https://other.example/mcp")
        self.assertEqual(response.status_code, 400)
        self.assertFalse(get_access_token_model().objects.exists())

    def test_authorization_code_is_single_use_and_requires_client_secret(self):
        code = self.authorize()
        response = self.exchange(code, client_secret="incorrect-test-secret")
        self.assertEqual(response.status_code, 401)
        self.assertEqual(self.exchange(code).status_code, 200)
        self.assertEqual(self.exchange(code).status_code, 400)

    def test_token_exchange_without_resource_inherits_bound_authorization(self):
        code = self.authorize()
        data = {
            "grant_type": "authorization_code",
            "code": code,
            "client_id": self.application.client_id,
            "client_secret": self.secret,
            "redirect_uri": self.application.redirect_uris,
            "code_verifier": self.verifier,
        }
        response = self.client.post("/oauth/token/", data)
        self.assertEqual(response.status_code, 200, response.content[:500])
        principal = authenticate_bearer(f"Bearer {response.json()['access_token']}")
        token = get_access_token_model().objects.get(pk=principal.token_id)
        self.assertEqual(token.resource, [settings.MCP_PUBLIC_URL])

    def test_plain_pkce_and_scope_escalation_are_rejected(self):
        self.client.force_login(self.user)
        params = {**self.params, "code_challenge_method": "plain"}
        response = self.client.get("/oauth/authorize/", params)
        if response.status_code == 200:
            response = self.client.post(
                "/oauth/authorize/", {**params, "allow": "true"}
            )
        self.assertFalse(get_grant_model().objects.exists())
        if response.status_code == 302:
            self.assertNotIn("code", parse_qs(urlsplit(response["Location"]).query))
        self.access.scopes = ["crm.read"]
        self.access.save()
        self.assertEqual(
            self.client.get("/oauth/authorize/", self.params).status_code, 403
        )
        self.assertFalse(get_grant_model().objects.exists())

    def test_refresh_rotates_tokens_and_preserves_audience(self):
        original = self.tokens()
        response = self.refresh(original["refresh_token"])
        self.assertEqual(response.status_code, 200, response.content[:500])
        renewed = response.json()
        self.assertNotEqual(original["access_token"], renewed["access_token"])
        self.assertNotEqual(original["refresh_token"], renewed["refresh_token"])
        principal = authenticate_bearer(f"Bearer {renewed['access_token']}")
        token = get_access_token_model().objects.get(pk=principal.token_id)
        self.assertEqual(token.resource, [settings.MCP_PUBLIC_URL])
        with self.assertRaises(AuthenticationFailed):
            authenticate_bearer(f"Bearer {original['access_token']}")

    def test_refresh_without_resource_inherits_only_its_original_audience(self):
        original = self.tokens()
        response = self.refresh(original["refresh_token"], resource=None)
        self.assertEqual(response.status_code, 200, response.content[:500])
        principal = authenticate_bearer(f"Bearer {response.json()['access_token']}")
        token = get_access_token_model().objects.get(pk=principal.token_id)
        self.assertEqual(token.resource, [settings.MCP_PUBLIC_URL])

    def test_refresh_rejects_wrong_resource_and_scope_escalation(self):
        original = self.tokens()
        self.assertEqual(
            self.refresh(
                original["refresh_token"], resource="https://other.example"
            ).status_code,
            400,
        )
        self.assertEqual(
            self.refresh(
                original["refresh_token"], scope="crm.destructive"
            ).status_code,
            400,
        )

    def test_revocation_and_expiry_invalidate_live_principals(self):
        payload = self.tokens()
        principal = authenticate_bearer(f"Bearer {payload['access_token']}")
        get_access_token_model().objects.filter(pk=principal.token_id).update(
            expires=timezone.now() - timedelta(seconds=1)
        )
        with self.assertRaises(AuthenticationFailed):
            require_access(principal, ["crm.read"])
        payload = self.tokens()
        response = self.client.post(
            "/oauth/revoke/",
            {
                "token": payload["refresh_token"],
                "token_type_hint": "refresh_token",
                "client_id": self.application.client_id,
                "client_secret": self.secret,
            },
        )
        self.assertEqual(response.status_code, 200)
        self.assertEqual(self.refresh(payload["refresh_token"]).status_code, 400)
        with self.assertRaises(AuthenticationFailed):
            authenticate_bearer(f"Bearer {payload['access_token']}")

    def test_disabled_user_or_grant_and_reduced_scopes_take_effect_immediately(self):
        payload = self.tokens()
        principal = authenticate_bearer(f"Bearer {payload['access_token']}")
        self.access.scopes = ["crm.read"]
        self.access.save()
        with self.assertRaises(PermissionDenied):
            require_access(principal, ["crm.write"])
        self.assertEqual(require_access(principal, ["crm.read"]).scopes, {"crm.read"})
        self.access.enabled = False
        self.access.save()
        with self.assertRaises(PermissionDenied):
            authenticate_bearer(f"Bearer {payload['access_token']}")
        self.assertEqual(self.refresh(payload["refresh_token"]).status_code, 400)
        self.access.enabled = True
        self.access.save()
        self.user.is_active = False
        self.user.save()
        with self.assertRaises(PermissionDenied):
            require_access(principal)

    def test_unrestricted_or_other_resource_tokens_cannot_enter_mcp(self):
        for audience in ([], ["https://other.example/mcp"]):
            value = f"test-token-{len(audience)}"
            token = get_access_token_model()(
                user=self.user,
                application=self.application,
                expires=timezone.now() + timedelta(hours=1),
                scope="crm.read",
                resource=audience,
            )
            McpOAuthValidator()._set_token_value(token, value)
            token.save()
            with self.subTest(audience=audience), self.assertRaises(
                AuthenticationFailed
            ):
                authenticate_bearer(f"Bearer {value}")


class McpProvisioningTests(TestCase):
    def test_client_creation_hashes_secret_and_does_not_grant_users(self):
        user = get_user_model().objects.create_user(username="Vova")
        output = io.StringIO()
        callback = "https://chatgpt.com/connector_platform_oauth_redirect"
        call_command("configure_mcp_client", redirect_uri=callback, stdout=output)
        values = dict(
            line.split(": ", 1)
            for line in output.getvalue().splitlines()
            if line.startswith(("client_id:", "client_secret:"))
        )
        app = get_application_model().objects.get(client_id=values["client_id"])
        self.assertTrue(check_password(values["client_secret"], app.client_secret))
        self.assertFalse(McpAccessGrant.objects.filter(user=user).exists())
        output = io.StringIO()
        call_command("configure_mcp_client", redirect_uri=callback, stdout=output)
        self.assertNotIn("client_secret:", output.getvalue())
        self.assertEqual(get_application_model().objects.count(), 1)

    def test_client_setup_rejects_untrusted_callbacks(self):
        for callback in (
            "http://chatgpt.com/callback",
            "https://chatgpt.com.evil.example/callback",
            "https://chatgpt.com/callback#fragment",
            "https://chatgpt.com/*",
        ):
            with self.subTest(callback=callback), self.assertRaises(CommandError):
                call_command(
                    "configure_mcp_client", redirect_uri=callback, stdout=io.StringIO()
                )
        self.assertFalse(get_application_model().objects.exists())

    def test_grant_is_explicit_and_bound_to_user_id_after_rename(self):
        user = get_user_model().objects.create_user(username="Vova")
        self.assertFalse(McpAccessGrant.objects.exists())
        call_command("grant_mcp_access", username="Vova", stdout=io.StringIO())
        grant = McpAccessGrant.objects.get(user=user)
        user.username = "renamed-vova"
        user.save()
        get_user_model().objects.create_user(username="Vova")
        self.assertEqual(McpAccessGrant.objects.get(pk=grant.pk).user_id, user.pk)
        self.assertEqual(McpAccessGrant.objects.count(), 1)
        call_command(
            "grant_mcp_access",
            username=user.username,
            revoke=True,
            stdout=io.StringIO(),
        )
        grant.refresh_from_db()
        self.assertFalse(grant.enabled)

    def test_missing_or_inactive_user_is_not_implicitly_created_or_enabled(self):
        with self.assertRaises(CommandError):
            call_command("grant_mcp_access", username="missing", stdout=io.StringIO())
        self.assertFalse(get_user_model().objects.filter(username="missing").exists())
        user = get_user_model().objects.create_user(
            username="inactive", is_active=False
        )
        with self.assertRaises(CommandError):
            call_command(
                "grant_mcp_access", username=user.username, stdout=io.StringIO()
            )
        self.assertFalse(McpAccessGrant.objects.exists())
