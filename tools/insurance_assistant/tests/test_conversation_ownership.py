import sqlite3

from app.database import Store


def test_conversations_and_usage_are_isolated_by_owner(tmp_path):
    store = Store(tmp_path / "assistant.sqlite3")
    first = store.create_conversation("Первый", owner_id="1")
    second = store.create_conversation("Второй", owner_id="2")
    store.add_message(
        first["id"], "assistant", "Ответ", provider="polza", cost_rub=1.25
    )
    store.add_message(
        second["id"], "assistant", "Ответ", provider="polza", cost_rub=2.5
    )

    assert [item["id"] for item in store.conversations("1")] == [first["id"]]
    assert store.messages(second["id"], "1") == []
    assert store.usage("1")["cost_rub"] == 1.25
    assert not store.delete_conversation(second["id"], "1")
    assert len(store.messages(second["id"], "2")) == 1


def test_existing_conversation_database_gets_ai_settings_columns(tmp_path):
    path = tmp_path / "assistant.sqlite3"
    with sqlite3.connect(path) as con:
        con.execute(
            """CREATE TABLE conversations (
            id TEXT PRIMARY KEY, title TEXT NOT NULL, created_at TEXT NOT NULL, owner_id TEXT
            )"""
        )
        con.execute(
            "INSERT INTO conversations VALUES ('chat', 'Старый чат', '2026-01-01T00:00:00Z', '1')"
        )

    store = Store(path)
    chat = store.conversation("chat", "1")
    assert chat is not None
    assert chat["provider"] is None
    assert chat["model"] is None
    assert chat["scope"] == []


def test_conversation_scope_is_saved_per_owner(tmp_path):
    store = Store(tmp_path / "assistant.sqlite3")
    first = store.create_conversation("Первый", owner_id="1")
    second = store.create_conversation("Второй", owner_id="2")
    scope = [{"insurer": "РЕСО", "insurance_kind": "КАСКО"}]

    updated = store.update_conversation_settings(first["id"], "1", scope=scope)

    assert updated is not None
    assert updated["scope"] == scope
    assert store.conversation(second["id"], "2")["scope"] == []
    assert store.update_conversation_settings(first["id"], "2", scope=[]) is None
