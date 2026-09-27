from django.urls import path

from .lifecycle_read_views import (
    LifecycleRecordDetailView,
    LifecycleRecordHistoryView,
    LifecycleRecordListView,
    RequestVersionsView,
)
from .lifecycle_views import LifecycleApplyView, LifecyclePreviewView
from .preparation_read_views import (
    ClientPreparationDetailView,
    ClientSearchView,
    PreparationReferencesView,
)
from .preparation_views import PrepApplyView, PrepPreviewView
from .request_views import DealStructuredDataView, RequestPassportView
from .views import (
    DealDetailView,
    DealFileDownloadView,
    DealFilesView,
    DealListView,
    DealMailboxMessageView,
    DealPassportView,
    DealSectionView,
)
from .write_views import CodexNoteCreateView, CodexOffersCreateView

urlpatterns = [
    path(
        "write/deals/<uuid:deal_id>/lifecycle/preview/",
        LifecyclePreviewView.as_view(),
        name="codex-lifecycle-preview",
    ),
    path(
        "write/deals/<uuid:deal_id>/lifecycle/apply/",
        LifecycleApplyView.as_view(),
        name="codex-lifecycle-apply",
    ),
    path(
        "deals/<uuid:deal_id>/records/<str:entity>/",
        LifecycleRecordListView.as_view(),
        name="codex-records",
    ),
    path(
        "deals/<uuid:deal_id>/records/<str:entity>/<uuid:record_id>/",
        LifecycleRecordDetailView.as_view(),
        name="codex-record-detail",
    ),
    path(
        "deals/<uuid:deal_id>/records/<str:entity>/<uuid:record_id>/history/",
        LifecycleRecordHistoryView.as_view(),
        name="codex-record-history",
    ),
    path(
        "deals/<uuid:deal_id>/requests/<uuid:request_id>/versions/",
        RequestVersionsView.as_view(),
        name="codex-request-versions",
    ),
    path(
        "write/deals/<uuid:deal_id>/preparation/preview/",
        PrepPreviewView.as_view(),
        name="codex-preparation-preview",
    ),
    path(
        "write/deals/<uuid:deal_id>/preparation/apply/",
        PrepApplyView.as_view(),
        name="codex-preparation-apply",
    ),
    path("clients/", ClientSearchView.as_view(), name="codex-client-search"),
    path(
        "clients/<uuid:client_id>/",
        ClientPreparationDetailView.as_view(),
        name="codex-client-detail",
    ),
    path("references/", PreparationReferencesView.as_view(), name="codex-references"),
    path(
        "deals/<uuid:deal_id>/data/",
        DealStructuredDataView.as_view(),
        name="codex-deal-data",
    ),
    path(
        "deals/<uuid:deal_id>/requests/<uuid:request_id>/passport/",
        RequestPassportView.as_view(),
        name="codex-request-passport",
    ),
    path(
        "write/deals/<uuid:deal_id>/notes/",
        CodexNoteCreateView.as_view(),
        name="codex-write-note",
    ),
    path(
        "write/deals/<uuid:deal_id>/offers/",
        CodexOffersCreateView.as_view(),
        name="codex-write-offers",
    ),
    path("deals/", DealListView.as_view(), name="codex-deals"),
    path("deals/<uuid:deal_id>/", DealDetailView.as_view(), name="codex-deal"),
    path(
        "deals/<uuid:deal_id>/passport/",
        DealPassportView.as_view(),
        name="codex-deal-passport",
    ),
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
