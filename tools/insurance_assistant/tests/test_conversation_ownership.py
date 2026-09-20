from app.database import Store


def test_conversations_and_usage_are_isolated_by_owner(tmp_path):
    store = Store(tmp_path / "assistant.sqlite3")
    first = store.create_conversation("Первый", owner_id="1")
    second = store.create_conversation("Второй", owner_id="2")
    store.add_message(first["id"], "assistant", "Ответ", provider="polza", cost_rub=1.25)
    store.add_message(second["id"], "assistant", "Ответ", provider="polza", cost_rub=2.5)

    assert [item["id"] for item in store.conversations("1")] == [first["id"]]
    assert store.messages(second["id"], "1") == []
    assert store.usage("1")["cost_rub"] == 1.25
    assert not store.delete_conversation(second["id"], "1")
    assert len(store.messages(second["id"], "2")) == 1
