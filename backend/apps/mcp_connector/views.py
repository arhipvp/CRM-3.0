from django.conf import settings
from django.contrib.auth.views import LoginView
from django.http import HttpResponseForbidden
from django.utils.decorators import method_decorator
from django.views.decorators.cache import never_cache
from oauth2_provider.views import AuthorizationView

from .auth import _user_grant


def mcp_file_download(request, ticket):
    from .files import file_download_view

    return file_download_view(request, ticket)


@method_decorator(never_cache, name="dispatch")
class McpLoginView(LoginView):
    template_name = "mcp_connector/login.html"

    def get_success_url(self):
        return self.get_redirect_url() or "/"


@method_decorator(never_cache, name="dispatch")
class McpAuthorizationView(AuthorizationView):
    template_name = "mcp_connector/authorize.html"

    def dispatch(self, request, *args, **kwargs):
        if request.user.is_authenticated:
            params = request.POST if request.method == "POST" else request.GET
            grant = _user_grant(request.user)
            if grant is None:
                return HttpResponseForbidden(
                    "CRM MCP access is not enabled for this account."
                )
            if not params.get("scope"):
                # Show the permitted scopes in consent when the client omits scope.
                # This also lets a future read-only employee connect without escalation.
                params = params.copy()
                params["scope"] = " ".join(grant.scopes)
                if request.method == "POST":
                    request.POST = params
                else:
                    request.GET = params
                    request.META["QUERY_STRING"] = params.urlencode()
            scopes = params["scope"].split()
            if not _user_grant(request.user, scopes):
                return HttpResponseForbidden(
                    "CRM MCP access is not enabled for this account."
                )
            if params.getlist("resource") != [settings.MCP_PUBLIC_URL]:
                return HttpResponseForbidden("The exact CRM MCP resource is required.")
        return super().dispatch(request, *args, **kwargs)
