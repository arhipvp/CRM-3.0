import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import type { Payment, Policy, Statement } from '../../types';
import type { AddFinancialRecordFormValues } from '../forms/AddFinancialRecordForm';
import { PanelMessage } from '../PanelMessage';
import { TableHeadCell } from '../common/TableHeadCell';
import { Modal } from '../Modal';
import {
  TABLE_CELL_CLASS_LG,
  TABLE_ROW_CLASS,
  TABLE_THEAD_CLASS,
} from '../common/tableStyles';
import { formatCurrencyRu, formatDateRu } from '../../utils/formatting';

interface CommissionsViewProps {
  payments: Payment[];
  policies: Policy[];
  statements: Statement[];
  onDealSelect?: (dealId: string) => void;
  onRequestEditPolicy?: (policy: Policy) => void;
  onUpdateFinancialRecord?: (recordId: string, values: AddFinancialRecordFormValues) => Promise<void>;
  onDeleteStatement?: (statementId: string) => Promise<void>;
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
  onDeleteStatement,
  onCreateStatement,
  onUpdateStatement,
}) => {
  const navigate = useNavigate();
  const [amountDrafts, setAmountDrafts] = useState<Record<string, string>>({});
  const [selectedStatementId, setSelectedStatementId] = useState<string | null>(null);
  const [selectedRecordIds, setSelectedRecordIds] = useState<string[]>([]);
  const [viewMode, setViewMode] = useState<'all' | 'statements'>('all');
  const [isStatementModalOpen, setStatementModalOpen] = useState(false);
  const [editingStatement, setEditingStatement] = useState<Statement | null>(null);
  const [deletingStatement, setDeletingStatement] = useState<Statement | null>(null);
  const [editStatementForm, setEditStatementForm] = useState({
    name: '',
    statementType: 'income' as Statement['statementType'],
    status: 'draft' as Statement['status'],
    counterparty: '',
    comment: '',
    paidAt: '',
  });
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

  useEffect(() => {
    if (viewMode === 'all') {
      setSelectedStatementId(null);
      return;
    }
    if (!statements.length) {
      setSelectedStatementId(null);
      return;
    }
    if (!selectedStatementId || !statementsById.has(selectedStatementId)) {
      setSelectedStatementId(statements[0].id);
    }
  }, [selectedStatementId, statements, statementsById, viewMode]);

  useEffect(() => {
    setSelectedRecordIds([]);
  }, [selectedStatementId]);

  useEffect(() => {
    setSelectedRecordIds([]);
  }, [viewMode]);

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
    if (viewMode === 'statements' && !selectedStatementId) {
      return [];
    }
    const result =
      viewMode === 'all'
        ? [...rows]
        : rows.filter((row) => row.statementId === selectedStatementId);
    result.sort((a, b) => {
      const aTime = a.recordDate ? new Date(a.recordDate).getTime() : 0;
      const bTime = b.recordDate ? new Date(b.recordDate).getTime() : 0;
      return bTime - aTime;
    });
    return result;
  }, [rows, selectedStatementId, viewMode]);

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

  const selectedStatement = selectedStatementId
    ? statementsById.get(selectedStatementId)
    : undefined;
  const isSelectedStatementPaid = selectedStatement?.status === 'paid';

  const canAttachRow = useCallback(
    (row: IncomeExpenseRow) => {
      if (!selectedStatement || viewMode === 'all') {
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
    [selectedStatement, viewMode]
  );

  const toggleRecordSelection = useCallback(
    (row: IncomeExpenseRow) => {
      if (!selectedStatement || !canAttachRow(row)) {
        return;
      }
      setSelectedRecordIds((prev) =>
        prev.includes(row.recordId)
          ? prev.filter((id) => id !== row.recordId)
          : [...prev, row.recordId]
      );
    },
    [canAttachRow, selectedStatement]
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
    setSelectedRecordIds([]);
  }, [onCreateStatement, statementForm]);

  const handleEditStatementOpen = useCallback((statement: Statement) => {
    setEditingStatement(statement);
    setEditStatementForm({
      name: statement.name ?? '',
      statementType: statement.statementType,
      status: statement.status,
      counterparty: statement.counterparty ?? '',
      comment: statement.comment ?? '',
      paidAt: statement.paidAt ?? '',
    });
  }, []);

  const handleEditStatementSubmit = useCallback(async () => {
    if (!editingStatement || !onUpdateStatement) {
      return;
    }
    const normalizedPaidAt =
      editStatementForm.status === 'paid'
        ? editStatementForm.paidAt || null
        : null;
    await onUpdateStatement(editingStatement.id, {
      name: editStatementForm.name.trim(),
      statementType: editStatementForm.statementType,
      status: editStatementForm.status,
      counterparty: editStatementForm.counterparty.trim(),
      comment: editStatementForm.comment.trim(),
      paidAt: normalizedPaidAt,
    });
    setEditingStatement(null);
  }, [editStatementForm, editingStatement, onUpdateStatement]);

  const handleDeleteStatementConfirm = useCallback(async () => {
    if (!deletingStatement || !onDeleteStatement) {
      return;
    }
    await onDeleteStatement(deletingStatement.id);
    setDeletingStatement(null);
  }, [deletingStatement, onDeleteStatement]);

  return (
    <section aria-labelledby="commissionsViewHeading" className="flex h-full flex-col gap-6">
      <h1 id="commissionsViewHeading" className="sr-only">
        Доходы и расходы
      </h1>
      <div
        role="tablist"
        aria-label="Разделы доходов и расходов"
        className="flex w-full flex-nowrap gap-2 overflow-x-auto app-panel-muted p-1 shadow-none scrollbar-none"
      >
        <button
          id="financial-tab-statements"
          role="tab"
          type="button"
          aria-selected={viewMode === 'statements'}
          aria-controls="financial-tabpanel-statements"
          onClick={() => setViewMode('statements')}
          className={`min-w-[200px] flex-shrink-0 rounded-xl px-4 py-2 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 ${
            viewMode === 'statements'
              ? 'bg-white font-semibold text-sky-700 border border-slate-200 shadow-sm'
              : 'text-slate-600 hover:bg-white/70 hover:text-slate-900'
          }`}
        >
          Ведомости
        </button>
        <button
          id="financial-tab-all"
          role="tab"
          type="button"
          aria-selected={viewMode === 'all'}
          aria-controls="financial-tabpanel-all"
          onClick={() => setViewMode('all')}
          className={`min-w-[240px] flex-shrink-0 rounded-xl px-4 py-2 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 ${
            viewMode === 'all'
              ? 'bg-white font-semibold text-sky-700 border border-slate-200 shadow-sm'
              : 'text-slate-600 hover:bg-white/70 hover:text-slate-900'
          }`}
        >
          Все финансовые записи
        </button>
      </div>

      <div className="app-panel overflow-hidden">
        <div className="divide-y divide-slate-200">
          {viewMode === 'statements' && (
            <>
              <div className="flex flex-wrap items-center justify-between gap-3 p-4">
                <div>
                  <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Ведомости</p>
                  <p className="text-sm text-slate-600">
                    Выберите ведомость, чтобы посмотреть ее записи.
                  </p>
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
              </div>
              <div className="max-h-72 overflow-y-auto bg-white">
                {statements.length ? (
                  <ul className="divide-y divide-slate-200">
                    {statements.map((statement) => {
                      const isActive = statement.id === selectedStatementId;
                      const totalAmount = Number(statement.totalAmount ?? 0);
                      const totalLabel = Number.isFinite(totalAmount)
                        ? formatCurrencyRu(totalAmount)
                        : '—';
                      const recordsCount = statement.recordsCount ?? 0;
                      const paidAt = statement.paidAt ? formatDateRu(statement.paidAt) : null;
                      const statusLabel =
                        statement.status === 'paid' ? 'Выплачена' : 'Черновик';
                      const typeLabel =
                        statement.statementType === 'income' ? 'Доходы' : 'Расходы';
                      const isLocked = statement.status === 'paid';

                      return (
                        <li key={statement.id}>
                          <div
                            className={`flex flex-wrap items-center justify-between gap-3 px-4 py-3 transition ${
                              isActive ? 'bg-slate-50' : 'hover:bg-slate-50'
                            }`}
                          >
                            <button
                              type="button"
                              onClick={() => setSelectedStatementId(statement.id)}
                              className="flex flex-1 flex-wrap items-center justify-between gap-3 text-left"
                            >
                              <div className="space-y-1">
                                <p className="text-sm font-semibold text-slate-900">
                                  {statement.name}
                                </p>
                                <p className="text-xs text-slate-500">
                                  {typeLabel} · {statusLabel}
                                  {statement.counterparty ? ` · ${statement.counterparty}` : ''}
                                  {paidAt ? ` · Выплата ${paidAt}` : ''}
                                </p>
                              </div>
                              <div className="text-right">
                                <p className="text-sm font-semibold text-slate-900">{totalLabel}</p>
                                <p className="text-xs text-slate-500">
                                  Записей: {recordsCount}
                                </p>
                              </div>
                            </button>
                            <div className="flex items-center gap-2">
                              {onUpdateStatement && (
                                <button
                                  type="button"
                                  onClick={() => handleEditStatementOpen(statement)}
                                  disabled={isLocked}
                                  className={`text-xs font-semibold transition ${
                                    isLocked
                                      ? 'text-slate-300'
                                      : 'text-slate-500 hover:text-slate-900'
                                  }`}
                                >
                                  Редактировать
                                </button>
                              )}
                              {onDeleteStatement && (
                                <button
                                  type="button"
                                  onClick={() => setDeletingStatement(statement)}
                                  disabled={isLocked}
                                  className={`text-xs font-semibold transition ${
                                    isLocked
                                      ? 'text-slate-300'
                                      : 'text-rose-500 hover:text-rose-600'
                                  }`}
                                >
                                  Удалить
                                </button>
                              )}
                            </div>
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                ) : (
                  <div className="px-6 py-10 text-center">
                    <PanelMessage>Ведомостей пока нет</PanelMessage>
                  </div>
                )}
              </div>
            </>
          )}
          <div
            role="tabpanel"
            id="financial-tabpanel-statements"
            aria-labelledby="financial-tab-statements"
            tabIndex={0}
            className="outline-none"
            hidden={viewMode !== 'statements'}
          >
            <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-50 px-4 py-3">
              <div className="space-y-1">
                <p className="text-sm font-semibold text-slate-900">
                  {selectedStatement?.name || 'Записи'}
                </p>
                {selectedStatement && selectedStatement.status === 'paid' && (
                  <p className="text-xs text-rose-600">
                    Выплаченная ведомость недоступна для редактирования и удаления.
                  </p>
                )}
              </div>
              {selectedRecordIds.length > 0 && (
                <button
                  type="button"
                  onClick={() => void handleAttachSelected()}
                  className="btn btn-primary btn-sm rounded-xl"
                  disabled={
                    !selectedRecordIds.length ||
                    !onUpdateStatement ||
                    !selectedStatement ||
                    isSelectedStatementPaid
                  }
                >
                  Добавить выбранные
                </button>
              )}
            </div>
          </div>
          <div
            role="tabpanel"
            id="financial-tabpanel-all"
            aria-labelledby="financial-tab-all"
            tabIndex={0}
            className="outline-none"
            hidden={viewMode !== 'all'}
          >
            <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-50 px-4 py-3">
              <p className="text-sm font-semibold text-slate-900">Все финансовые записи</p>
            </div>
          </div>
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
                const isSelectable =
                  viewMode === 'statements' && selectedStatement
                    ? canAttachRow(row)
                    : false;
                const isSelected =
                  viewMode === 'statements' && selectedRecordIds.includes(row.recordId);

                return (
                  <tr key={row.key} className={TABLE_ROW_CLASS}>
                    <td className="border border-slate-200 px-3 py-3 text-center">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => toggleRecordSelection(row)}
                        disabled={viewMode === 'all' || isSelectedStatementPaid || !isSelectable}
                        className="check"
                        title={
                          viewMode === 'statements' && !isSelectable
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
                    <PanelMessage>
                      {viewMode === 'statements' && selectedStatement
                        ? 'Записей в ведомости пока нет'
                        : 'Записей пока нет'}
                    </PanelMessage>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
          </div>
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
              <p className="text-xs text-slate-500">
                После пометки ведомости как «Выплачена» редактирование и удаление будут
                недоступны.
              </p>
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
      {editingStatement && (
        <Modal
          title="Редактировать ведомость"
          onClose={() => setEditingStatement(null)}
          size="sm"
          closeOnOverlayClick={false}
        >
          <form
            onSubmit={(event) => {
              event.preventDefault();
              void handleEditStatementSubmit();
            }}
            className="space-y-4"
          >
            <div className="space-y-2">
              <label htmlFor="editStatementName" className="app-label">
                Название *
              </label>
              <input
                id="editStatementName"
                value={editStatementForm.name}
                onChange={(event) =>
                  setEditStatementForm((prev) => ({ ...prev, name: event.target.value }))
                }
                className="field field-input"
                required
              />
            </div>
            <div className="space-y-2">
              <label htmlFor="editStatementType" className="app-label">
                Тип
              </label>
              <select
                id="editStatementType"
                value={editStatementForm.statementType}
                onChange={(event) =>
                  setEditStatementForm((prev) => ({
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
              <label htmlFor="editStatementStatus" className="app-label">
                Статус
              </label>
              <select
                id="editStatementStatus"
                value={editStatementForm.status}
                onChange={(event) =>
                  setEditStatementForm((prev) => ({
                    ...prev,
                    status: event.target.value as Statement['status'],
                  }))
                }
                className="field field-input"
              >
                <option value="draft">Черновик</option>
                <option value="paid">Выплачена</option>
              </select>
              <p className="text-xs text-slate-500">
                После пометки ведомости как «Выплачена» редактирование и удаление будут недоступны.
              </p>
            </div>
            <div className="space-y-2">
              <label htmlFor="editStatementPaidAt" className="app-label">
                Дата выплаты
              </label>
              <input
                id="editStatementPaidAt"
                type="date"
                value={editStatementForm.paidAt}
                onChange={(event) =>
                  setEditStatementForm((prev) => ({ ...prev, paidAt: event.target.value }))
                }
                className="field field-input"
              />
            </div>
            <div className="space-y-2">
              <label htmlFor="editStatementCounterparty" className="app-label">
                Контрагент
              </label>
              <input
                id="editStatementCounterparty"
                value={editStatementForm.counterparty}
                onChange={(event) =>
                  setEditStatementForm((prev) => ({
                    ...prev,
                    counterparty: event.target.value,
                  }))
                }
                className="field field-input"
              />
            </div>
            <div className="space-y-2">
              <label htmlFor="editStatementComment" className="app-label">
                Комментарий
              </label>
              <textarea
                id="editStatementComment"
                value={editStatementForm.comment}
                onChange={(event) =>
                  setEditStatementForm((prev) => ({
                    ...prev,
                    comment: event.target.value,
                  }))
                }
                rows={3}
                className="field-textarea"
              />
            </div>
            <div className="flex justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setEditingStatement(null)}
                className="btn btn-secondary rounded-xl"
              >
                Отмена
              </button>
              <button type="submit" className="btn btn-primary rounded-xl">
                Сохранить
              </button>
            </div>
          </form>
        </Modal>
      )}
      {deletingStatement && (
        <Modal
          title="Удалить ведомость"
          onClose={() => setDeletingStatement(null)}
          closeOnOverlayClick={false}
        >
          <p className="text-sm text-slate-700">
            Ведомость <span className="font-bold">{deletingStatement.name}</span> будет удалена.
            Все записи отвяжутся от ведомости.
          </p>
          <div className="mt-6 flex justify-end gap-3">
            <button
              type="button"
              onClick={() => setDeletingStatement(null)}
              className="btn btn-secondary rounded-xl"
            >
              Отмена
            </button>
            <button
              type="button"
              onClick={() => void handleDeleteStatementConfirm()}
              className="btn btn-danger rounded-xl"
            >
              Удалить
            </button>
          </div>
        </Modal>
      )}
    </section>
  );
};
