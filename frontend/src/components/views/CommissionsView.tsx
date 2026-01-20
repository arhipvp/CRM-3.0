import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import type { DriveFile, FinancialRecord, Payment, Policy, Statement } from '../../types';
import type { FilterParams } from '../../api';
import {
  fetchFinancialRecordsWithPagination,
  fetchStatementDriveFiles,
  trashStatementDriveFiles,
  uploadStatementDriveFile,
} from '../../api';
import type { AddFinancialRecordFormValues } from '../forms/AddFinancialRecordForm';
import { PanelMessage } from '../PanelMessage';
import { TableHeadCell } from '../common/TableHeadCell';
import { Modal } from '../Modal';
import { TABLE_CELL_CLASS_LG, TABLE_ROW_CLASS, TABLE_THEAD_CLASS } from '../common/tableStyles';
import { formatCurrencyRu, formatDateRu } from '../../utils/formatting';
import { useDebouncedValue } from '../../hooks/useDebouncedValue';
import { formatErrorMessage } from '../../utils/formatErrorMessage';
import { buildDriveFolderLink } from '../../utils/links';
import { formatDriveDate, formatDriveFileSize, getDriveItemIcon } from './dealsView/helpers';
import { useNotification } from '../../contexts/NotificationContext';
import { copyToClipboard } from '../../utils/clipboard';

interface CommissionsViewProps {
  payments: Payment[];
  policies: Policy[];
  statements: Statement[];
  onDealSelect?: (dealId: string) => void;
  onDealPreview?: (dealId: string) => void;
  onRequestEditPolicy?: (policy: Policy) => void;
  onUpdateFinancialRecord?: (
    recordId: string,
    values: AddFinancialRecordFormValues,
  ) => Promise<void>;
  onDeleteStatement?: (statementId: string) => Promise<void>;
  onRemoveStatementRecords?: (statementId: string, recordIds: string[]) => Promise<void>;
  onMarkStatementPaid?: (statementId: string) => Promise<Statement>;
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
    }>,
  ) => Promise<Statement>;
}

type IncomeExpenseRow = {
  key: string;
  payment: Payment;
  recordId: string;
  statementId?: string | null;
  recordAmount: number;
  paymentPaidBalance?: number;
  paymentPaidEntries?: Array<{ amount: string; date: string }>;
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
  onDealPreview,
  onUpdateFinancialRecord,
  onDeleteStatement,
  onRemoveStatementRecords,
  onMarkStatementPaid,
  onCreateStatement,
  onUpdateStatement,
}) => {
  const navigate = useNavigate();
  const { addNotification } = useNotification();
  const [amountDrafts, setAmountDrafts] = useState<Record<string, string>>({});
  const [selectedStatementId, setSelectedStatementId] = useState<string | null>(null);
  const [selectedRecordIds, setSelectedRecordIds] = useState<string[]>([]);
  const [viewMode, setViewMode] = useState<'all' | 'statements'>('all');
  const [allRecordsSearch, setAllRecordsSearch] = useState('');
  const [showUnpaidOnly, setShowUnpaidOnly] = useState(false);
  const [showWithoutStatementOnly, setShowWithoutStatementOnly] = useState(false);
  const [showNonZeroBalanceOnly, setShowNonZeroBalanceOnly] = useState(false);
  const [recordTypeFilter, setRecordTypeFilter] = useState<'all' | 'income' | 'expense'>('all');
  const [targetStatementId, setTargetStatementId] = useState('');
  const [allRecords, setAllRecords] = useState<FinancialRecord[]>([]);
  const [isAllRecordsLoading, setIsAllRecordsLoading] = useState(false);
  const [isStatementModalOpen, setStatementModalOpen] = useState(false);
  const [editingStatement, setEditingStatement] = useState<Statement | null>(null);
  const [deletingStatement, setDeletingStatement] = useState<Statement | null>(null);
  const [payingStatement, setPayingStatement] = useState<Statement | null>(null);
  const [missingPaidAtStatement, setMissingPaidAtStatement] = useState<Statement | null>(null);
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
  const [statementDriveFiles, setStatementDriveFiles] = useState<DriveFile[]>([]);
  const [statementDriveFolderIds, setStatementDriveFolderIds] = useState<
    Record<string, string | null>
  >({});
  const [isStatementDriveLoading, setStatementDriveLoading] = useState(false);
  const [isStatementDriveUploading, setStatementDriveUploading] = useState(false);
  const [isStatementDriveTrashing, setStatementDriveTrashing] = useState(false);
  const [statementDriveError, setStatementDriveError] = useState<string | null>(null);

  const policiesById = useMemo(
    () => new Map(policies.map((policy) => [policy.id, policy])),
    [policies],
  );
  const paymentsById = useMemo(
    () => new Map(payments.map((payment) => [payment.id, payment])),
    [payments],
  );
  const statementsById = useMemo(
    () => new Map(statements.map((statement) => [statement.id, statement])),
    [statements],
  );

  const debouncedSearch = useDebouncedValue(allRecordsSearch.trim(), 450);
  const effectiveSearch = debouncedSearch.length >= 5 ? debouncedSearch : '';

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

  useEffect(() => {
    setSelectedRecordIds([]);
  }, [targetStatementId]);

  const loadAllRecords = useCallback(async () => {
    const filters: FilterParams = {};
    if (effectiveSearch) {
      filters.search = effectiveSearch;
    }
    if (showUnpaidOnly) {
      filters.unpaid_only = true;
    }
    if (showWithoutStatementOnly) {
      filters.without_statement = true;
    }
    if (showNonZeroBalanceOnly) {
      filters.paid_balance_not_zero = true;
    }
    if (recordTypeFilter !== 'all') {
      filters.record_type = recordTypeFilter;
    }
    let page = 1;
    const pageSize = 200;
    const collected: FinancialRecord[] = [];

    setIsAllRecordsLoading(true);
    try {
      while (true) {
        const payload = await fetchFinancialRecordsWithPagination({
          ...filters,
          page,
          page_size: pageSize,
        });
        collected.push(...payload.results);
        if (!payload.next) {
          break;
        }
        page += 1;
      }
      setAllRecords(collected);
    } finally {
      setIsAllRecordsLoading(false);
    }
  }, [
    effectiveSearch,
    recordTypeFilter,
    showNonZeroBalanceOnly,
    showUnpaidOnly,
    showWithoutStatementOnly,
  ]);

  useEffect(() => {
    if (viewMode !== 'all') {
      return;
    }
    void loadAllRecords();
  }, [loadAllRecords, viewMode]);

  const loadStatementDriveFiles = useCallback(async (statementId: string) => {
    setStatementDriveLoading(true);
    try {
      const { files, folderId } = await fetchStatementDriveFiles(statementId);
      setStatementDriveFiles(files);
      setStatementDriveError(null);
      if (folderId !== undefined) {
        setStatementDriveFolderIds((prev) => ({
          ...prev,
          [statementId]: folderId,
        }));
      }
    } catch (error) {
      setStatementDriveFiles([]);
      setStatementDriveError(formatErrorMessage(error, 'Не удалось загрузить файлы ведомости.'));
    } finally {
      setStatementDriveLoading(false);
    }
  }, []);

  const statementRows = useMemo<IncomeExpenseRow[]>(() => {
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

  const allRows = useMemo<IncomeExpenseRow[]>(() => {
    const result: IncomeExpenseRow[] = [];
    allRecords.forEach((record) => {
      const payment = paymentsById.get(record.paymentId);
      if (!payment) {
        return;
      }
      const amount = Number(record.amount);
      if (!Number.isFinite(amount) || amount === 0) {
        return;
      }
      const paidBalanceValue = record.paymentPaidBalance;
      const paidBalance = paidBalanceValue ? Number(paidBalanceValue) : undefined;
      const paidEntries =
        record.paymentPaidEntries?.map((entry) => ({
          amount: entry.amount,
          date: entry.date,
        })) ?? [];
      result.push({
        key: `${payment.id}-${record.id}`,
        payment,
        recordId: record.id,
        statementId: record.statementId,
        recordAmount: amount,
        paymentPaidBalance: Number.isFinite(paidBalance) ? paidBalance : undefined,
        paymentPaidEntries: paidEntries,
        recordDate: record.date ?? null,
        recordDescription: record.description,
        recordSource: record.source,
        recordNote: record.note,
      });
    });
    return result;
  }, [allRecords, paymentsById]);

  const filteredRows = useMemo(() => {
    if (viewMode === 'statements' && !selectedStatementId) {
      return [];
    }
    const result =
      viewMode === 'all'
        ? [...allRows]
        : statementRows.filter((row) => row.statementId === selectedStatementId);
    result.sort((a, b) => {
      const aTime = a.recordDate ? new Date(a.recordDate).getTime() : 0;
      const bTime = b.recordDate ? new Date(b.recordDate).getTime() : 0;
      return bTime - aTime;
    });
    return result;
  }, [allRows, selectedStatementId, statementRows, viewMode]);

  const handleOpenDeal = useCallback(
    (dealId: string | undefined) => {
      if (!dealId) {
        return;
      }
      if (onDealPreview) {
        onDealPreview(dealId);
        return;
      }
      onDealSelect?.(dealId);
      navigate('/deals');
    },
    [navigate, onDealPreview, onDealSelect],
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
    [onUpdateFinancialRecord],
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
    [amountDrafts, onUpdateFinancialRecord],
  );

  const selectedStatement = selectedStatementId
    ? statementsById.get(selectedStatementId)
    : undefined;
  const isSelectedStatementPaid = selectedStatement?.status === 'paid';
  const selectedStatementTypeLabel = selectedStatement
    ? selectedStatement.statementType === 'income'
      ? 'Доходы'
      : 'Расходы'
    : '';
  const selectedStatementStatusLabel = selectedStatement
    ? selectedStatement.status === 'paid'
      ? 'Выплачена'
      : 'Черновик'
    : '';
  const selectedStatementPaidAt = selectedStatement?.paidAt
    ? formatDateRu(selectedStatement.paidAt)
    : null;
  const selectedStatementDriveFolderId = selectedStatement
    ? (statementDriveFolderIds[selectedStatement.id] ?? selectedStatement.driveFolderId ?? null)
    : null;
  const statementDriveFolderLink = buildDriveFolderLink(selectedStatementDriveFolderId);
  const attachStatement =
    viewMode === 'all'
      ? targetStatementId
        ? statementsById.get(targetStatementId)
        : undefined
      : selectedStatement;
  const isAttachStatementPaid = attachStatement?.status === 'paid';

  useEffect(() => {
    if (viewMode !== 'statements' || !selectedStatement) {
      setStatementDriveFiles([]);
      setStatementDriveError(null);
      return;
    }
    void loadStatementDriveFiles(selectedStatement.id);
  }, [loadStatementDriveFiles, selectedStatement, viewMode]);

  const canAttachRow = useCallback(
    (row: IncomeExpenseRow) => {
      if (!attachStatement) {
        return false;
      }
      if (row.statementId && row.statementId !== attachStatement.id) {
        return false;
      }
      const isIncome = row.recordAmount > 0;
      if (attachStatement.statementType === 'income' && !isIncome) {
        return false;
      }
      if (attachStatement.statementType === 'expense' && isIncome) {
        return false;
      }
      return true;
    },
    [attachStatement],
  );

  const toggleRecordSelection = useCallback(
    (row: IncomeExpenseRow) => {
      if (!attachStatement || !canAttachRow(row)) {
        return;
      }
      setSelectedRecordIds((prev) =>
        prev.includes(row.recordId)
          ? prev.filter((id) => id !== row.recordId)
          : [...prev, row.recordId],
      );
    },
    [attachStatement, canAttachRow],
  );

  const handleAttachSelected = useCallback(async () => {
    if (!attachStatement || !onUpdateStatement || !selectedRecordIds.length) {
      return;
    }
    await onUpdateStatement(attachStatement.id, {
      recordIds: selectedRecordIds,
    });
    setSelectedRecordIds([]);
  }, [attachStatement, onUpdateStatement, selectedRecordIds]);

  const handleRemoveSelected = useCallback(async () => {
    if (!selectedStatement || !onRemoveStatementRecords || !selectedRecordIds.length) {
      return;
    }
    await onRemoveStatementRecords(selectedStatement.id, selectedRecordIds);
    setSelectedRecordIds([]);
  }, [onRemoveStatementRecords, selectedRecordIds, selectedStatement]);

  const handleStatementDriveUpload = useCallback(
    async (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      if (!file || !selectedStatement) {
        return;
      }
      setStatementDriveUploading(true);
      try {
        await uploadStatementDriveFile(selectedStatement.id, file);
        await loadStatementDriveFiles(selectedStatement.id);
      } catch (error) {
        setStatementDriveError(formatErrorMessage(error, 'Не удалось загрузить файл.'));
      } finally {
        setStatementDriveUploading(false);
        event.target.value = '';
      }
    },
    [loadStatementDriveFiles, selectedStatement],
  );

  const handleStatementDriveDelete = useCallback(
    async (file: DriveFile) => {
      if (!selectedStatement || file.isFolder) {
        return;
      }
      const shouldDelete = window.confirm(`Удалить файл "${file.name}"?`);
      if (!shouldDelete) {
        return;
      }
      setStatementDriveTrashing(true);
      try {
        await trashStatementDriveFiles(selectedStatement.id, [file.id]);
        await loadStatementDriveFiles(selectedStatement.id);
      } catch (error) {
        setStatementDriveError(formatErrorMessage(error, 'Не удалось удалить файл.'));
      } finally {
        setStatementDriveTrashing(false);
      }
    },
    [loadStatementDriveFiles, selectedStatement],
  );

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
    await onUpdateStatement(editingStatement.id, {
      name: editStatementForm.name.trim(),
      statementType: editStatementForm.statementType,
      status: editStatementForm.status,
      counterparty: editStatementForm.counterparty.trim(),
      comment: editStatementForm.comment.trim(),
      paidAt: editStatementForm.paidAt || null,
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

  const handleMarkPaidClick = useCallback(() => {
    if (!selectedStatement || isSelectedStatementPaid) {
      return;
    }
    if (!selectedStatement.paidAt) {
      setMissingPaidAtStatement(selectedStatement);
      return;
    }
    setPayingStatement(selectedStatement);
  }, [isSelectedStatementPaid, selectedStatement]);

  const handleMarkPaidConfirm = useCallback(async () => {
    if (!payingStatement || !onMarkStatementPaid) {
      return;
    }
    await onMarkStatementPaid(payingStatement.id);
    setPayingStatement(null);
  }, [onMarkStatementPaid, payingStatement]);

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
              <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-4 bg-white">
                <div className="space-y-1">
                  <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Ведомости</p>
                  <p className="text-sm font-semibold text-slate-900">Всего: {statements.length}</p>
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
              <div className="max-h-[360px] overflow-y-auto bg-white">
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
                      const statusLabel = statement.status === 'paid' ? 'Выплачена' : 'Черновик';
                      const typeLabel = statement.statementType === 'income' ? 'Доходы' : 'Расходы';

                      return (
                        <li
                          key={statement.id}
                          className={`border-l-4 transition-colors ${
                            isActive
                              ? 'bg-sky-50 border-sky-500'
                              : 'border-transparent hover:bg-slate-50/80 hover:border-sky-500 even:bg-slate-50/40'
                          }`}
                        >
                          <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
                            <button
                              type="button"
                              onClick={() => setSelectedStatementId(statement.id)}
                              className="flex flex-1 flex-wrap items-center justify-between gap-3 text-left"
                            >
                              <div className="space-y-1">
                                <p
                                  className={`text-sm font-semibold ${
                                    statement.status !== 'paid'
                                      ? 'text-slate-900'
                                      : statement.statementType === 'income'
                                        ? 'text-emerald-700'
                                        : 'text-rose-700'
                                  }`}
                                >
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
                                <p className="text-xs text-slate-500">Записей: {recordsCount}</p>
                              </div>
                            </button>
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
          {viewMode === 'statements' && (
            <div className="app-panel-muted px-4 py-2">
              <div className="flex items-center gap-4">
                <span className="text-xs uppercase tracking-[0.2em] text-slate-400">
                  Выбранная ведомость
                </span>
                <div className="h-px flex-1 bg-slate-200" />
              </div>
            </div>
          )}
          <div
            role="tabpanel"
            id="financial-tabpanel-statements"
            aria-labelledby="financial-tab-statements"
            tabIndex={0}
            className="outline-none"
            hidden={viewMode !== 'statements'}
          >
            <div className="app-panel-muted p-3 shadow-none">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div className="space-y-2">
                  <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Ведомость</p>
                  <p className="text-lg font-semibold text-slate-900">
                    {selectedStatement ? selectedStatement.name : 'Ведомость не выбрана'}
                  </p>
                  {selectedStatement ? (
                    <p className="text-xs text-slate-500">
                      {selectedStatementTypeLabel} · {selectedStatementStatusLabel}
                      {selectedStatement.counterparty ? ` · ${selectedStatement.counterparty}` : ''}
                      {selectedStatementPaidAt ? ` · Выплата ${selectedStatementPaidAt}` : ''}
                    </p>
                  ) : (
                    <p className="text-sm text-slate-500">Выберите ведомость из списка выше.</p>
                  )}
                  {selectedStatement && selectedStatement.status === 'paid' && (
                    <p className="text-xs text-rose-600">
                      Выплаченная ведомость недоступна для редактирования и удаления.
                    </p>
                  )}
                </div>
                {selectedStatement && (
                  <div className="flex flex-wrap items-center justify-end gap-3">
                    <div className="flex flex-wrap items-center gap-2">
                      {onUpdateStatement && (
                        <button
                          type="button"
                          onClick={() => handleEditStatementOpen(selectedStatement)}
                          disabled={isSelectedStatementPaid}
                          className="btn btn-primary"
                        >
                          Редактировать
                        </button>
                      )}
                      {onDeleteStatement && (
                        <button
                          type="button"
                          onClick={() => setDeletingStatement(selectedStatement)}
                          disabled={isSelectedStatementPaid}
                          className="btn btn-danger"
                        >
                          Удалить
                        </button>
                      )}
                      {selectedRecordIds.length > 0 && (
                        <button
                          type="button"
                          onClick={() => void handleRemoveSelected()}
                          className="btn btn-danger"
                          disabled={
                            !selectedRecordIds.length ||
                            !onRemoveStatementRecords ||
                            isSelectedStatementPaid
                          }
                        >
                          Убрать из ведомости
                        </button>
                      )}
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        onClick={handleMarkPaidClick}
                        disabled={isSelectedStatementPaid || !onMarkStatementPaid}
                        className="btn btn-success"
                      >
                        {selectedStatement?.statementType === 'income' ? 'Получено!' : 'Оплачено!'}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
            {selectedStatement && (
              <div className="border-t border-slate-200 bg-white px-4 py-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-xs uppercase tracking-[0.2em] text-slate-400">
                      Файлы ведомости
                    </p>
                    <p className="text-xs text-slate-500">Google Drive</p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    {statementDriveFolderLink ? (
                      <a
                        href={statementDriveFolderLink}
                        target="_blank"
                        rel="noreferrer"
                        className="btn btn-secondary btn-sm rounded-xl"
                      >
                        Открыть папку
                      </a>
                    ) : (
                      <span className="text-xs text-slate-400">Папка создаётся...</span>
                    )}
                    <button
                      type="button"
                      onClick={() => void loadStatementDriveFiles(selectedStatement.id)}
                      className="btn btn-secondary btn-sm rounded-xl"
                      disabled={isStatementDriveLoading}
                    >
                      {isStatementDriveLoading ? 'Обновляю...' : 'Обновить'}
                    </button>
                    <label
                      className={`btn btn-secondary btn-sm rounded-xl ${
                        isStatementDriveUploading ? 'opacity-70' : ''
                      }`}
                    >
                      <input
                        type="file"
                        onChange={handleStatementDriveUpload}
                        disabled={isStatementDriveUploading}
                        className="hidden"
                      />
                      {isStatementDriveUploading ? 'Загрузка...' : 'Загрузить файл'}
                    </label>
                  </div>
                </div>
                {statementDriveError && (
                  <div className="app-alert app-alert-danger mt-3">{statementDriveError}</div>
                )}
                <div className="mt-4">
                  {isStatementDriveLoading ? (
                    <PanelMessage>Загрузка файлов...</PanelMessage>
                  ) : statementDriveFiles.length === 0 ? (
                    <PanelMessage>Файлов пока нет</PanelMessage>
                  ) : (
                    <ul className="divide-y divide-slate-200 rounded-lg border border-slate-200">
                      {statementDriveFiles.map((file) => {
                        const fileDate = formatDriveDate(file.modifiedAt ?? file.createdAt);
                        const fileSize = formatDriveFileSize(file.size);
                        const canDelete =
                          !file.isFolder && !isStatementDriveTrashing && !isStatementDriveLoading;
                        return (
                          <li
                            key={file.id}
                            className="flex flex-wrap items-center justify-between gap-3 px-3 py-2"
                          >
                            <div className="flex min-w-0 items-center gap-3">
                              <span className="text-lg" aria-hidden="true">
                                {getDriveItemIcon(file.isFolder)}
                              </span>
                              <div className="min-w-0">
                                {file.webViewLink ? (
                                  <a
                                    href={file.webViewLink}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="truncate text-sm font-semibold text-slate-700 hover:text-slate-900"
                                  >
                                    {file.name}
                                  </a>
                                ) : (
                                  <p className="truncate text-sm font-semibold text-slate-700">
                                    {file.name}
                                  </p>
                                )}
                                <p className="text-xs text-slate-500">
                                  {fileSize} · {fileDate}
                                </p>
                              </div>
                            </div>
                            <button
                              type="button"
                              onClick={() => void handleStatementDriveDelete(file)}
                              disabled={!canDelete}
                              className={`text-xs font-semibold ${
                                canDelete ? 'text-rose-600 hover:text-rose-700' : 'text-slate-300'
                              }`}
                            >
                              Удалить
                            </button>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </div>
              </div>
            )}
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
              <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto">
                <div className="w-full max-w-sm">
                  <label htmlFor="allFinancialSearch" className="sr-only">
                    Поиск по записям
                  </label>
                  <input
                    id="allFinancialSearch"
                    type="search"
                    value={allRecordsSearch}
                    onChange={(event) => setAllRecordsSearch(event.target.value)}
                    placeholder="Поиск по записям"
                    className="field field-input"
                  />
                </div>
                <label className="flex items-center gap-2 text-xs font-semibold text-slate-500">
                  <input
                    type="checkbox"
                    checked={showUnpaidOnly}
                    onChange={(event) => setShowUnpaidOnly(event.target.checked)}
                    className="check"
                  />
                  Только не оплаченные
                </label>
                <label className="flex items-center gap-2 text-xs font-semibold text-slate-500">
                  <input
                    type="checkbox"
                    checked={showWithoutStatementOnly}
                    onChange={(event) => setShowWithoutStatementOnly(event.target.checked)}
                    className="check"
                  />
                  Только не в ведомостях
                </label>
                <label className="flex items-center gap-2 text-xs font-semibold text-slate-500">
                  <input
                    type="checkbox"
                    checked={showNonZeroBalanceOnly}
                    onChange={(event) => setShowNonZeroBalanceOnly(event.target.checked)}
                    className="check"
                  />
                  Скрыть нулевой итог по платежу
                </label>
                <select
                  value={recordTypeFilter}
                  onChange={(event) =>
                    setRecordTypeFilter(event.target.value as 'all' | 'income' | 'expense')
                  }
                  className="field field-input h-10 min-w-[200px] text-sm"
                >
                  <option value="all">Все записи</option>
                  <option value="income">Только доходы</option>
                  <option value="expense">Только расходы</option>
                </select>
                <select
                  value={targetStatementId}
                  onChange={(event) => setTargetStatementId(event.target.value)}
                  className="field field-input h-10 min-w-[220px] text-sm"
                >
                  <option value="">Выберите ведомость</option>
                  {statements.map((statement) => (
                    <option key={statement.id} value={statement.id}>
                      {statement.statementType === 'income' ? 'Доходы' : 'Расходы'} ·{' '}
                      {statement.name}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={() => void handleAttachSelected()}
                  className="btn btn-primary btn-sm rounded-xl"
                  disabled={
                    !selectedRecordIds.length ||
                    !onUpdateStatement ||
                    !attachStatement ||
                    isAttachStatementPaid
                  }
                >
                  Добавить выбранные
                </button>
              </div>
            </div>
          </div>
          {viewMode === 'statements' && !selectedStatement ? (
            <div className="bg-white px-6 py-10 text-center">
              <PanelMessage>Выберите ведомость в списке выше.</PanelMessage>
            </div>
          ) : (
            <div className="overflow-x-auto bg-white">
              <table
                className="deals-table min-w-full border-collapse text-left text-sm"
                aria-label="Доходы и расходы"
              >
                <thead className={TABLE_THEAD_CLASS}>
                  <tr>
                    <TableHeadCell padding="sm" className="w-10" />
                    <TableHeadCell className="min-w-[220px]">ФИО клиента</TableHeadCell>
                    <TableHeadCell className="min-w-[140px]">Номер полиса</TableHeadCell>
                    <TableHeadCell className="min-w-[160px]">Полис</TableHeadCell>
                    <TableHeadCell className="min-w-[160px]">Канал продаж</TableHeadCell>
                    <TableHeadCell className="min-w-[160px]">Платеж</TableHeadCell>
                    {viewMode === 'all' && (
                      <TableHeadCell className="min-w-[150px]">Итог по платежу</TableHeadCell>
                    )}
                    <TableHeadCell className="min-w-[160px]">Расход/доход</TableHeadCell>
                    <TableHeadCell className="min-w-[160px]">Дата оплаты</TableHeadCell>
                  </tr>
                </thead>
                <tbody className="bg-white">
                  {filteredRows.map((row) => {
                    const payment = row.payment;
                    const policyNumber =
                      payment.policyNumber ??
                      policiesById.get(payment.policyId ?? '')?.number ??
                      '-';
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
                    const paymentActualDate = payment.actualDate
                      ? formatDateRu(payment.actualDate)
                      : null;
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
                    const paymentBalance = row.paymentPaidBalance;
                    const paymentBalanceLabel =
                      paymentBalance === undefined ? '—' : formatCurrencyRu(paymentBalance);
                    const paymentEntries = (row.paymentPaidEntries ?? []).slice().sort((a, b) => {
                      const aTime = new Date(a.date).getTime();
                      const bTime = new Date(b.date).getTime();
                      return bTime - aTime;
                    });
                    const recordNotes = [row.recordDescription, row.recordSource, row.recordNote]
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
                    const isSelectable = attachStatement ? canAttachRow(row) : false;
                    const isSelected = selectedRecordIds.includes(row.recordId);

                    return (
                      <tr key={row.key} className={TABLE_ROW_CLASS}>
                        <td className="border border-slate-200 px-3 py-3 text-center">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => toggleRecordSelection(row)}
                            disabled={!isSelectable || isAttachStatementPaid}
                            className="check"
                            title={
                              !attachStatement
                                ? 'Выберите ведомость для добавления записей'
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
                          <button
                            type="button"
                            className="link-action text-left"
                            onClick={async (event) => {
                              event.stopPropagation();
                              const value = policyNumber === '-' ? '' : policyNumber;
                              if (!value) {
                                return;
                              }
                              const copied = await copyToClipboard(value);
                              if (copied) {
                                addNotification('Скопировано', 'success', 1600);
                              }
                            }}
                            aria-label="Скопировать номер полиса"
                            title="Скопировать номер полиса"
                          >
                            {policyNumber}
                          </button>
                        </td>
                        <td className={`${TABLE_CELL_CLASS_LG} text-slate-700`}>{policyType}</td>
                        <td className={`${TABLE_CELL_CLASS_LG} text-slate-700`}>
                          {salesChannelLabel}
                        </td>
                        <td className={`${TABLE_CELL_CLASS_LG} text-slate-700`}>
                          <p className="text-base font-semibold">
                            {formatCurrencyRu(payment.amount)}
                          </p>
                          {paymentActualDate ? (
                            <p className="text-xs text-slate-500 mt-1">
                              Оплата: {paymentActualDate}
                            </p>
                          ) : paymentScheduledDate ? (
                            <p className="text-xs text-slate-500 mt-1">
                              План: {paymentScheduledDate}
                            </p>
                          ) : (
                            <p className="text-xs text-slate-500 mt-1">Оплата: —</p>
                          )}
                        </td>
                        {viewMode === 'all' && (
                          <td className={`${TABLE_CELL_CLASS_LG} text-slate-700`}>
                            <p className="text-base font-semibold">{paymentBalanceLabel}</p>
                            {paymentEntries.length ? (
                              <div className="mt-1 space-y-1 text-xs text-slate-500">
                                {paymentEntries.map((entry, index) => {
                                  const entryAmount = Number(entry.amount);
                                  const entryLabel = Number.isFinite(entryAmount)
                                    ? formatCurrencyRu(Math.abs(entryAmount))
                                    : entry.amount;
                                  const entryDate = formatDateRu(entry.date);
                                  const entryType = entryAmount >= 0 ? 'Доход' : 'Расход';
                                  return (
                                    <p key={`${row.payment.id}-${index}`}>
                                      {entryType} {entryLabel} · {entryDate}
                                    </p>
                                  );
                                })}
                              </div>
                            ) : (
                              <p className="text-xs text-slate-500 mt-1">Операций нет</p>
                            )}
                          </td>
                        )}
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
                              onChange={(event) => handleRecordDateChange(row, event.target.value)}
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
                        colSpan={viewMode === 'all' ? 9 : 8}
                        className="border border-slate-200 px-6 py-10 text-center text-slate-600"
                      >
                        <PanelMessage>
                          {viewMode === 'all' && isAllRecordsLoading
                            ? 'Загрузка записей...'
                            : viewMode === 'statements' && selectedStatement
                              ? 'Записей в ведомости пока нет'
                              : 'Записей пока нет'}
                        </PanelMessage>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
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
                После пометки ведомости как «Выплачена» редактирование и удаление будут недоступны.
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
            Ведомость <span className="font-bold">{deletingStatement.name}</span> будет удалена. Все
            записи отвяжутся от ведомости.
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
      {missingPaidAtStatement && (
        <Modal
          title="Нужна дата оплаты"
          onClose={() => setMissingPaidAtStatement(null)}
          closeOnOverlayClick={false}
        >
          <p className="text-sm text-slate-700">
            Укажите дату оплаты ведомости в карточке редактирования, затем снова нажмите
            «Оплачено!».
          </p>
          <div className="mt-6 flex justify-end gap-3">
            <button
              type="button"
              onClick={() => setMissingPaidAtStatement(null)}
              className="btn btn-secondary rounded-xl"
            >
              Понял
            </button>
          </div>
        </Modal>
      )}
      {payingStatement && (
        <Modal
          title="Отметить как оплачено"
          onClose={() => setPayingStatement(null)}
          closeOnOverlayClick={false}
        >
          <p className="text-sm text-slate-700">
            После подтверждения ведомость станет недоступной для редактирования и удаления. Дата
            оплаты будет проставлена всем записям ведомости.
          </p>
          <div className="mt-6 flex justify-end gap-3">
            <button
              type="button"
              onClick={() => setPayingStatement(null)}
              className="btn btn-secondary rounded-xl"
            >
              Отмена
            </button>
            <button
              type="button"
              onClick={() => void handleMarkPaidConfirm()}
              className="btn btn-primary rounded-xl"
            >
              Оплачено!
            </button>
          </div>
        </Modal>
      )}
    </section>
  );
};
