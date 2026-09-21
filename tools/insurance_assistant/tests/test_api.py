from dataclasses import replace

from app.main import app
from app.rag import Citation
from fastapi.testclient import TestClient


class FakeRag:
    def healthy(self):
        return True

    def search(self, question, **kwargs):
        return []


def test_health_is_local():
    client = TestClient(app)
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json()["bind"] == "127.0.0.1"


def test_question_without_sources_does_not_hallucinate(monkeypatch):
    import app.main as main

    monkeypatch.setattr(main, "rag", FakeRag())
    client = TestClient(app)
    conversation = client.post("/api/conversations", json={"title": "Проверка"}).json()
    response = client.post(
        f"/api/conversations/{conversation['id']}/messages",
        json={"content": "Что покрывает полис?"},
    )
    assert response.status_code == 200
    assert "нет подтверждения" in response.text


def test_question_with_sources_streams_stubbed_codex_answer(monkeypatch):
    import app.main as main

    class SearchRag(FakeRag):
        def search(self, question, **kwargs):
            return [
                Citation(
                    "doc-1", "rules.pdf", {"page": 2}, "Подтверждённое условие.", 0.9
                )
            ]

    class FakeCodex:
        async def answer(self, prompt, model=None):
            assert "rules.pdf, страница 2" in prompt
            yield "Условие подтверждено [1]."

    monkeypatch.setattr(main, "rag", SearchRag())
    monkeypatch.setattr(main, "codex", FakeCodex())
    client = TestClient(app)
    conversation = client.post(
        "/api/conversations", json={"title": "Проверка источника"}
    ).json()
    response = client.post(
        f"/api/conversations/{conversation['id']}/messages",
        json={"content": "Есть ли условие?"},
    )
    assert response.status_code == 200
    assert "event: sources" in response.text
    assert "Условие подтверждено [1]." in response.text


def test_provider_catalog_is_public_without_exposing_key(monkeypatch):
    import app.main as main

    async def models():
        return ["polza-chat"]

    monkeypatch.setattr(main.polza, "models", models)
    payload = TestClient(app).get("/api/providers").json()
    polza = next(item for item in payload["providers"] if item["id"] == "polza")
    assert polza["models"] == ["polza-chat"]
    assert "key" not in str(payload).lower()


def test_usage_endpoint_returns_local_aggregate():
    payload = TestClient(app).get("/api/usage").json()
    assert set(payload) == {"providers", "requests", "cost_rub"}


def test_document_content_requires_internal_access_and_hides_storage_path(
    monkeypatch, tmp_path
):
    import app.main as main
    from app.database import Store

    source = tmp_path / "rules.pdf"
    source.write_bytes(b"%PDF-test")
    store = Store(tmp_path / "assistant.sqlite3")
    document_id = store.create_document("rules.pdf", source)
    monkeypatch.setattr(main, "store", store)

    response = TestClient(app).get(f"/api/documents/{document_id}/content")
    assert response.status_code == 200
    assert response.content == b"%PDF-test"
    assert "inline" in response.headers["content-disposition"]
    assert str(tmp_path) not in str(response.headers)

    missing = TestClient(app).get("/api/documents/missing/content")
    assert missing.status_code == 404


def test_conversation_model_is_saved_and_used_for_next_answer(monkeypatch, tmp_path):
    import app.main as main
    from app.database import Store

    async def models():
        return ["polza-default", "polza-pro"]

    monkeypatch.setattr(main, "store", Store(tmp_path / "assistant.sqlite3"))
    monkeypatch.setattr(main, "rag", FakeRag())
    monkeypatch.setattr(
        main,
        "settings",
        replace(
            main.settings,
            production_mode=True,
            polza_api_key="test",  # pragma: allowlist secret
            polza_chat_model="polza-default",
        ),
    )
    monkeypatch.setattr(main.polza, "models", models)
    client = TestClient(app)
    conversation = client.post("/api/conversations", json={"title": "Проверка"}).json()
    assert conversation["model"] is None

    updated = client.patch(
        f"/api/conversations/{conversation['id']}",
        json={"provider": "polza", "model": "polza-pro"},
    )
    assert updated.status_code == 200
    assert updated.json()["model"] == "polza-pro"

    response = client.post(
        f"/api/conversations/{conversation['id']}/messages",
        json={"content": "Что покрывает полис?"},
    )
    assert response.status_code == 200
    assert '"model": "polza-pro"' in response.text


def test_unavailable_conversation_model_is_rejected(monkeypatch, tmp_path):
    import app.main as main
    from app.database import Store

    async def models():
        return ["polza-default"]

    monkeypatch.setattr(main, "store", Store(tmp_path / "assistant.sqlite3"))
    monkeypatch.setattr(
        main,
        "settings",
        replace(
            main.settings, production_mode=True, polza_api_key="test"  # pragma: allowlist secret
        ),
    )
    monkeypatch.setattr(main.polza, "models", models)
    client = TestClient(app)
    conversation = client.post("/api/conversations", json={"title": "Проверка"}).json()
    response = client.patch(
        f"/api/conversations/{conversation['id']}",
        json={"provider": "polza", "model": "removed-model"},
    )
    assert response.status_code == 422
    assert "недоступна" in response.json()["detail"]


def test_message_uses_scope_saved_on_conversation(monkeypatch, tmp_path):
    import app.main as main
    from app.database import Store

    class CapturingRag(FakeRag):
        def search(self, question, **kwargs):
            self.document_ids = kwargs["document_ids"]
            return []

    store = Store(tmp_path / "assistant.sqlite3")
    reso_document = store.create_document(
        "rules.pdf",
        tmp_path / "rules.pdf",
        {"insurer": "РЕСО", "insurance_kind": "КАСКО", "product": "Авто"},
    )
    rag = CapturingRag()
    monkeypatch.setattr(main, "store", store)
    monkeypatch.setattr(main, "rag", rag)
    client = TestClient(app)
    conversation = client.post("/api/conversations", json={"title": "Проверка"}).json()
    updated = client.patch(
        f"/api/conversations/{conversation['id']}",
        json={"scope": [{"insurer": "РЕСО"}]},
    )
    assert updated.status_code == 200

    response = client.post(
        f"/api/conversations/{conversation['id']}/messages",
        json={"content": "Что покрывает полис?", "scope": [{"unclassified": True}]},
    )

    assert response.status_code == 200
    assert rag.document_ids == [reso_document]


def test_document_list_uses_safe_public_contract(monkeypatch, tmp_path):
    import app.main as main
    from app.database import Store

    store = Store(tmp_path / "assistant.sqlite3")
    document_id = store.create_document(
        "rules.pdf",
        tmp_path / "private" / "rules.pdf",
        {"insurer": "РЕСО", "insurance_kind": "КАСКО", "product": "Классика"},
    )
    store.update_document(document_id, "failed", error=str(tmp_path / "private"))
    monkeypatch.setattr(main, "store", store)

    response = TestClient(app).get("/api/documents")

    assert response.status_code == 200
    document = response.json()[0]
    assert document == {
        "id": document_id,
        "filename": "rules.pdf",
        "status": "failed",
        "chunks": 0,
        "error": "Не удалось обработать документ. Загрузите файл повторно.",
        "classification": {
            "insurer": "РЕСО",
            "insurance_kind": "КАСКО",
            "product": "Классика",
            "document_type": None,
            "effective_from": None,
            "effective_to": None,
        },
    }
    assert "path" not in document
    assert str(tmp_path) not in str(response.json())


def test_upload_returns_safe_public_document(monkeypatch, tmp_path):
    import app.main as main
    from app.database import Store

    monkeypatch.setattr(main, "store", Store(tmp_path / "assistant.sqlite3"))
    monkeypatch.setattr(main, "settings", replace(main.settings, data_dir=tmp_path))
    monkeypatch.setattr(main, "_index_document", lambda _document_id: None)

    response = TestClient(app).post(
        "/api/documents",
        data={
            "insurer": "РЕСО",
            "insurance_kind": "КАСКО",
            "product": "Классика",
        },
        files=[("files", ("rules.pdf", b"%PDF-test", "application/pdf"))],
    )

    assert response.status_code == 202
    document = response.json()[0]
    assert document["filename"] == "rules.pdf"
    assert document["status"] == "queued"
    # Uploads always start in the shared "Unclassified" folder.  Extra multipart
    # fields must not silently assign a branch.
    assert document["classification"]["product"] is None
    assert document["error"] is None
    assert "path" not in document


def test_classification_update_returns_safe_public_documents(monkeypatch, tmp_path):
    import app.main as main
    from app.database import Store

    class ClassificationRag(FakeRag):
        def update_document_classification(self, document_ids, classification):
            self.document_ids = document_ids
            self.classification = classification

    store = Store(tmp_path / "assistant.sqlite3")
    document_id = store.create_document("draft.pdf", tmp_path / "private" / "draft.pdf")
    rag = ClassificationRag()
    monkeypatch.setattr(main, "store", store)
    monkeypatch.setattr(main, "rag", rag)

    response = TestClient(app).patch(
        "/api/documents/classification",
        json={
            "document_ids": [document_id],
            "insurer": "РЕСО",
            "insurance_kind": "КАСКО",
            "product": "Классика",
            "document_type": "Правила",
        },
    )

    assert response.status_code == 200
    document = response.json()[0]
    assert document["classification"]["document_type"] == "Правила"
    assert "path" not in document
    assert str(tmp_path) not in str(response.json())
    assert rag.document_ids == [document_id]
