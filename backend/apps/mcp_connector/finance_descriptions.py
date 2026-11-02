"""Business meaning published to MCP clients; these strings grant no permissions."""

PREMIUM_MEANING = (
    "A Payment is one insurance-premium installment in RUB, not agent income. "
    "Its actual_date alone determines whether the premium is paid. "
    "paid_balance is the signed sum of dated commission/cost records, not the "
    "premium paid amount, amount outstanding, or premium payment status. "
    "Never add income equal to the premium merely to mark the premium paid."
)
RECORD_MEANING = (
    "FinancialRecord represents agent commission/income or costs/expenses linked "
    "to a premium Payment. Its date means settlement of this commission or cost; "
    "null means unsettled. It does not mark the insurance premium paid. "
    "Returned amounts are signed RUB: income positive, expense negative; "
    "record_type is returned as the display label."
)
STATEMENT_MEANING = (
    "A Statement groups agent commission records or expense records, not premium "
    "payments. paid_at determines settlement; status is a legacy read-only value. "
    "total_amount is the signed sum of its active records, including undated "
    "records, not premium turnover."
)


FINANCE_TOOL_DESCRIPTIONS: dict[str, str] = {
    "crm_list_payments": (
        "Find insurance-premium installments by deal/policy and paid status. "
        "paid=true selects actual_date present; paid=false selects actual_date "
        "absent. Set include_financial_records to read related commission/cost "
        "entries. " + PREMIUM_MEANING
    ),
    "crm_get_payments": (
        "Read one insurance-premium installment by Payment ID, including its "
        "related financial records. " + PREMIUM_MEANING
    ),
    "crm_create_payments": (
        "Create a premium installment for an existing policy. amount is the "
        "premium installment; actual_date records confirmed premium payment. "
        "Optional incomes/expenses create separate agent financial entries on "
        "creation; this tool does not generate 1 RUB import placeholders. "
        + PREMIUM_MEANING
    ),
    "crm_update_payments": (
        "Change an existing premium installment. To mark the premium paid, set "
        "actual_date to the confirmed payment date; do not create a financial "
        "income entry. incomes/expenses/initial_record are creation inputs, not "
        "a supported way to edit existing financial records. " + PREMIUM_MEANING
    ),
    "crm_delete_payments": (
        "Soft-delete an unpaid premium installment and its financial records. "
        "Deletion is rejected if actual_date is set or any financial record "
        "has a settlement date. " + PREMIUM_MEANING
    ),
    "crm_list_financial_records": (
        "Find agent commission/income and expense records. paid_only/unpaid_only "
        "refer to the financial record date; payment_paid refers separately to "
        "premium actual_date. payment_paid_balance is a signed commission/cost "
        "balance, not premium paid amount. " + RECORD_MEANING
    ),
    "crm_get_financial_records": (
        "Read one agent commission or expense record by FinancialRecord ID. "
        "payment_amount and payment_actual_date describe the linked premium; "
        "amount and date describe this financial record. " + RECORD_MEANING
    ),
    "crm_create_financial_records": (
        "Create an agent financial record for an existing premium Payment. "
        "In this tool use positive amount for income and negative amount for "
        "expense; zero is allowed. Set date only when that commission or cost "
        "was actually settled. " + RECORD_MEANING
    ),
    "crm_update_financial_records": (
        "Edit an existing agent financial record. Its existing income/expense "
        "type is preserved, and the server normalizes amount to that type: "
        "changing the amount sign alone does not change the record type. "
        "Records in a paid statement cannot be edited. " + RECORD_MEANING
    ),
    "crm_delete_financial_records": (
        "Soft-delete an undated agent financial record. A record in any "
        "statement must first be removed from that statement; a dated record "
        "cannot be deleted until its settlement date is cleared. " + RECORD_MEANING
    ),
    "crm_financial_records_summary": (
        "Read totals and counts for filtered agent financial records. "
        "income_total/expense_total include unsettled records as selected by "
        "the filters; payments_paid_balance_total is the signed balance of "
        "dated records for distinct linked payments, not premium receipts. "
        + RECORD_MEANING
    ),
    "crm_export_financial_records": (
        "Request the existing XLSX export of filtered agent financial records; "
        "the export may return a job ID to poll with crm_get_job. "
        "This exports commission/cost data, not a premium-payment receipt. "
        + RECORD_MEANING
    ),
    "crm_finance_summary": (
        "Read the connected user's finance overview: incomes_total and "
        "expenses_total are agent financial records including undated entries; "
        "expenses_total is an absolute cost total and net_total is their "
        "difference. planned_payments are up to five unpaid premium "
        "installments with actual_date absent. " + PREMIUM_MEANING
    ),
    "crm_list_statements": (
        "Find agent income/expense statements. paid=true filters by paid_at "
        "present, not by premium actual_date. " + STATEMENT_MEANING
    ),
    "crm_get_statements": (
        "Read one agent income/expense statement by Statement ID, including "
        "record count and signed total. " + STATEMENT_MEANING
    ),
    "crm_create_statements": (
        "Create an income or expense statement and optionally attach existing "
        "FinancialRecord IDs of that type. Setting paid_at also sets the "
        "settlement date of attached records; omit it for a draft. " + STATEMENT_MEANING
    ),
    "crm_update_statements": (
        "Edit an unpaid income/expense statement. record_ids attaches existing "
        "matching-type records; it does not replace the current membership. "
        "Setting paid_at settles every active included record on that date. "
        "A paid statement cannot be edited. " + STATEMENT_MEANING
    ),
    "crm_delete_statements": (
        "Soft-delete an unpaid statement, detaching and preserving its "
        "financial records and saving a membership snapshot for restoration. "
        "Paid statements cannot be deleted. " + STATEMENT_MEANING
    ),
    "crm_statement_attach_records": (
        "Attach existing FinancialRecord IDs to an unpaid statement. Every "
        "record must match the statement income/expense type and must not "
        "belong to another statement. This does not settle the records or pay "
        "the insurance premium. " + STATEMENT_MEANING
    ),
    "crm_statement_remove_records": (
        "Detach the specified FinancialRecord IDs from an unpaid statement "
        "without deleting the records or changing their settlement dates. "
        + STATEMENT_MEANING
    ),
    "crm_statement_apply_amount": (
        "Set amounts for records in an unpaid statement. mode=rub uses the "
        "absolute RUB value for each record. mode=percent uses a percentage of "
        "abs(payment_paid_balance), the linked payment's settled commission/cost "
        "balance, NOT its insurance premium; zero-balance records are skipped. "
        "Amounts are rounded to kopecks and retain each record's income/expense "
        "sign. It neither marks the records settled nor pays the premium."
    ),
    "crm_statement_mark_paid": (
        "Set an unpaid statement's paid_at to the explicitly supplied settlement "
        "date and set date on every active included financial record to that "
        "same date, including overwriting prior record dates. This settles "
        "agent commissions/costs and recalculates their balances; it does not "
        "change premium actual_date. A missing/null paid_at is rejected."
    ),
    "crm_statement_restore": (
        "Restore a deleted unpaid statement, optionally renaming it to a "
        "unique active name. Restore former membership only for eligible "
        "accessible, undated, unassigned, matching-type records; inspect the "
        "returned restored/skipped report. " + STATEMENT_MEANING
    ),
    "crm_statement_reopen": (
        "As a CRM administrator, reopen a paid statement: clear paid_at and "
        "clear date on all its financial records. This reverses commission/cost "
        "settlement and recalculates balances; premium actual_date is unchanged."
    ),
    "crm_statement_export": (
        "Request the existing XLSX export of one statement; it can create an "
        "external job and save the generated workbook to Drive. Poll any "
        "returned job ID with crm_get_job. " + STATEMENT_MEANING
    ),
    "crm_statement_lookup": (
        "Find lightweight statement references (id, name, statement_type, "
        "paid_at), at most page_size rows. Use returned Statement IDs to read "
        "or attach agent financial records. " + STATEMENT_MEANING
    ),
    "crm_create_policy_draft": (
        "Create a new policy, premium installments, separate agent "
        "commission/expense records and original-document moves in one "
        "preview/apply. Missing/empty incomes creates one unsettled 1 RUB "
        "commission; missing/empty expenses creates unsettled 1 RUB entries "
        "for the counterparty and executor when present. Nonempty lists and "
        "explicit zero amounts are preserved. actual_date pays only the "
        "premium, never commissions/costs; paid_balance is not premium paid "
        "status. For document imports always pass data.source_file_ids: "
        "originals move, not copy. files_pending means saved policy with "
        "incomplete transfer: retry identical apply body and request_id, "
        "never create a second policy."
    ),
    "crm_update_policy_draft": (
        "Edit an existing policy and replace its payment/financial-record "
        "graph, not append to it. Include every payment and financial record "
        "to retain, using their existing IDs; omitted entries may be deleted. "
        "Omitted/empty payments removes existing payments subject to payment "
        "and statement safeguards; omitted/empty incomes/expenses removes "
        "existing financial entries. No 1 RUB defaults are added on editing. "
        "Payment actual_date pays only the premium; record date settles "
        "commission/costs separately. Use crm_update_payments or "
        "crm_update_financial_records for isolated field changes."
    ),
    "crm_recognize_policy": (
        "Run CRM AI recognition on explicitly requested existing deal "
        "documents to extract policy data. Recognition does not save a "
        "policy, premium payment or commission/cost record and does not move "
        "documents. Check extracted fields against the source. Pass returned "
        "fileId values to crm_create_policy_draft as data.source_file_ids "
        "to create the policy with original-document moves. A policy premium "
        "is not agent commission; a payment deadline is not evidence of "
        "actual payment."
    ),
}


_RECORD_FIELDS = {
    "date": (
        "Actual settlement date of this agent commission or expense, YYYY-MM-DD. "
        "null means unsettled. On creation an omitted date is also unsettled; "
        "an ordinary partial update preserves an omitted date. Independent of the insurance "
        "premium Payment.actual_date; never copy that date automatically."
    ),
    "description": (
        "Short description of this commission/cost operation, not the policy "
        "number, premium amount, settlement date, or payment-status flag."
    ),
    "source": (
        "Free-text source of agent income or purpose of agent expense; not a "
        "CRM object ID, document ID, or URL."
    ),
    "note": (
        "Free-text comment on this commission/expense, for example the "
        "commission channel or expense recipient. Does not mark it settled."
    ),
}
_POLICY_FIELDS = {
    "number": (
        "Policy number as printed in the insurance document, not a CRM UUID. "
        "Must be unique among active policies; editing may retain this policy's own number."
    ),
    "deal": (
        "ID of the CRM deal that owns this policy; obtain it from "
        "crm_list_deals/crm_get_deals. Not the client ID or policy number."
    ),
    "client": (
        "ID of the policyholder in the CRM client catalog, not their name. "
        "Use this field for the current policyholder; insured_client is legacy."
    ),
    "insurance_company": (
        "Insurer ID from crm_list_insurance_companies, not its display name."
    ),
    "insurance_type": (
        "Insurance-type ID from crm_list_insurance_types, not its display name."
    ),
    "insurance_request": (
        "ID of a related CRM insurance request belonging to this deal, when "
        "linking the policy to an existing request. Not the insurer's number."
    ),
    "mortgage_bank": (
        "Bank ID from crm_list_banks. Required for a mortgage insurance type; "
        "not the borrower, loan agreement number, or bank name."
    ),
    "loan_agreement_number": (
        "Credit/loan agreement number printed in the mortgage documents. "
        "Required for a mortgage insurance type; not the insurance policy number."
    ),
    "sales_channel": (
        "Sales-channel ID from crm_list_sales_channels, not free text. "
        "Determines the channel named in a new import's commission template."
    ),
    "start_date": "Insurance coverage start date, YYYY-MM-DD; not a payment date.",
    "end_date": (
        "Insurance coverage end date, YYYY-MM-DD; must not precede start_date. "
        "Not a premium or commission payment deadline."
    ),
    "deductible": (
        "Insurance deductible/franchise in RUB as a decimal string such as "
        "10000.00. Not the premium, sum insured, agent commission, or expense."
    ),
    "counterparty": (
        "Free-text name of the policy's counterparty/referrer, not a client "
        "ID, insurer ID, sales-channel ID, or commission amount."
    ),
    "note": "Free-text note on the policy; not evidence of premium payment.",
}


FINANCE_FIELD_DESCRIPTIONS: dict[str, dict[str, str]] = {
    "PaymentSerializer": {
        "policy": (
            "ID of the existing CRM policy for this premium installment; "
            "required by business validation. Obtain it from crm_get_policies "
            "or a policy-creation result, not the printed policy number."
        ),
        "deal": (
            "ID of the policy's deal. The server derives it from policy; "
            "if supplied it must match that policy's deal."
        ),
        "amount": (
            "Insurance-premium installment in RUB as a positive decimal string, "
            "for example 51500.00. Not the agent's commission/income or expense."
        ),
        "scheduled_date": (
            "Planned due date of this insurance-premium installment, YYYY-MM-DD. "
            "A due date does not prove actual payment."
        ),
        "actual_date": (
            "Confirmed actual payment date of this insurance-premium installment, "
            "YYYY-MM-DD. A non-null value alone marks the premium paid; null "
            "means unpaid. It does not settle commission or expenses."
        ),
        "description": "Short description of this insurance-premium installment.",
        "paid_balance": (
            "Server-maintained signed sum of active dated commission/expense "
            "records in RUB. Not premium paid amount, premium debt, or premium "
            "paid status; do not set this derived field."
        ),
        "initial_record": (
            "On creation only, optionally create one separate agent financial "
            "record linked to this installment. Not needed to mark premium paid."
        ),
        "incomes": (
            "On creation only, separate agent commission/income entries, using "
            "nonnegative RUB amounts. Not insurance premium receipts. Omitted "
            "or empty creates no entries in this tool; 1 RUB defaults apply "
            "only to crm_create_policy_draft."
        ),
        "expenses": (
            "On creation only, separate agent cost entries, using nonnegative "
            "RUB magnitudes; stored expense amounts are negative. Omitted/empty "
            "creates no entries here. Do not include record_type in list entries."
        ),
        "policy_end_date": (
            "On creation only, optionally extend the linked policy's coverage "
            "end date, YYYY-MM-DD. Cannot shorten the existing coverage period."
        ),
    },
    "InitialFinancialRecordSerializer": {
        **_RECORD_FIELDS,
        "amount": (
            "Agent commission/cost amount in RUB as a decimal string, not the "
            "insurance premium. For incomes/expenses lists use nonnegative "
            "magnitudes; the list identifies the type. For initial_record "
            "specify record_type or use positive income/negative expense."
        ),
        "record_type": (
            "For initial_record only: income means agent commission; expense "
            "means agent cost. Do not repeat this field inside incomes/expenses "
            "lists, where the containing list supplies the type."
        ),
    },
    "PolicyDraftFinancialRecordSerializer": {
        **_RECORD_FIELDS,
        "id": (
            "Existing FinancialRecord UUID within this payment, only when "
            "editing a policy graph. Omit for a new record; new policy imports "
            "must not reuse existing financial IDs."
        ),
        "amount": (
            "Agent commission/cost magnitude in RUB as a decimal string, "
            "for example 1500.00; zero is allowed. The containing incomes or "
            "expenses list determines the stored sign. Not premium amount. "
            "An explicitly supplied zero is preserved, not replaced by 1 RUB."
        ),
    },
    "PolicyDraftPaymentSerializer": {
        "id": (
            "Existing Payment UUID, only when retaining/editing this installment "
            "in crm_update_policy_draft. Omit for new installments."
        ),
        "amount": (
            "Insurance-premium installment in RUB as a positive decimal string, "
            "for example 51500.00. Not agent commission or expense."
        ),
        "description": "Short description of this insurance-premium installment.",
        "scheduled_date": (
            "Planned premium due date, YYYY-MM-DD; not proof of actual payment."
        ),
        "actual_date": (
            "Confirmed premium payment date, YYYY-MM-DD; a non-null value "
            "alone marks this premium installment paid. Omit/null if unpaid. "
            "Does not settle the nested commission or expense records."
        ),
        "incomes": (
            "Separate agent commission/income records for this installment, "
            "not premium receipts. On NEW policy import missing/empty creates "
            "one unsettled 1 RUB commission template. A nonempty list is "
            "preserved. On EDIT include all income records to keep; "
            "missing/empty removes existing ones subject to safeguards."
        ),
        "expenses": (
            "Separate agent costs for this installment. On NEW policy import "
            "missing/empty creates unsettled 1 RUB templates for the counterparty "
            "and deal executor when present. A nonempty list is preserved. "
            "On EDIT include all expenses to keep; missing/empty removes "
            "existing ones subject to safeguards."
        ),
    },
    "PolicyDraftSerializer": {
        **_POLICY_FIELDS,
        "client": (
            "Existing policyholder Client ID. On policy draft creation, omitted "
            "or null uses client_name when provided, otherwise the deal client. "
            "Prefer an existing ID to avoid creating or selecting the wrong client."
        ),
        "client_name": (
            "Policyholder name used only when client ID is absent: reuse a "
            "matching client or create one if no match exists. Prefer a verified "
            "client ID. This is not the counterparty/referrer name."
        ),
        "counterparty": (
            "Free-text counterparty/referrer name, not an ID. On NEW MCP import "
            "blank/omitted defaults to the deal client if it is a counterparty, "
            "otherwise that client's active undeleted referrer. Determines one "
            "possible 1 RUB expense template; not the policyholder or executor."
        ),
        "payments": (
            "Insurance-premium installments with separate nested commission/cost "
            "records. On CREATE omit existing IDs. On EDIT this replaces the "
            "payment graph: include every installment and nested record to keep, "
            "with existing IDs; omitted entries may be deleted. Missing/empty "
            "payments is not a no-op."
        ),
        "source_file_ids": (
            "Original deal document IDs, only for crm_create_policy_draft: "
            "MCP d_ IDs or raw Drive fileId values returned by recognition. "
            "Always pass them for document imports. The same files move into "
            "the new policy folder preserving their Drive IDs; no copies. "
            "Do not send this field in generic writes or draft updates."
        ),
    },
    "FinancialRecordSerializer": {
        **_RECORD_FIELDS,
        "payment": (
            "ID of the existing premium Payment this commission/cost belongs "
            "to, from crm_list_payments/crm_get_payments. Not policy ID, deal ID, "
            "statement ID, or a payment amount."
        ),
        "amount": (
            "Agent financial amount in RUB as a decimal string, not premium. "
            "On CREATE use positive income/negative expense; zero is allowed. "
            "On UPDATE the existing income/expense type is retained and sign "
            "normalized; changing sign alone does not switch the type."
        ),
        "record_type": (
            "Read-only display label of the agent operation: income or expense. "
            "The current generic MCP write schema does not accept this field."
        ),
        "statement": (
            "Read-only ID of the agent income/expense statement. Change "
            "membership with crm_statement_attach_records/remove_records."
        ),
        "payment_amount": "Read-only premium installment amount, not this commission/cost.",
        "payment_actual_date": (
            "Read-only premium payment date. Independent of this financial "
            "record's settlement date."
        ),
        "payment_paid_balance": (
            "Read-only signed sum of dated financial records for the linked "
            "Payment. Not premium paid amount or remaining premium debt."
        ),
    },
    "StatementSerializer": {
        "name": (
            "Statement name, unique among active statements after whitespace "
            "normalization and case folding."
        ),
        "statement_type": (
            "income groups agent commission/income records; expense groups "
            "agent costs. Not a premium-payment type."
        ),
        "counterparty": (
            "Free-text counterparty name for the agent statement, not a CRM "
            "client ID, insurer ID, or financial record ID."
        ),
        "record_ids": (
            "Existing FinancialRecord UUIDs to attach, not Payment UUIDs. "
            "Records must match statement_type and must not belong to another "
            "statement. This adds membership, not replaces it; remove records "
            "with crm_statement_remove_records."
        ),
        "paid_at": (
            "Agent statement settlement date, YYYY-MM-DD. A non-null date "
            "marks the statement paid and sets date on every active included "
            "financial record to that date. Omit/null for an unpaid draft. "
            "Does not change any premium Payment.actual_date."
        ),
        "status": (
            "Legacy read-only status, derived from paid_at. Use paid_at rather "
            "than writing status to settle a statement."
        ),
        "comment": "Free-text statement comment; does not settle any operation.",
        "total_amount": (
            "Read-only signed total of active included financial records, "
            "including unsettled entries; not premium turnover."
        ),
    },
    "StatementApplyAmountSerializer": {
        "mode": (
            "rub sets an absolute RUB amount on each statement record; percent "
            "uses a percentage of abs(linked Payment.paid_balance), the settled "
            "commission/cost balance. It is NOT a percentage of premium amount."
        ),
        "value": (
            "Absolute amount for mode=rub, or percentage points for mode=percent "
            "(10 means 10%, not 0.10). Server uses abs(value), rounds resulting "
            "amounts to kopecks, preserves income/expense type, and skips "
            "zero-balance records in percent mode. The percentage base is "
            "abs(payment_paid_balance), NOT the insurance premium amount."
        ),
    },
    "StatementMarkPaidSerializer": {
        "paid_at": (
            "Required by business validation: actual settlement date of this "
            "agent statement, YYYY-MM-DD. Sets the same date on all active "
            "included commission/cost records. Missing/null is rejected; "
            "do not infer today's date without the user's instruction. "
            "Does not mark insurance premiums paid."
        ),
    },
    "StatementRestoreSerializer": {
        "name": (
            "Optional replacement name for the restored statement, unique among "
            "active statements. Omit to reuse its former name if available."
        ),
    },
    "PolicySerializer": {
        **_POLICY_FIELDS,
        "insured_client": (
            "Legacy policyholder Client ID for backward compatibility. "
            "Use client as the current policyholder field in new operations."
        ),
        "payments_total": (
            "Read-only sum of insurance-premium installments for this policy, "
            "not agent commission or expenses."
        ),
        "payments_paid": (
            "Read-only sum of premium installments with actual_date set, "
            "not the sum of commission/expense records."
        ),
    },
}
