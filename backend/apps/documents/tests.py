from unittest.mock import patch

from django.db import IntegrityError
from django.test import TestCase, override_settings

from .models import OpenNotebookSession
from .open_notebook import OpenNotebookSyncService


@override_settings(OPEN_NOTEBOOK_API_URL="http://open-notebook.test")
class OpenNotebookSessionRaceTests(TestCase):
    def test_uses_session_created_by_concurrent_request(self):
        existing = OpenNotebookSession.objects.create(
            notebook_id="notebook-1",
            chat_session_id="existing-session",
        )
        service = OpenNotebookSyncService()
        service.client.create_chat_session = lambda **_: {"id": "redundant-session"}

        with (
            patch.object(
                OpenNotebookSession.objects,
                "filter",
                side_effect=[
                    OpenNotebookSession.objects.none(),
                    OpenNotebookSession.objects.filter(pk=existing.pk),
                ],
            ),
            patch.object(
                OpenNotebookSession.objects,
                "create",
                side_effect=IntegrityError(
                    "UNIQUE constraint failed: documents_opennotebooksession.notebook_id"
                ),
            ),
        ):
            session_id = service._get_or_create_session_id("notebook-1")

        self.assertEqual(session_id, existing.chat_session_id)
