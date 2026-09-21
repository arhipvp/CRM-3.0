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


def test_document_content_requires_internal_access_and_hides_storage_path(monkeypatch, tmp_path):
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
        replace(main.settings, production_mode=True, polza_api_key="test"),  # pragma: allowlist secret
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
