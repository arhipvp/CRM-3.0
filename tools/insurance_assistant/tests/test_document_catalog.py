from app.database import Store


def test_catalog_builds_tree_and_keeps_unclassified_documents(tmp_path):
    store = Store(tmp_path / "assistant.sqlite3")
    classified = store.create_document(
        "rules.pdf",
        tmp_path / "rules.pdf",
        {
            "insurer": "РЕСО",
            "insurance_kind": "Имущество",
            "product": "Страхование квартир",
        },
    )
    unclassified = store.create_document("draft.pdf", tmp_path / "draft.pdf")

    catalog = store.catalog()

    assert catalog["unclassified"] == 1
    assert catalog["insurers"][0]["name"] == "РЕСО"
    assert catalog["insurers"][0]["kinds"][0]["products"][0]["name"] == "Страхование квартир"
    assert store.scoped_document_ids([{"unclassified": True}]) == [unclassified]
    assert store.scoped_document_ids(
        [{"insurer": "РЕСО", "insurance_kind": "Имущество"}]
    ) == [classified]


def test_move_updates_classification_without_changing_document_id(tmp_path):
    store = Store(tmp_path / "assistant.sqlite3")
    document_id = store.create_document("rules.pdf", tmp_path / "rules.pdf")

    result = store.update_document_classification(
        [document_id],
        {
            "insurer": "РЕСО",
            "insurance_kind": "КАСКО",
            "product": "Классика",
            "document_type": "Правила",
        },
    )

    assert result[0]["id"] == document_id
    assert result[0]["product"] == "Классика"
