from django.urls import path
from oauth2_provider.views import RevokeTokenView, TokenView

from .views import McpAuthorizationView, McpLoginView

app_name = "oauth2_provider"

urlpatterns = [
    path("login/", McpLoginView.as_view(), name="login"),
    path("authorize/", McpAuthorizationView.as_view(), name="authorize"),
    path("token/", TokenView.as_view(), name="token"),
    path("revoke/", RevokeTokenView.as_view(), name="revoke-token"),
]
