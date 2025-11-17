"""
URL configuration for config project.

The `urlpatterns` list routes URLs to views. For more information please see:
    https://docs.djangoproject.com/en/5.1/topics/http/urls/
Examples:
Function views
    1. Add an import:  from my_app import views
    2. Add a URL to urlpatterns:  path('', views.home, name='home')
Class-based views
    1. Add an import:  from other_app.views import Home
    2. Add a URL to urlpatterns:  path('', Home.as_view(), name='home')
Including another URLconf
    1. Import the include() function: from django.urls import include, path
    2. Add a URL to urlpatterns:  path('blog/', include('blog.urls'))
"""

from apps.documents.views import DocumentRecognitionView
from apps.finances.views import FinanceSummaryView
from apps.users.views import current_user_view, login_view, refresh_token_view
from config.admin import admin_site
from config.api_router import api_urlpatterns
from django.http import JsonResponse
from django.urls import include, path

urlpatterns = [
    path("admin/", admin_site.urls),
    path("health/", lambda request: JsonResponse({"status": "ok"})),
    path("api/v1/auth/login/", login_view, name="login"),
    path("api/v1/auth/refresh/", refresh_token_view, name="refresh-token"),
    path("api/v1/auth/me/", current_user_view, name="current-user"),
    path(
        "api/v1/finances/summary/", FinanceSummaryView.as_view(), name="finance-summary"
    ),
    path(
        "api/v1/documents/recognize/",
        DocumentRecognitionView.as_view(),
        name="document-recognize",
    ),
    path("api/v1/", include(api_urlpatterns)),
]
