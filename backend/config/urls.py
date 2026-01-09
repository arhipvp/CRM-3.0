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

from apps.documents.views import (
    DocumentRecognitionView,
    KnowledgeAskView,
    KnowledgeChatSessionDetailView,
    KnowledgeChatSessionsView,
    KnowledgeNotebookDetailView,
    KnowledgeNotebooksView,
    KnowledgeNoteDetailView,
    KnowledgeNotesView,
    KnowledgeSourceDetailView,
    KnowledgeSourceDownloadView,
    KnowledgeSourcesView,
)
from apps.finances.views import FinanceSummaryView
from apps.notifications.views import (
    NotificationSettingsView,
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
    path("api/v1/knowledge/ask/", KnowledgeAskView.as_view(), name="knowledge-ask"),
    path(
        "api/v1/knowledge/chat/sessions/",
        KnowledgeChatSessionsView.as_view(),
        name="knowledge-chat-sessions",
    ),
    path(
        "api/v1/knowledge/chat/sessions/<str:session_id>/",
        KnowledgeChatSessionDetailView.as_view(),
        name="knowledge-chat-session-detail",
    ),
    path(
        "api/v1/knowledge/notebooks/",
        KnowledgeNotebooksView.as_view(),
        name="knowledge-notebooks",
    ),
    path(
        "api/v1/knowledge/notebooks/<str:notebook_id>/",
        KnowledgeNotebookDetailView.as_view(),
        name="knowledge-notebook-detail",
    ),
    path(
        "api/v1/knowledge/sources/",
        KnowledgeSourcesView.as_view(),
        name="knowledge-sources",
    ),
    path(
        "api/v1/knowledge/sources/<str:source_id>/",
        KnowledgeSourceDetailView.as_view(),
        name="knowledge-source-detail",
    ),
    path(
        "api/v1/knowledge/sources/<str:source_id>/download/",
        KnowledgeSourceDownloadView.as_view(),
        name="knowledge-source-download",
    ),
    path(
        "api/v1/knowledge/notes/", KnowledgeNotesView.as_view(), name="knowledge-notes"
    ),
    path(
        "api/v1/knowledge/notes/<str:note_id>/",
        KnowledgeNoteDetailView.as_view(),
        name="knowledge-note-detail",
    ),
    path("api/v1/", include(api_urlpatterns)),
]

if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
