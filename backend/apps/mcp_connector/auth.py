"""OAuth verification and the live, per-user integration allowlist."""

from django.conf import settings
from django.contrib.auth import get_user_model
from django.utils import timezone
from oauth2_provider.models import get_access_token_model
from oauth2_provider.oauth2_validators import OAuth2Validator
from oauthlib.common import Request
from oauthlib.oauth2 import AccessDeniedError, InvalidRequestError
from rest_framework.exceptions import AuthenticationFailed, PermissionDenied

from .contracts import Principal
from .models import McpAccessGrant


def _user_grant(user, scopes=()):
    if not user or not user.is_authenticated or not user.is_active:
        return None
    grant = McpAccessGrant.objects.filter(user_id=user.pk, enabled=True).first()
    if not grant or not isinstance(grant.scopes, list):
        return None
    return grant if set(scopes).issubset(grant.scopes) else None


def require_access(principal, required_scopes=()):
    """Re-read user, grant and token; role changes/revocations take effect immediately."""
    user = get_user_model().objects.filter(pk=principal.user.pk, is_active=True).first()
    if not _user_grant(user, required_scopes):
        raise PermissionDenied(
            "CRM MCP access is disabled or lacks the required scopes."
        )
    scopes = frozenset(principal.scopes)
    if principal.token_id is not None:
        token = (
            get_access_token_model()
            .objects.select_related("application")
            .filter(pk=principal.token_id, user_id=user.pk, expires__gt=timezone.now())
            .first()
        )
        if (
            token is None
            or token.application is None
            or token.application.client_id != principal.client_id
            or token.resource != [settings.MCP_PUBLIC_URL]
        ):
            raise AuthenticationFailed("The MCP connection must be authorized again.")
        scopes = scopes.intersection(token.scopes)
    if not set(required_scopes).issubset(scopes):
        raise PermissionDenied("The OAuth token lacks the required MCP scopes.")
    grant = _user_grant(user)
    scopes = scopes.intersection(grant.scopes)
    return Principal(user, principal.client_id, frozenset(scopes), principal.token_id)


def authenticate_bearer(authorization):
    if not authorization or not authorization.startswith("Bearer "):
        raise AuthenticationFailed("An OAuth bearer token is required.")
    token_value = authorization[7:]
    if not token_value or len(token_value) > 4096:
        raise AuthenticationFailed("Invalid OAuth token.")
    request = Request(settings.MCP_PUBLIC_URL, http_method="POST")
    if not McpOAuthValidator().validate_bearer_token(token_value, [], request):
        raise AuthenticationFailed("Invalid or expired OAuth token.")
    token = request.access_token
    # DOT permits unrestricted tokens for its other resource-server users. MCP does not.
    if token.resource != [settings.MCP_PUBLIC_URL] or token.application is None:
        raise AuthenticationFailed("The token was not issued for this MCP server.")
    if token.user is None:
        raise AuthenticationFailed("A CRM user authorization is required.")
    return require_access(
        Principal(
            token.user, token.application.client_id, frozenset(token.scopes), token.pk
        )
    )


class McpOAuthValidator(OAuth2Validator):
    def validate_grant_type(
        self, client_id, grant_type, client, request, *args, **kwargs
    ):
        return grant_type in {
            "authorization_code",
            "refresh_token",
        } and super().validate_grant_type(
            client_id, grant_type, client, request, *args, **kwargs
        )

    def validate_scopes(self, client_id, scopes, client, request, *args, **kwargs):
        if not super().validate_scopes(
            client_id, scopes, client, request, *args, **kwargs
        ):
            return False
        user = getattr(request, "user", None)
        return user is None or bool(_user_grant(user, scopes))

    def validate_code(self, client_id, code, client, request, *args, **kwargs):
        return super().validate_code(
            client_id, code, client, request, *args, **kwargs
        ) and bool(_user_grant(request.user, getattr(request, "scopes", None) or ()))

    def validate_refresh_token(self, refresh_token, client, request, *args, **kwargs):
        return super().validate_refresh_token(
            refresh_token, client, request, *args, **kwargs
        ) and bool(_user_grant(request.user, getattr(request, "scopes", None) or ()))

    def save_authorization_code(self, client_id, code, request, *args, **kwargs):
        self._validate_mcp_issuance(request)
        return super().save_authorization_code(
            client_id, code, request, *args, **kwargs
        )

    def _save_bearer_token(self, token, request, *args, **kwargs):
        # DOT normalizes POST strings and inherits the authorization/refresh audience here.
        self._check_and_set_request_resource(request)
        self._validate_mcp_issuance(request)
        return super()._save_bearer_token(token, request, *args, **kwargs)

    @staticmethod
    def _validate_mcp_issuance(request):
        if not _user_grant(request.user, request.scopes or ()):
            raise AccessDeniedError(
                description="CRM MCP access is not enabled for these scopes."
            )
        if getattr(request, "resource", None) != [settings.MCP_PUBLIC_URL]:
            raise InvalidRequestError(
                description="The exact CRM MCP resource is required."
            )
