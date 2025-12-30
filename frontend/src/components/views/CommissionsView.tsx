import React, { useCallback, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import type { FilterParams } from '../../api';
import type { Payment, Policy, Statement } from '../../types';
import type { AddFinancialRecordFormValues } from '../forms/AddFinancialRecordForm';
import { FilterBar } from '../FilterBar';
import { PanelMessage } from '../PanelMessage';
import { TableHeadCell } from '../common/TableHeadCell';
import { Modal } from '../Modal';
import {
  TABLE_CELL_CLASS_LG,
  TABLE_ROW_CLASS,
  TABLE_THEAD_CLASS,
} from '../common/tableStyles';
import { formatCurrencyRu, formatDateRu } from '../../utils/formatting';

type IncomeExpenseSortKey = 'recordDate' | 'payment' | 'record';

const INCOME_EXPENSE_SORT_OPTIONS = [
  { value: '-recordDate', label: 'Дата оплаты (новые)' },
  { value: 'recordDate', label: 'Дата оплаты (старые)' },
  { value: '-payment', label: 'Платеж (больше)' },
  { value: 'payment', label: 'Платеж (меньше)' },
  { value: '-record', label: 'Расход/доход (больше)' },
  { value: 'record', label: 'Расход/доход (меньше)' },
];

interface CommissionsViewProps {
  payments: Payment[];
  policies: Policy[];
  statements: Statement[];
  onDealSelect?: (dealId: string) => void;
  onRequestEditPolicy?: (policy: Policy) => void;
  onUpdateFinancialRecord?: (recordId: string, values: AddFinancialRecordFormValues) => Promise<void>;
  onCreateStatement?: (values: {
    name: string;
    statementType: Statement['statementType'];
    counterparty?: string;
    comment?: string;
    recordIds?: string[];
  }) => Promise<Statement>;
  onUpdateStatement?: (
    statementId: string,
    values: Partial<{
      name: string;
      statementType: Statement['statementType'];
      status: Statement['status'];
      counterparty: string;
      comment: string;
      paidAt: string | null;
      recordIds: string[];
    }>
  ) => Promise<Statement>;
}

type IncomeExpenseRow = {
  key: string;
  payment: Payment;
  recordId: string;
  statementId?: string | null;
  recordAmount: number;
  recordDate?: string | null;
  recordDescription?: string;
  recordSource?: string;
  recordNote?: string;
};

export const CommissionsView: React.FC<CommissionsViewProps> = ({
  payments,
  policies,
  statements,
  onDealSelect,
  onRequestEditPolicy,
  onUpdateFinancialRecord,
  onCreateStatement,
  onUpdateStatement,
}) => {
  const navigate = useNavigate();
  const [filters, setFilters] = useState<FilterParams>({});
  const [amountDrafts, setAmountDrafts] = useState<Record<string, string>>({});
  const [selectedStatementId, setSelectedStatementId] = useState<string>('all');
  const [selectedRecordIds, setSelectedRecordIds] = useState<string[]>([]);
  const [isStatementModalOpen, setStatementModalOpen] = useState(false);
  const [statementForm, setStatementForm] = useState({
    name: '',
    statementType: 'income' as Statement['statementType'],
    counterparty: '',
    comment: '',
  });

  const policiesById = useMemo(
    () => new Map(policies.map((policy) => [policy.id, policy])),
    [policies]
  );
  const statementsById = useMemo(
    () => new Map(statements.map((statement) => [statement.id, statement])),
    [statements]
  );

  const rows = useMemo<IncomeExpenseRow[]>(() => {
    const result: IncomeExpenseRow[] = [];
    payments.forEach((payment) => {
      const records = payment.financialRecords ?? [];
      records.forEach((record) => {
        const amount = Number(record.amount);
        if (!Number.isFinite(amount) || amount === 0) {
          return;
        }
        result.push({
          key: `${payment.id}-${record.id}`,
          payment,
          recordId: record.id,
          statementId: record.statementId,
          recordAmount: amount,
          recordDate: record.date ?? null,
          recordDescription: record.description,
          recordSource: record.source,
          recordNote: record.note,
        });
      });
    });
    return result;
  }, [payments]);

  const filteredRows = useMemo(() => {
    let result = [...rows];
    const search = (filters.search ?? '').toString().toLowerCase().trim();

    if (search) {
      result = result.filter((row) => {
        const payment = row.payment;
        const policyNumber =
          payment.policyNumber ??
          policiesById.get(payment.policyId ?? '')?.number ??
          '';
        const salesChannel =
          policiesById.get(payment.policyId ?? '')?.salesChannelName ??
          policiesById.get(payment.policyId ?? '')?.salesChannel ??
          '';
        const haystack = [
          payment.policyInsuranceType,
          policyNumber,
          salesChannel,
          payment.dealTitle,
          payment.dealClientName,
          payment.description,
          row.recordDescription,
          row.recordSource,
          row.recordNote,
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase();
        return haystack.includes(search);
      });
    }

    if (selectedStatementId !== 'all') {
      result = result.filter((row) => row.statementId === selectedStatementId);
    }

    const ordering = (filters.ordering as string) || '-recordDate';
    const direction = ordering.startsWith('-') ? -1 : 1;
    const field = (ordering.replace(/^-/, '') as IncomeExpenseSortKey) || 'recordDate';

    const resolveSortValue = (row: IncomeExpenseRow): number => {
      switch (field) {
        case 'payment':
          return Number(row.payment.amount) || 0;
        case 'record':
          return Math.abs(row.recordAmount) || 0;
        case 'recordDate':
        default:
          return row.recordDate ? new Date(row.recordDate).getTime() : 0;
      }
    };

    result.sort((a, b) => (resolveSortValue(a) - resolveSortValue(b)) * direction);
    return result;
  }, [filters, policiesById, rows, selectedStatementId]);

  const handleOpenDeal = useCallback(
    (dealId: string | undefined) => {
      if (!dealId) {
        return;
      }
      onDealSelect?.(dealId);
      navigate('/deals');
    },
    [navigate, onDealSelect]
  );

  const handleRecordDateChange = useCallback(
    async (row: IncomeExpenseRow, value: string) => {
      if (!onUpdateFinancialRecord) {
        return;
      }
      const recordType: AddFinancialRecordFormValues['recordType'] =
        row.recordAmount >= 0 ? 'income' : 'expense';
      await onUpdateFinancialRecord(row.recordId, {
        paymentId: row.payment.id,
        recordType,
        amount: Math.abs(row.recordAmount).toString(),
        date: value || null,
        description: row.recordDescription ?? '',
        source: row.recordSource ?? '',
        note: row.recordNote ?? '',
      });
    },
    [onUpdateFinancialRecord]
  );

  const handleRecordAmountChange = useCallback((recordId: string, value: string) => {
    setAmountDrafts((prev) => ({ ...prev, [recordId]: value }));
  }, []);

  const handleRecordAmountBlur = useCallback(
    async (row: IncomeExpenseRow) => {
      if (!onUpdateFinancialRecord) {
        return;
      }
      const draft = amountDrafts[row.recordId];
      if (draft === undefined) {
        return;
      }
      const parsed = Number(draft);
      if (!Number.isFinite(parsed)) {
        return;
      }
      const recordType: AddFinancialRecordFormValues['recordType'] =
        row.recordAmount >= 0 ? 'income' : 'expense';
      await onUpdateFinancialRecord(row.recordId, {
        paymentId: row.payment.id,
        recordType,
        amount: Math.abs(parsed).toString(),
        date: row.recordDate ?? null,
        description: row.recordDescription ?? '',
        source: row.recordSource ?? '',
        note: row.recordNote ?? '',
      });
      setAmountDrafts((prev) => {
        const next = { ...prev };
        delete next[row.recordId];
        return next;
      });
    },
    [amountDrafts, onUpdateFinancialRecord]
  );

  const selectedStatement =
    selectedStatementId !== 'all' ? statementsById.get(selectedStatementId) : undefined;
  const isSelectedStatementPaid = selectedStatement?.status === 'paid';

  const canAttachRow = useCallback(
    (row: IncomeExpenseRow) => {
      if (!selectedStatement) {
        return false;
      }
      if (row.statementId && row.statementId !== selectedStatement.id) {
        return false;
      }
      const isIncome = row.recordAmount > 0;
      if (selectedStatement.statementType === 'income' && !isIncome) {
        return false;
      }
      if (selectedStatement.statementType === 'expense' && isIncome) {
        return false;
      }
      return true;
    },
    [selectedStatement]
  );

  const toggleRecordSelection = useCallback(
    (recordId: string) => {
      setSelectedRecordIds((prev) =>
        prev.includes(recordId) ? prev.filter((id) => id !== recordId) : [...prev, recordId]
      );
    },
    []
  );

  const handleAttachSelected = useCallback(async () => {
    if (!selectedStatement || !onUpdateStatement || !selectedRecordIds.length) {
      return;
    }
    await onUpdateStatement(selectedStatement.id, {
      recordIds: selectedRecordIds,
    });
    setSelectedRecordIds([]);
  }, [onUpdateStatement, selectedRecordIds, selectedStatement]);

  const handleCreateStatement = useCallback(async () => {
    if (!onCreateStatement) {
      return;
    }
    if (!statementForm.name.trim()) {
      return;
    }
    const created = await onCreateStatement({
      name: statementForm.name.trim(),
      statementType: statementForm.statementType,
      counterparty: statementForm.counterparty.trim(),
      comment: statementForm.comment.trim(),
    });
    setStatementModalOpen(false);
    setStatementForm({
      name: '',
      statementType: statementForm.statementType,
      counterparty: '',
      comment: '',
    });
    setSelectedStatementId(created.id);
  }, [onCreateStatement, statementForm]);

  return (
    <section aria-labelledby="commissionsViewHeading" className="app-panel p-6 shadow-none space-y-4">
      <h1 id="commissionsViewHeading" className="sr-only">
        Доходы и расходы
      </h1>
      <div className="flex flex-col gap-3 xl:flex-row xl:items-end xl:justify-between">
        <FilterBar
          onFilterChange={setFilters}
          searchPlaceholder="Поиск по полису, сделке или клиенту..."
          sortOptions={INCOME_EXPENSE_SORT_OPTIONS}
        />
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex flex-col gap-1">
            <span className="text-xs uppercase tracking-[0.2em] text-slate-400">Ведомость</span>
            <select
              value={selectedStatementId}
              onChange={(event) => {
                setSelectedStatementId(event.target.value);
                setSelectedRecordIds([]);
              }}
              className="field field-input h-9 min-w-[220px] text-sm"
            >
              <option value="all">Все записи</option>
              {statements.map((statement) => (
                <option key={statement.id} value={statement.id}>
                  {statement.statementType === 'income' ? 'Доходы' : 'Расходы'} ·{' '}
                  {statement.name}
                </option>
              ))}
            </select>
          </div>
          {onCreateStatement && (
            <button
              type="button"
              onClick={() => setStatementModalOpen(true)}
              className="btn btn-secondary btn-sm rounded-xl"
            >
              + Создать ведомость
            </button>
          )}
          {selectedStatement && (
            <button
              type="button"
              onClick={() => void handleAttachSelected()}
              className="btn btn-primary btn-sm rounded-xl"
              disabled={!selectedRecordIds.length || !onUpdateStatement || isSelectedStatementPaid}
            >
              Добавить выбранные
            </button>
          )}
        </div>
      </div>

      <div className="app-panel shadow-none overflow-hidden">
        <div className="overflow-x-auto bg-white">
          <table className="deals-table min-w-full border-collapse text-left text-sm" aria-label="Доходы и расходы">
            <thead className={TABLE_THEAD_CLASS}>
              <tr>
                <TableHeadCell padding="sm" className="w-10" />
                <TableHeadCell className="min-w-[260px]">ФИО клиента</TableHeadCell>
                <TableHeadCell className="min-w-[160px]">Номер полиса</TableHeadCell>
                <TableHeadCell className="min-w-[180px]">Полис</TableHeadCell>
                <TableHeadCell className="min-w-[180px]">Канал продаж</TableHeadCell>
                <TableHeadCell className="min-w-[180px]">Платеж</TableHeadCell>
                <TableHeadCell className="min-w-[180px]">Расход/доход</TableHeadCell>
                <TableHeadCell className="min-w-[180px]">Дата оплаты</TableHeadCell>
              </tr>
            </thead>
            <tbody className="bg-white">
              {filteredRows.map((row) => {
                const payment = row.payment;
                const policyNumber =
                  payment.policyNumber ??
                  policiesById.get(payment.policyId ?? '')?.number ??
                  '-';
                const policyEntity = payment.policyId
                  ? policiesById.get(payment.policyId) ?? null
                  : null;
                const policyType =
                  payment.policyInsuranceType ??
                  policiesById.get(payment.policyId ?? '')?.insuranceType ??
                  '-';
                const salesChannelLabel =
                  policiesById.get(payment.policyId ?? '')?.salesChannelName ??
                  policiesById.get(payment.policyId ?? '')?.salesChannel ??
                  '-';
                const clientName = payment.dealClientName ?? '-';
                const dealTitle = payment.dealTitle ?? '-';
                const paymentActualDate = payment.actualDate ? formatDateRu(payment.actualDate) : null;
                const paymentScheduledDate = payment.scheduledDate
                  ? formatDateRu(payment.scheduledDate)
                  : null;
                const recordAmount = row.recordAmount;
                const isIncome = recordAmount > 0;
                const recordLabel = isIncome
                  ? `Доход ${formatCurrencyRu(recordAmount)}`
                  : `Расход ${formatCurrencyRu(Math.abs(recordAmount))}`;
                const recordClass = isIncome ? 'text-emerald-700' : 'text-rose-700';
                const recordDateLabel = formatDateRu(row.recordDate);
                const recordNotes = [
                  row.recordDescription,
                  row.recordSource,
                  row.recordNote,
                ]
                  .map((value) => value?.toString().trim())
                  .filter(Boolean)
                  .join(' · ');
                const amountValue =
                  amountDrafts[row.recordId] ?? Math.abs(recordAmount).toString();
                const recordStatement = row.statementId
                  ? statementsById.get(row.statementId)
                  : undefined;
                const isRecordLocked = recordStatement?.status === 'paid';
                const statementNote = recordStatement
                  ? recordStatement.paidAt
                    ? `Ведомость от ${formatDateRu(recordStatement.paidAt)}: ${recordStatement.name}`
                    : `Ведомость: ${recordStatement.name}`
                  : null;
                const isSelectable = Boolean(selectedStatement && canAttachRow(row));
                const isSelected = selectedRecordIds.includes(row.recordId);

                return (
                  <tr key={row.key} className={TABLE_ROW_CLASS}>
                    <td className="border border-slate-200 px-3 py-3 text-center">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => toggleRecordSelection(row.recordId)}
                        disabled={!selectedStatement || !isSelectable || isSelectedStatementPaid}
                        className="check"
                        title={
                          !selectedStatement
                            ? 'Выберите ведомость'
                            : !isSelectable
                            ? 'Запись нельзя добавить в выбранную ведомость'
                            : undefined
                        }
                      />
                    </td>
                    <td className={TABLE_CELL_CLASS_LG}>
                      <p className="text-base font-semibold text-slate-900">{clientName}</p>
                      <div className="mt-1 flex flex-wrap items-center gap-1 text-xs text-slate-500">
                        {payment.dealId && onDealSelect ? (
                          <button
                            type="button"
                            onClick={() => handleOpenDeal(payment.dealId)}
                            className="link-action text-xs font-semibold"
                          >
                            {dealTitle}
                          </button>
                        ) : (
                          <span>{dealTitle}</span>
                        )}
                        <span>·</span>
                        <span>{clientName}</span>
                      </div>
                    </td>
                    <td className={`${TABLE_CELL_CLASS_LG} text-slate-700`}>
                      {policyEntity && onRequestEditPolicy ? (
                        <button
                          type="button"
                          onClick={() => onRequestEditPolicy(policyEntity)}
                          className="link-action text-left"
                        >
                          {policyNumber}
                        </button>
                      ) : (
                        policyNumber
                      )}
                    </td>
                    <td className={`${TABLE_CELL_CLASS_LG} text-slate-700`}>{policyType}</td>
                    <td className={`${TABLE_CELL_CLASS_LG} text-slate-700`}>{salesChannelLabel}</td>
                    <td className={`${TABLE_CELL_CLASS_LG} text-slate-700`}>
                      <p className="text-base font-semibold">{formatCurrencyRu(payment.amount)}</p>
                      {paymentActualDate ? (
                        <p className="text-xs text-slate-500 mt-1">Оплата: {paymentActualDate}</p>
                      ) : paymentScheduledDate ? (
                        <p className="text-xs text-slate-500 mt-1">План: {paymentScheduledDate}</p>
                      ) : (
                        <p className="text-xs text-slate-500 mt-1">Оплата: —</p>
                      )}
                    </td>
                    <td className={`${TABLE_CELL_CLASS_LG} text-slate-700`}>
                      <p className={`text-sm font-semibold ${recordClass}`}>{recordLabel}</p>
                      {recordNotes ? (
                        <p className="text-xs text-slate-500 mt-1">{recordNotes}</p>
                      ) : (
                        <p className="text-xs text-slate-400 mt-1">Примечаний нет</p>
                      )}
                      {onUpdateFinancialRecord && (
                        <input
                          type="number"
                          step="0.01"
                          value={amountValue}
                          onChange={(event) =>
                            handleRecordAmountChange(row.recordId, event.target.value)
                          }
                          onBlur={() => void handleRecordAmountBlur(row)}
                          disabled={isRecordLocked}
                          className="mt-2 w-full max-w-[180px] rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs text-slate-700 focus:border-sky-500 focus:outline-none focus:ring focus:ring-sky-100"
                        />
                      )}
                    </td>
                    <td className={`${TABLE_CELL_CLASS_LG} text-slate-700`}>
                      <p className="text-sm text-slate-900">{recordDateLabel}</p>
                      {statementNote && (
                        <p className="text-xs text-slate-500 mt-1">{statementNote}</p>
                      )}
                      {onUpdateFinancialRecord && (
                        <input
                          type="date"
                          value={row.recordDate ?? ''}
                          onChange={(event) =>
                            handleRecordDateChange(row, event.target.value)
                          }
                          disabled={isRecordLocked}
                          className="mt-2 w-full max-w-[180px] rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs text-slate-700 focus:border-sky-500 focus:outline-none focus:ring focus:ring-sky-100"
                        />
                      )}
                    </td>
                  </tr>
                );
              })}
              {!filteredRows.length && (
                <tr>
                  <td
                    colSpan={8}
                    className="border border-slate-200 px-6 py-10 text-center text-slate-600"
                  >
                    <PanelMessage>Записей пока нет</PanelMessage>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {isStatementModalOpen && (
        <Modal
          title="Создать ведомость"
          onClose={() => setStatementModalOpen(false)}
          size="sm"
          closeOnOverlayClick={false}
        >
          <form
            onSubmit={(event) => {
              event.preventDefault();
              void handleCreateStatement();
            }}
            className="space-y-4"
          >
            <div className="space-y-2">
              <label htmlFor="statementName" className="app-label">
                Название *
              </label>
              <input
                id="statementName"
                value={statementForm.name}
                onChange={(event) =>
                  setStatementForm((prev) => ({ ...prev, name: event.target.value }))
                }
                className="field field-input"
                required
              />
            </div>
            <div className="space-y-2">
              <label htmlFor="statementType" className="app-label">
                Тип
              </label>
              <select
                id="statementType"
                value={statementForm.statementType}
                onChange={(event) =>
                  setStatementForm((prev) => ({
                    ...prev,
                    statementType: event.target.value as Statement['statementType'],
                  }))
                }
                className="field field-input"
              >
                <option value="income">Доходы</option>
                <option value="expense">Расходы</option>
              </select>
            </div>
            <div className="space-y-2">
              <label htmlFor="statementCounterparty" className="app-label">
                Контрагент
              </label>
              <input
                id="statementCounterparty"
                value={statementForm.counterparty}
                onChange={(event) =>
                  setStatementForm((prev) => ({ ...prev, counterparty: event.target.value }))
                }
                className="field field-input"
              />
            </div>
            <div className="space-y-2">
              <label htmlFor="statementComment" className="app-label">
                Комментарий
              </label>
              <textarea
                id="statementComment"
                value={statementForm.comment}
                onChange={(event) =>
                  setStatementForm((prev) => ({ ...prev, comment: event.target.value }))
                }
                rows={3}
                className="field-textarea"
              />
            </div>
            <div className="flex justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setStatementModalOpen(false)}
                className="btn btn-secondary rounded-xl"
              >
                Отмена
              </button>
              <button type="submit" className="btn btn-primary rounded-xl">
                Создать
              </button>
            </div>
          </form>
        </Modal>
      )}
    </section>
  );
};
