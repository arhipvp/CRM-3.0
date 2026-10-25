"""Pure financial initialization for a newly imported policy, never for edits."""

from decimal import Decimal


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
    channel = data.get("sales_channel")
    income_note = "Комиссионное вознаграждение"
    if channel and channel.name.strip():
        income_note += f" от {channel.name.strip()}"
    expense_notes = []
    if counterparty:
        expense_notes.append(f"Расход контрагенту {counterparty}")
    if deal.executor:
        name = (deal.executor.get_full_name() or deal.executor.username).strip()
        expense_notes.append(f"Расход исполнителю {name}")

    def record(note):
        return {
            "amount": Decimal("1.00"),
            "date": None,
            "description": "",
            "source": "",
            "note": note,
        }

    data["payments"] = [
        {
            **payment,
            "incomes": payment.get("incomes") or [record(income_note)],
            "expenses": payment.get("expenses")
            or [record(note) for note in expense_notes],
        }
        for payment in data.get("payments", [])
    ]
    return data
