import json
import urllib.error
import urllib.request
from pathlib import Path
from uuid import uuid4

from django.conf import settings

from .models import KnowledgeDocument, KnowledgeNotebook


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

    def ensure_notebook(self, insurance_type) -> KnowledgeNotebook:
        existing = getattr(insurance_type, "knowledge_notebook", None)
        if existing:
            return existing

        name = f"Страхование: {insurance_type.name}"
        description = insurance_type.description or ""
        response = self.client.create_notebook(name=name, description=description)
        notebook_id = response.get("id")
        if not notebook_id:
            raise OpenNotebookError("Open Notebook не вернул id блокнота.")

        return KnowledgeNotebook.objects.create(
            insurance_type=insurance_type,
            notebook_id=notebook_id,
            notebook_name=name,
        )

    def sync_document(self, document: KnowledgeDocument, force: bool = False) -> None:
        if not self.is_configured():
            document.open_notebook_status = "disabled"
            document.open_notebook_error = ""
            document.save(
                update_fields=[
                    "open_notebook_status",
                    "open_notebook_error",
                    "updated_at",
                ]
            )
            return

        if not document.file:
            raise OpenNotebookError("Файл документа отсутствует.")

        if not document.insurance_type:
            raise OpenNotebookError("Вид страхования не задан.")

        if document.open_notebook_source_id and not force:
            try:
                status_response = self.client.get_source_status(
                    document.open_notebook_source_id
                )
            except OpenNotebookError as exc:
                document.open_notebook_status = "error"
                document.open_notebook_error = str(exc)
                document.save(
                    update_fields=[
                        "open_notebook_status",
                        "open_notebook_error",
                        "updated_at",
                    ]
                )
                raise

            status = (status_response.get("status") or "").lower()
            if status in {"queued", "running", "new"}:
                document.open_notebook_status = status
                document.open_notebook_error = ""
                document.save(
                    update_fields=[
                        "open_notebook_status",
                        "open_notebook_error",
                        "updated_at",
                    ]
                )
                return
            if status == "failed":
                try:
                    retry_response = self.client.retry_source(
                        document.open_notebook_source_id
                    )
                except OpenNotebookError as exc:
                    document.open_notebook_status = "error"
                    document.open_notebook_error = str(exc)
                    document.save(
                        update_fields=[
                            "open_notebook_status",
                            "open_notebook_error",
                            "updated_at",
                        ]
                    )
                    raise

                document.open_notebook_status = retry_response.get("status") or "queued"
                document.open_notebook_error = ""
                document.save(
                    update_fields=[
                        "open_notebook_status",
                        "open_notebook_error",
                        "updated_at",
                    ]
                )
                return

            document.open_notebook_status = "synced"
            document.open_notebook_error = ""
            document.save(
                update_fields=[
                    "open_notebook_status",
                    "open_notebook_error",
                    "updated_at",
                ]
            )
            return

        if force and document.open_notebook_source_id:
            self.client.delete_source(document.open_notebook_source_id)
            document.open_notebook_source_id = ""

        notebook = self.ensure_notebook(document.insurance_type)
        file_path = self._resolve_file_path(document)
        embed_on_upload = settings.OPEN_NOTEBOOK_EMBED_ON_UPLOAD
        response = self.client.create_source_upload(
            notebook_id=notebook.notebook_id,
            file_path=file_path,
            title=document.title,
            embed=embed_on_upload,
            async_processing=True,
            mime_type=document.mime_type or None,
        )
        source_id = response.get("id")
        if not source_id:
            raise OpenNotebookError("Open Notebook не вернул id источника.")

        document.open_notebook_source_id = source_id
        document.open_notebook_status = response.get("status") or "queued"
        document.open_notebook_error = ""
        document.save(
            update_fields=[
                "open_notebook_source_id",
                "open_notebook_status",
                "open_notebook_error",
                "updated_at",
            ]
        )

    def delete_document(self, document: KnowledgeDocument) -> None:
        if not self.is_configured():
            return

        source_id = document.open_notebook_source_id
        if source_id:
            self.client.delete_source(source_id)

    def _get_or_create_session_id(self, notebook: KnowledgeNotebook) -> str:
        if notebook.chat_session_id:
            return notebook.chat_session_id

        session = self.client.create_chat_session(
            notebook_id=notebook.notebook_id, title="CRM Ask"
        )
        session_id = session.get("id")
        if not session_id:
            raise OpenNotebookError("Open Notebook не вернул id сессии чата.")

        notebook.chat_session_id = session_id
        notebook.save(update_fields=["chat_session_id", "updated_at"])
        return session_id

    def _reset_session_id(self, notebook: KnowledgeNotebook) -> str:
        session = self.client.create_chat_session(
            notebook_id=notebook.notebook_id, title="CRM Ask"
        )
        session_id = session.get("id")
        if not session_id:
            raise OpenNotebookError("Open Notebook не вернул id сессии чата.")

        notebook.chat_session_id = session_id
        notebook.save(update_fields=["chat_session_id", "updated_at"])
        return session_id

    def ask(self, insurance_type_id: str, question: str) -> dict:
        if not self.is_configured():
            raise OpenNotebookError("Open Notebook не настроен.")

        documents = KnowledgeDocument.objects.filter(
            insurance_type_id=insurance_type_id,
            open_notebook_source_id__isnull=False,
        ).exclude(open_notebook_source_id="")
        if not documents.exists():
            raise OpenNotebookError("Нет синхронизированных документов для вопроса.")

        insurance_type = documents.first().insurance_type
        if not insurance_type:
            raise OpenNotebookError("Вид страхования не найден.")

        notebook = self.ensure_notebook(insurance_type)
        session_id = self._get_or_create_session_id(notebook)

        context_config = {
            "sources": {
                doc.open_notebook_source_id: settings.OPEN_NOTEBOOK_CONTEXT_LEVEL
                for doc in documents
                if doc.open_notebook_source_id
            },
            "notes": {},
        }
        context_response = self.client.build_context(
            notebook_id=notebook.notebook_id, context_config=context_config
        )
        context = context_response.get("context")
        if not context:
            raise OpenNotebookError("Open Notebook не вернул контекст.")

        try:
            chat_response = self.client.execute_chat(
                session_id=session_id, message=question, context=context
            )
        except OpenNotebookError:
            session_id = self._reset_session_id(notebook)
            chat_response = self.client.execute_chat(
                session_id=session_id, message=question, context=context
            )
        messages = chat_response.get("messages") or []
        for message in reversed(messages):
            if message.get("type") == "ai":
                content = message.get("content", "")
                return {
                    "answer": content,
                    "citations": self._collect_citations(content, documents),
                }
        raise OpenNotebookError("Open Notebook не вернул ответ.")

    @staticmethod
    def _collect_citations(content: str, documents) -> list[dict]:
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

        doc_by_source = {
            doc.open_notebook_source_id: doc
            for doc in documents
            if doc.open_notebook_source_id
        }

        citations = []
        for source_id in ordered_ids:
            doc = doc_by_source.get(source_id)
            if not doc:
                continue
            citations.append(
                {
                    "source_id": source_id,
                    "document_id": str(doc.id),
                    "title": doc.title,
                    "file_url": doc.file.url if doc.file else None,
                }
            )
        return citations

    @staticmethod
    def _resolve_file_path(document: KnowledgeDocument) -> str:
        if not document.file:
            raise OpenNotebookError("Файл документа отсутствует.")

        media_root = Path(settings.MEDIA_ROOT)
        target_root = Path(settings.OPEN_NOTEBOOK_MEDIA_ROOT)
        try:
            relative = Path(document.file.path).relative_to(media_root)
        except ValueError:
            return document.file.path
        return str(target_root / relative)
