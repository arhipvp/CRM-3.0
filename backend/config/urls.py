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
from apps.notifications.views import (
    NotificationSettingsView,
    TelegramIntakeDriveUploadView,
    TelegramLinkView,
    TelegramUnlinkView,
)
from apps.policies.views import SellerDashboardView
from apps.users.views import (
    change_password_view,
    current_user_view,
    login_view,
    refresh_token_view,
)
from config.admin import admin_site
from config.api_router import api_urlpatterns
from django.conf import settings
from django.conf.urls.static import static
from django.http import JsonResponse
from django.urls import include, path

urlpatterns = [
    path("admin/", admin_site.urls),
    path("health/", lambda request: JsonResponse({"status": "ok"})),
    path("api/v1/auth/login/", login_view, name="login"),
    path("api/v1/auth/refresh/", refresh_token_view, name="refresh-token"),
    path("api/v1/auth/password/", change_password_view, name="change-password"),
    path("api/v1/auth/me/", current_user_view, name="current-user"),
    path(
        "api/v1/notifications/settings/",
        NotificationSettingsView.as_view(),
        name="notification-settings",
    ),
    path(
        "api/v1/notifications/telegram-link/",
        TelegramLinkView.as_view(),
        name="telegram-link",
    ),
    path(
        "api/v1/notifications/telegram-unlink/",
        TelegramUnlinkView.as_view(),
        name="telegram-unlink",
    ),
    path(
        "api/v1/notifications/telegram-intake/upload-drive/",
        TelegramIntakeDriveUploadView.as_view(),
        name="telegram-intake-upload-drive",
    ),
    path(
        "api/v1/finances/summary/", FinanceSummaryView.as_view(), name="finance-summary"
    ),
    path(
        "api/v1/dashboard/seller/",
        SellerDashboardView.as_view(),
        name="seller-dashboard",
    ),
    path(
        "api/v1/documents/recognize/",
        DocumentRecognitionView.as_view(),
        name="document-recognize",
    ),
    path("api/v1/", include(api_urlpatterns)),
]

if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
