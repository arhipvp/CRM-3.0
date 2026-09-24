from django.urls import path

from .views import (
    DealDetailView,
    DealFileDownloadView,
    DealFilesView,
    DealListView,
    DealMailboxMessageView,
    DealSectionView,
)

urlpatterns = [
    path("deals/", DealListView.as_view(), name="codex-deals"),
    path("deals/<uuid:deal_id>/", DealDetailView.as_view(), name="codex-deal"),
    path(
        "deals/<uuid:deal_id>/sections/<str:section>/",
        DealSectionView.as_view(),
        name="codex-deal-section",
    ),
    path(
        "deals/<uuid:deal_id>/files/",
        DealFilesView.as_view(),
        name="codex-deal-files",
    ),
    path(
        "deals/<uuid:deal_id>/files/<str:file_id>/download/",
        DealFileDownloadView.as_view(),
        name="codex-deal-file-download",
    ),
    path(
        "deals/<uuid:deal_id>/mailbox/messages/<str:message_id>/",
        DealMailboxMessageView.as_view(),
        name="codex-deal-mailbox-message",
    ),
]
