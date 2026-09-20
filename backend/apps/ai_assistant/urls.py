from django.urls import path

from .views import (
    ConversationDetailView,
    ConversationMessagesView,
    ConversationsView,
    DocumentDetailView,
    DocumentsView,
    ProvidersView,
    UsageView,
)

urlpatterns = [
    path("providers/", ProvidersView.as_view()),
    path("usage/", UsageView.as_view()),
    path("conversations/", ConversationsView.as_view()),
    path("conversations/<str:conversation_id>/", ConversationDetailView.as_view()),
    path("conversations/<str:conversation_id>/messages/", ConversationMessagesView.as_view()),
    path("documents/", DocumentsView.as_view()),
    path("documents/<str:document_id>/", DocumentDetailView.as_view()),
]
