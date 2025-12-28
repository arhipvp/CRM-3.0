import json
import urllib.error
import urllib.request
from pathlib import Path
from uuid import uuid4

from django.conf import settings

from .models import OpenNotebookSession


class OpenNotebookError(Exception):
    pass


class OpenNotebookClient:
    def __init__(self):
        self.base_url = settings.OPEN_NOTEBOOK_API_URL.rstrip("/")
        self.password = settings.OPEN_NOTEBOOK_PASSWORD
        self.timeout = settings.OPEN_NOTEBOOK_TIMEOUT_SECONDS

    def is_configured(self) -> bool:
        return bool(self.base_url)

    def _request(self, method: str, path: str, payload: dict | None = None) -> dict:
        url = f"{self.base_url}{path}"
        headers = {"Content-Type": "application/json"}
        if self.password:
            headers["Authorization"] = f"Bearer {self.password}"

        data = None
        if payload is not None:
            data = json.dumps(payload).encode("utf-8")

        request = urllib.request.Request(
            url=url,
            data=data,
            headers=headers,
            method=method,
        )

        try:
            with urllib.request.urlopen(request, timeout=self.timeout) as response:
                body = response.read()
        except urllib.error.HTTPError as exc:
            detail = exc.read().decode("utf-8", errors="ignore")
            raise OpenNotebookError(
                f"Open Notebook error {exc.code}: {detail}"
            ) from exc
        except urllib.error.URLError as exc:
            raise OpenNotebookError(f"Open Notebook connection error: {exc}") from exc

        if not body:
            return {}
        try:
            return json.loads(body.decode("utf-8"))
        except json.JSONDecodeError as exc:
            raise OpenNotebookError(
                "Open Notebook returned invalid JSON response."
            ) from exc

    def get_notebooks(self) -> list[dict]:
        response = self._request("GET", "/api/notebooks")
        if isinstance(response, list):
            return response
        return [response]

    def update_notebook(
        self, notebook_id: str, name: str | None = None, description: str | None = None
    ) -> dict:
        payload = {}
        if name is not None:
            payload["name"] = name
        if description is not None:
            payload["description"] = description
        return self._request("PUT", f"/api/notebooks/{notebook_id}", payload)

    def delete_notebook(self, notebook_id: str) -> dict:
        return self._request("DELETE", f"/api/notebooks/{notebook_id}")

    def create_notebook(self, name: str, description: str = "") -> dict:
        return self._request(
            "POST", "/api/notebooks", {"name": name, "description": description}
        )

    def create_source(
        self,
        notebook_id: str,
        file_path: str,
        title: str,
        embed: bool,
        async_processing: bool = False,
    ) -> dict:
        payload = {
            "notebook_id": notebook_id,
            "type": "upload",
            "file_path": file_path,
            "title": title,
            "embed": embed,
            "async_processing": async_processing,
        }
        return self._request("POST", "/api/sources/json", payload)

    def create_source_upload(
        self,
        notebook_id: str,
        file_path: str,
        title: str,
        embed: bool,
        async_processing: bool = False,
        mime_type: str | None = None,
    ) -> dict:
        boundary = f"----crm3-open-notebook-{uuid4().hex}"
        fields = {
            "notebook_id": notebook_id,
            "type": "upload",
            "title": title,
            "embed": "true" if embed else "false",
            "async_processing": "true" if async_processing else "false",
        }
        file_name = Path(file_path).name
        content_type = mime_type or "application/octet-stream"
        body = bytearray()

        def add_line(value: str) -> None:
            body.extend(value.encode("utf-8"))
            body.extend(b"\r\n")

        for key, value in fields.items():
            add_line(f"--{boundary}")
            add_line(f'Content-Disposition: form-data; name="{key}"')
            add_line("")
            add_line(str(value))

        add_line(f"--{boundary}")
        add_line(f'Content-Disposition: form-data; name="file"; filename="{file_name}"')
        add_line(f"Content-Type: {content_type}")
        add_line("")
        with open(file_path, "rb") as handle:
            body.extend(handle.read())
        body.extend(b"\r\n")
        add_line(f"--{boundary}--")

        headers = {"Content-Type": f"multipart/form-data; boundary={boundary}"}
        if self.password:
            headers["Authorization"] = f"Bearer {self.password}"

        request = urllib.request.Request(
            url=f"{self.base_url}/api/sources",
            data=bytes(body),
            headers=headers,
            method="POST",
        )

        try:
            with urllib.request.urlopen(request, timeout=self.timeout) as response:
                body_bytes = response.read()
        except urllib.error.HTTPError as exc:
            detail = exc.read().decode("utf-8", errors="ignore")
            raise OpenNotebookError(
                f"Open Notebook error {exc.code}: {detail}"
            ) from exc
        except urllib.error.URLError as exc:
            raise OpenNotebookError(f"Open Notebook connection error: {exc}") from exc

        if not body_bytes:
            return {}
        try:
            return json.loads(body_bytes.decode("utf-8"))
        except json.JSONDecodeError as exc:
            raise OpenNotebookError(
                "Open Notebook returned invalid JSON response."
            ) from exc

    def generate_embeddings(
        self, item_id: str, item_type: str = "source", async_processing: bool = False
    ) -> dict:
        payload = {
            "item_id": item_id,
            "item_type": item_type,
            "async_processing": async_processing,
        }
        return self._request("POST", "/api/embed", payload)

    def get_source_status(self, source_id: str) -> dict:
        return self._request("GET", f"/api/sources/{source_id}/status")

    def retry_source(self, source_id: str) -> dict:
        return self._request("POST", f"/api/sources/{source_id}/retry")

    def create_chat_session(self, notebook_id: str, title: str | None = None) -> dict:
        payload = {"notebook_id": notebook_id}
        if title:
            payload["title"] = title
        return self._request("POST", "/api/chat/sessions", payload)

    def build_context(self, notebook_id: str, context_config: dict) -> dict:
        payload = {"notebook_id": notebook_id, "context_config": context_config}
        return self._request("POST", "/api/chat/context", payload)

    def execute_chat(self, session_id: str, message: str, context: dict) -> dict:
        payload = {"session_id": session_id, "message": message, "context": context}
        return self._request("POST", "/api/chat/execute", payload)

    def delete_source(self, source_id: str) -> dict:
        return self._request("DELETE", f"/api/sources/{source_id}")

    def list_sources(self, notebook_id: str) -> list[dict]:
        response = self._request("GET", f"/api/sources?notebook_id={notebook_id}")
        if isinstance(response, list):
            return response
        return [response]

    def download_source(self, source_id: str) -> tuple[bytes, str, str | None]:
        url = f"{self.base_url}/api/sources/{source_id}/download"
        headers = {}
        if self.password:
            headers["Authorization"] = f"Bearer {self.password}"

        request = urllib.request.Request(url=url, headers=headers, method="GET")
        try:
            with urllib.request.urlopen(request, timeout=self.timeout) as response:
                body = response.read()
                content_type = response.headers.get(
                    "Content-Type", "application/octet-stream"
                )
                content_disposition = response.headers.get("Content-Disposition")
                return body, content_type, content_disposition
        except urllib.error.HTTPError as exc:
            detail = exc.read().decode("utf-8", errors="ignore")
            raise OpenNotebookError(
                f"Open Notebook error {exc.code}: {detail}"
            ) from exc
        except urllib.error.URLError as exc:
            raise OpenNotebookError(f"Open Notebook connection error: {exc}") from exc

    def create_source_upload_bytes(
        self,
        notebook_id: str,
        file_name: str,
        content: bytes,
        title: str,
        embed: bool,
        async_processing: bool = False,
        mime_type: str | None = None,
    ) -> dict:
        boundary = f"----crm3-open-notebook-{uuid4().hex}"
        fields = {
            "notebook_id": notebook_id,
            "type": "upload",
            "title": title,
            "embed": "true" if embed else "false",
            "async_processing": "true" if async_processing else "false",
        }
        content_type = mime_type or "application/octet-stream"
        body = bytearray()

        def add_line(value: str) -> None:
            body.extend(value.encode("utf-8"))
            body.extend(b"\r\n")

        for key, value in fields.items():
            add_line(f"--{boundary}")
            add_line(f'Content-Disposition: form-data; name="{key}"')
            add_line("")
            add_line(str(value))

        add_line(f"--{boundary}")
        add_line(f'Content-Disposition: form-data; name="file"; filename="{file_name}"')
        add_line(f"Content-Type: {content_type}")
        add_line("")
        body.extend(content)
        body.extend(b"\r\n")
        add_line(f"--{boundary}--")

        headers = {"Content-Type": f"multipart/form-data; boundary={boundary}"}
        if self.password:
            headers["Authorization"] = f"Bearer {self.password}"

        request = urllib.request.Request(
            url=f"{self.base_url}/api/sources",
            data=bytes(body),
            headers=headers,
            method="POST",
        )

        try:
            with urllib.request.urlopen(request, timeout=self.timeout) as response:
                body_bytes = response.read()
        except urllib.error.HTTPError as exc:
            detail = exc.read().decode("utf-8", errors="ignore")
            raise OpenNotebookError(
                f"Open Notebook error {exc.code}: {detail}"
            ) from exc
        except urllib.error.URLError as exc:
            raise OpenNotebookError(f"Open Notebook connection error: {exc}") from exc

        if not body_bytes:
            return {}
        try:
            return json.loads(body_bytes.decode("utf-8"))
        except json.JSONDecodeError as exc:
            raise OpenNotebookError(
                "Open Notebook returned invalid JSON response."
            ) from exc

    def list_notes(self, notebook_id: str) -> list[dict]:
        response = self._request("GET", f"/api/notes?notebook_id={notebook_id}")
        if isinstance(response, list):
            return response
        return [response]

    def create_note(
        self, notebook_id: str, title: str, content: str, note_type: str = "human"
    ) -> dict:
        payload = {
            "notebook_id": notebook_id,
            "title": title,
            "content": content,
            "note_type": note_type,
        }
        return self._request("POST", "/api/notes", payload)

    def delete_note(self, note_id: str) -> dict:
        return self._request("DELETE", f"/api/notes/{note_id}")


class OpenNotebookSyncService:
    def __init__(self):
        self.client = OpenNotebookClient()

    def is_configured(self) -> bool:
        return self.client.is_configured()

    def _get_or_create_session_id(self, notebook_id: str) -> str:
        existing = OpenNotebookSession.objects.filter(notebook_id=notebook_id).first()
        if existing:
            return existing.chat_session_id

        session = self.client.create_chat_session(
            notebook_id=notebook_id, title="CRM Ask"
        )
        session_id = session.get("id")
        if not session_id:
            raise OpenNotebookError("Open Notebook не вернул id сессии чата.")

        OpenNotebookSession.objects.update_or_create(
            notebook_id=notebook_id,
            defaults={"chat_session_id": session_id},
        )
        return session_id

    def _reset_session_id(self, notebook_id: str) -> str:
        session = self.client.create_chat_session(
            notebook_id=notebook_id, title="CRM Ask"
        )
        session_id = session.get("id")
        if not session_id:
            raise OpenNotebookError("Open Notebook не вернул id сессии чата.")

        OpenNotebookSession.objects.update_or_create(
            notebook_id=notebook_id,
            defaults={"chat_session_id": session_id},
        )
        return session_id

    def ask_notebook(self, notebook_id: str, question: str) -> dict:
        if not self.is_configured():
            raise OpenNotebookError("Open Notebook не настроен.")

        sources = self.client.list_sources(notebook_id)
        if not sources:
            raise OpenNotebookError("Нет документов в блокноте для вопроса.")

        session_id = self._get_or_create_session_id(notebook_id)

        context_config = {
            "sources": {
                source.get("id"): settings.OPEN_NOTEBOOK_CONTEXT_LEVEL
                for source in sources
                if source.get("id")
            },
            "notes": {},
        }
        context_response = self.client.build_context(
            notebook_id=notebook_id, context_config=context_config
        )
        context = context_response.get("context")
        if not context:
            raise OpenNotebookError("Open Notebook не вернул контекст.")

        try:
            chat_response = self.client.execute_chat(
                session_id=session_id, message=question, context=context
            )
        except OpenNotebookError:
            session_id = self._reset_session_id(notebook_id)
            chat_response = self.client.execute_chat(
                session_id=session_id, message=question, context=context
            )
        messages = chat_response.get("messages") or []
        for message in reversed(messages):
            if message.get("type") == "ai":
                content = message.get("content", "")
                return {
                    "answer": content,
                    "citations": self._collect_citations_from_sources(content, sources),
                }
        raise OpenNotebookError("Open Notebook не вернул ответ.")

    def list_sources(self, notebook_id: str) -> list[dict]:
        return self.client.list_sources(notebook_id)

    def create_source_upload_bytes(
        self,
        notebook_id: str,
        file_name: str,
        content: bytes,
        title: str,
        mime_type: str | None = None,
    ) -> dict:
        embed = settings.OPEN_NOTEBOOK_EMBED_ON_UPLOAD
        return self.client.create_source_upload_bytes(
            notebook_id=notebook_id,
            file_name=file_name,
            content=content,
            title=title,
            embed=embed,
            async_processing=True,
            mime_type=mime_type,
        )

    def delete_source(self, source_id: str) -> dict:
        return self.client.delete_source(source_id)

    def list_notes(self, notebook_id: str) -> list[dict]:
        return self.client.list_notes(notebook_id)

    def create_note(self, notebook_id: str, title: str, content: str) -> dict:
        return self.client.create_note(
            notebook_id=notebook_id, title=title, content=content
        )

    def delete_note(self, note_id: str) -> dict:
        return self.client.delete_note(note_id)

    @staticmethod
    def _collect_citations_from_sources(content: str, sources) -> list[dict]:
        import re

        if not content:
            return []

        source_ids = re.findall(r"\[source:([^\]]+)\]", content)
        if not source_ids:
            return []

        seen = set()
        ordered_ids = []
        for source_id in source_ids:
            if source_id not in seen:
                seen.add(source_id)
                ordered_ids.append(source_id)

        citations = []
        for source_id in ordered_ids:
            source = next(
                (item for item in sources if item.get("id") == source_id), None
            )
            if not source:
                continue
            citations.append(
                {
                    "source_id": source_id,
                    "document_id": source_id,
                    "title": source.get("title") or "Источник",
                    "file_url": f"/api/v1/knowledge/sources/{source_id}/download/",
                }
            )
        return citations
