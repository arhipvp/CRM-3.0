"""Pure financial initialization for a newly imported policy, never for edits."""

from ..finance_rules import prepare_new_policy_finances


def prepare_import_finances(data):
    data = data.copy()
    deal = data["deal"]
    counterparty = (data.get("counterparty") or "").strip()
    client = deal.client
    if not counterparty and client:
        if client.is_counterparty:
            counterparty = client.name.strip()
        elif client.referred_by and client.referred_by.deleted_at is None:
            counterparty = client.referred_by.name.strip()
    data["counterparty"] = counterparty
    return prepare_new_policy_finances(data, fill_premium_defaults=True)
