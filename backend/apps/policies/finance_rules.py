"""Small, side-effect-free rules for policy financial initialization."""

from decimal import Decimal

EXTERNAL_POLICY_CHANNEL = "чужой полис"
PKV_CHANNEL = "гриша. сбер"
PKV_INCOME_NOTE = "Доход от Гриша. Сбер. ПКВ"


def normalized_name(value):
    return (getattr(value, "name", value) or "").strip().casefold()


def skips_financial_defaults(channel):
    return normalized_name(channel) == EXTERNAL_POLICY_CHANNEL


def allows_pkv(channel, insurance_type):
    return (
        normalized_name(channel) == PKV_CHANNEL
        and normalized_name(insurance_type) == "осаго"
    )


def payment_errors(*, kind, amount, actual_date, channel, insurance_type, new_pkv):
    errors = {}
    if kind == "pkv":
        if amount != Decimal("0"):
            errors["amount"] = "Сумма платежа ПКВ должна быть равна нулю."
        if actual_date is not None:
            errors["actual_date"] = "Оплата премии не применяется к платежу ПКВ."
        if new_pkv and not allows_pkv(channel, insurance_type):
            errors["kind"] = "ПКВ доступно только для источника «Гриша. Сбер» и ОСАГО."
    elif kind != "premium":
        errors["kind"] = "Неизвестный вид платежа."
    elif amount is not None and amount <= 0:
        errors["amount"] = "Amount must be greater than zero."
    return errors


def record_draft(note, amount=Decimal("1.00")):
    return {
        "amount": amount,
        "date": None,
        "description": "",
        "source": "",
        "note": note,
    }


def prepare_new_policy_finances(data, *, fill_premium_defaults=False):
    """Initialize a new graph without changing explicitly supplied records."""
    data = data.copy()
    payments = [payment.copy() for payment in data.get("payments", [])]
    channel = data.get("sales_channel")
    deal = data["deal"]
    executor = deal.executor
    executor_name = (
        (executor.get_full_name() or executor.username).strip() if executor else ""
    )
    eligible = allows_pkv(channel, data.get("insurance_type"))
    for payment in payments:
        if payment.get("kind", "premium") == "pkv":
            if fill_premium_defaults and eligible:
                payment["incomes"] = payment.get("incomes") or [
                    record_draft(PKV_INCOME_NOTE)
                ]
                payment["expenses"] = payment.get("expenses") or (
                    [record_draft(f"Расход исполнителю {executor_name} от ПКВ")]
                    if executor_name
                    else []
                )
            continue
        if not fill_premium_defaults or skips_financial_defaults(channel):
            continue
        income_note = "Комиссионное вознаграждение"
        if channel and channel.name.strip():
            income_note += f" от {channel.name.strip()}"
        expense_notes = []
        if data.get("counterparty"):
            expense_notes.append(f"Расход контрагенту {data['counterparty']}")
        if executor_name:
            expense_notes.append(f"Расход исполнителю {executor_name}")
        payment["incomes"] = payment.get("incomes") or [record_draft(income_note)]
        payment["expenses"] = payment.get("expenses") or [
            record_draft(note) for note in expense_notes
        ]
    if (
        eligible
        and payments
        and not any(payment.get("kind") == "pkv" for payment in payments)
    ):
        primary = next(
            (
                payment
                for payment in payments
                if payment.get("kind", "premium") == "premium"
            ),
            None,
        )
        if primary is not None:
            payments.append(
                {
                    "kind": "pkv",
                    "amount": Decimal("0.00"),
                    "description": "ПКВ",
                    "scheduled_date": primary.get("scheduled_date"),
                    "actual_date": None,
                    "incomes": [
                        record_draft(
                            PKV_INCOME_NOTE,
                            (
                                Decimal("1.00")
                                if fill_premium_defaults
                                else Decimal("0.00")
                            ),
                        )
                    ],
                    "expenses": (
                        [record_draft(f"Расход исполнителю {executor_name} от ПКВ")]
                        if executor_name
                        else []
                    ),
                }
            )
    data["payments"] = payments
    return data
