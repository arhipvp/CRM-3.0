import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import type { DriveFile, FinancialRecord, Payment, Policy, Statement } from '../../types';
import type { FilterParams } from '../../api';
import {
  fetchFinancialRecordsWithPagination,
  fetchStatementDriveFiles,
  downloadStatementDriveFiles,
  exportStatementXlsx,
  trashStatementDriveFiles,
  uploadStatementDriveFile,
} from '../../api';
import type { AddFinancialRecordFormValues } from '../forms/AddFinancialRecordForm';
import { PanelMessage } from '../PanelMessage';
import { formatCurrencyRu, formatDateRu } from '../../utils/formatting';
import { useDebouncedValue } from '../../hooks/useDebouncedValue';
import { formatErrorMessage } from '../../utils/formatErrorMessage';
import { buildDriveFolderLink } from '../../utils/links';
import { useConfirm } from '../../hooks/useConfirm';
import { CreateStatementModal } from './commissions/CreateStatementModal';
import { DeleteStatementModal } from './commissions/DeleteStatementModal';
import { EditStatementModal } from './commissions/EditStatementModal';
import { AllRecordsPanel } from './commissions/AllRecordsPanel';
import { RecordsTable } from './commissions/RecordsTable';
import { StatementFilesTab } from './commissions/StatementFilesTab';
import type { AllRecordsSortKey, AmountDraft, IncomeExpenseRow } from './commissions/RecordsTable';

interface CommissionsViewProps {
  payments: Payment[];
  financialRecords?: FinancialRecord[];
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
      counterparty: string;
      comment: string;
      paidAt: string | null;
      recordIds: string[];
    }>,
  ) => Promise<Statement>;
}

const MOJIBAKE_RE = /Ð/;

const normalizeText = (value?: string | null) => {
  if (!value) {
    return '';
  }
  if (!MOJIBAKE_RE.test(value) || typeof TextDecoder === 'undefined') {
    return value;
  }
  try {
    const bytes = Uint8Array.from(value, (char) => char.charCodeAt(0));
    const decoded = new TextDecoder('utf-8').decode(bytes);
    return MOJIBAKE_RE.test(decoded) ? value : decoded;
  } catch {
    return value;
  }
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
  onCreateStatement,
  onUpdateStatement,
}) => {
  const navigate = useNavigate();
  const { confirm, ConfirmDialogRenderer } = useConfirm();

  const [amountDrafts, setAmountDrafts] = useState<Record<string, AmountDraft>>({});
  const [selectedStatementId, setSelectedStatementId] = useState<string | null>(null);
  const [selectedRecordIds, setSelectedRecordIds] = useState<string[]>([]);
  const [viewMode, setViewMode] = useState<'all' | 'statements'>('all');
  const [statementTab, setStatementTab] = useState<'records' | 'files'>('records');
  const [allRecordsSearch, setAllRecordsSearch] = useState('');
  const [showUnpaidPayments, setShowUnpaidPayments] = useState(false);
  const [showStatementRecords, setShowStatementRecords] = useState(false);
  // По умолчанию в "Все записи" показываем только неоплаченные (record.date is null).
  // Галка "Показать оплаченные..." расширяет список до всех записей.
  const [showPaidRecords, setShowPaidRecords] = useState(false);
  const [showZeroSaldo, setShowZeroSaldo] = useState(false);
  const [recordTypeFilter, setRecordTypeFilter] = useState<'all' | 'income' | 'expense'>('all');
  const [showPaidStatements, setShowPaidStatements] = useState(false);
  const [recordAmountSort, setRecordAmountSort] = useState<'none' | 'asc' | 'desc'>('none');
  const [allRecordsSortKey, setAllRecordsSortKey] = useState<AllRecordsSortKey>('none');
  const [allRecordsSortDirection, setAllRecordsSortDirection] = useState<'asc' | 'desc'>('asc');
  const [targetStatementId, setTargetStatementId] = useState('');
  const [allRecords, setAllRecords] = useState<FinancialRecord[]>([]);
  const [isAllRecordsLoading, setIsAllRecordsLoading] = useState(false);
  const [isAllRecordsLoadingMore, setIsAllRecordsLoadingMore] = useState(false);
  const [allRecordsError, setAllRecordsError] = useState<string | null>(null);
  const [allRecordsHasMore, setAllRecordsHasMore] = useState(false);
  const [allRecordsTotalCount, setAllRecordsTotalCount] = useState(0);
  const [, setAllRecordsPage] = useState(1);
  const allRecordsPageRef = useRef(1);
  const [isStatementModalOpen, setStatementModalOpen] = useState(false);
  const [isStatementCreating, setIsStatementCreating] = useState(false);
  const [editingStatement, setEditingStatement] = useState<Statement | null>(null);
  const [deletingStatement, setDeletingStatement] = useState<Statement | null>(null);
  // paidAt выставляется вручную в редактировании ведомости; выплата определяется по paidAt.
  const [editStatementForm, setEditStatementForm] = useState({
    name: '',
    statementType: 'income' as Statement['statementType'],
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
  const [selectedStatementDriveFileIds, setSelectedStatementDriveFileIds] = useState<string[]>([]);
  const [isStatementDriveLoading, setStatementDriveLoading] = useState(false);
  const [isStatementDriveUploading, setStatementDriveUploading] = useState(false);
  const [isStatementDriveTrashing, setStatementDriveTrashing] = useState(false);
  const [isStatementDriveDownloading, setStatementDriveDownloading] = useState(false);
  const [statementDriveError, setStatementDriveError] = useState<string | null>(null);
  const [statementDriveTrashMessage, setStatementDriveTrashMessage] = useState<string | null>(null);
  const [statementDriveDownloadMessage, setStatementDriveDownloadMessage] = useState<string | null>(
    null,
  );
  const [isStatementExporting, setIsStatementExporting] = useState(false);
  const [statementExportError, setStatementExportError] = useState<string | null>(null);
  const allRecordsRequestRef = useRef(0);
  const selectAllRef = useRef<HTMLInputElement | null>(null);

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
  // Поиск должен фильтровать даже по коротким строкам; иначе при "не нашлось"
  // пользователь видит полный список, что выглядит как баг.
  const effectiveSearch = debouncedSearch;

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

  const isRecordTypeLocked = viewMode === 'all' && Boolean(targetStatementId);
  useEffect(() => {
    if (viewMode !== 'all') {
      return;
    }
    if (!targetStatementId) {
      setRecordTypeFilter('all');
      return;
    }
    const statement = statementsById.get(targetStatementId);
    if (!statement) {
      setRecordTypeFilter('all');
      return;
    }
    setRecordTypeFilter(statement.statementType === 'income' ? 'income' : 'expense');
  }, [statementsById, targetStatementId, viewMode]);

  useEffect(() => {
    setStatementTab('records');
    setSelectedStatementDriveFileIds([]);
    setStatementDriveTrashMessage(null);
    setStatementDriveDownloadMessage(null);
    setStatementExportError(null);
    setIsStatementExporting(false);
  }, [selectedStatementId]);

  useEffect(() => {
    if (viewMode !== 'statements') {
      setStatementTab('records');
    }
  }, [viewMode]);

  useEffect(() => {
    if (!selectedStatementDriveFileIds.length) {
      return;
    }
    const existingIds = new Set(statementDriveFiles.map((file) => file.id));
    setSelectedStatementDriveFileIds((prev) => {
      const filtered = prev.filter((id) => existingIds.has(id));
      return filtered.length === prev.length ? prev : filtered;
    });
  }, [selectedStatementDriveFileIds.length, statementDriveFiles]);

  const loadAllRecords = useCallback(
    async (mode: 'reset' | 'more') => {
      allRecordsRequestRef.current += 1;
      const requestId = allRecordsRequestRef.current;
      const filters: FilterParams = {};
      if (effectiveSearch) {
        filters.search = effectiveSearch;
      }
      if (!showUnpaidPayments) {
        filters.payment_paid = true;
      }
      if (!showStatementRecords) {
        filters.without_statement = true;
      }
      if (!showPaidRecords) {
        filters.unpaid_only = true;
      }
      if (!showZeroSaldo) {
        filters.paid_balance_not_zero = true;
      }
      if (recordTypeFilter !== 'all') {
        filters.record_type = recordTypeFilter;
      }
      if (allRecordsSortKey !== 'none') {
        const directionPrefix = allRecordsSortDirection === 'desc' ? '-' : '';
        if (allRecordsSortKey === 'payment') {
          filters.ordering = `${directionPrefix}payment_is_paid,-payment_sort_date,-created_at`;
        } else if (allRecordsSortKey === 'saldo') {
          filters.ordering = `${directionPrefix}payment_paid_balance,-payment_sort_date,-created_at`;
        } else if (allRecordsSortKey === 'comment') {
          filters.ordering = `${directionPrefix}record_comment_sort,-payment_sort_date,-created_at`;
        } else if (allRecordsSortKey === 'amount') {
          filters.ordering = `${directionPrefix}amount,-payment_sort_date,-created_at`;
        }
      }
      const nextPage = mode === 'more' ? allRecordsPageRef.current + 1 : 1;
      if (mode === 'reset') {
        setIsAllRecordsLoading(true);
        setAllRecordsError(null);
      } else {
        setIsAllRecordsLoadingMore(true);
      }

      try {
        const payload = await fetchFinancialRecordsWithPagination({
          ...filters,
          page: nextPage,
        });
        if (requestId !== allRecordsRequestRef.current) {
          return;
        }
        setAllRecordsTotalCount(payload.count || 0);
        setAllRecordsHasMore(Boolean(payload.next));
        setAllRecordsPage(nextPage);
        allRecordsPageRef.current = nextPage;
        setAllRecords((prev) =>
          mode === 'more' ? [...prev, ...payload.results] : payload.results,
        );
      } catch (error) {
        if (requestId !== allRecordsRequestRef.current) {
          return;
        }
        if (mode === 'reset') {
          setAllRecords([]);
        }
        setAllRecordsHasMore(false);
        setAllRecordsError(formatErrorMessage(error, 'Не удалось загрузить финансовые записи.'));
      } finally {
        if (requestId === allRecordsRequestRef.current) {
          setIsAllRecordsLoading(false);
          setIsAllRecordsLoadingMore(false);
        }
      }
    },
    [
      effectiveSearch,
      allRecordsSortDirection,
      allRecordsSortKey,
      recordTypeFilter,
      showPaidRecords,
      showZeroSaldo,
      showStatementRecords,
      showUnpaidPayments,
    ],
  );

  useEffect(() => {
    if (viewMode !== 'all') {
      return;
    }
    void loadAllRecords('reset');
  }, [loadAllRecords, viewMode]);

  // Не подмешиваем финансовые записи из props: "Все записи" должны идти строго с сервера,
  // иначе ломается сортировка и пагинация.

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

  const handleExportStatement = useCallback(async () => {
    const statement = selectedStatementId ? statementsById.get(selectedStatementId) : undefined;
    if (!statement) {
      return;
    }
    setIsStatementExporting(true);
    setStatementExportError(null);
    try {
      const file = await exportStatementXlsx(statement.id);
      setStatementDriveDownloadMessage(`Файл сформирован: ${file.name}`);
      setStatementTab('files');
      await loadStatementDriveFiles(statement.id);
    } catch (error) {
      setStatementExportError(formatErrorMessage(error, 'Не удалось сформировать ведомость.'));
    } finally {
      setIsStatementExporting(false);
    }
  }, [loadStatementDriveFiles, selectedStatementId, statementsById]);

  const selectedStatement = selectedStatementId
    ? statementsById.get(selectedStatementId)
    : undefined;
  const isSelectedStatementPaid = Boolean(selectedStatement?.paidAt);
  const selectedStatementTypeLabel = selectedStatement
    ? selectedStatement.statementType === 'income'
      ? 'Доходы'
      : 'Расходы'
    : '';
  const selectedStatementStatusLabel = selectedStatement
    ? selectedStatement.paidAt
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
  const isAttachStatementPaid = Boolean(attachStatement?.paidAt);

  const sortedStatementDriveFiles = useMemo(() => {
    return [...statementDriveFiles].sort((a, b) => {
      const rawDateA = new Date(a.modifiedAt ?? a.createdAt ?? 0).getTime();
      const rawDateB = new Date(b.modifiedAt ?? b.createdAt ?? 0).getTime();
      const dateA = Number.isNaN(rawDateA) ? 0 : rawDateA;
      const dateB = Number.isNaN(rawDateB) ? 0 : rawDateB;
      if (dateA !== dateB) {
        return dateB - dateA;
      }
      if (a.isFolder !== b.isFolder) {
        return a.isFolder ? -1 : 1;
      }
      return a.name.localeCompare(b.name, 'ru-RU', { sensitivity: 'base' });
    });
  }, [statementDriveFiles]);

  const toggleStatementDriveFileSelection = useCallback((fileId: string) => {
    setSelectedStatementDriveFileIds((prev) =>
      prev.includes(fileId) ? prev.filter((id) => id !== fileId) : [...prev, fileId],
    );
  }, []);

  const handleTrashSelectedStatementDriveFiles = useCallback(async () => {
    if (!selectedStatement) {
      return;
    }
    if (!selectedStatementDriveFileIds.length) {
      setStatementDriveTrashMessage('Выберите хотя бы один файл для удаления.');
      return;
    }
    const confirmed = await confirm({
      title: 'Удалить файлы',
      message: `Удалить выбранные файлы (${selectedStatementDriveFileIds.length})?`,
      confirmText: 'Удалить',
      tone: 'danger',
    });
    if (!confirmed) {
      return;
    }
    setStatementDriveTrashing(true);
    setStatementDriveTrashMessage(null);
    try {
      await trashStatementDriveFiles(selectedStatement.id, selectedStatementDriveFileIds);
      setSelectedStatementDriveFileIds([]);
      await loadStatementDriveFiles(selectedStatement.id);
    } catch (error) {
      setStatementDriveTrashMessage(formatErrorMessage(error, 'Не удалось удалить файлы.'));
    } finally {
      setStatementDriveTrashing(false);
    }
  }, [confirm, loadStatementDriveFiles, selectedStatement, selectedStatementDriveFileIds]);

  const handleDownloadStatementDriveFiles = useCallback(
    async (fileIds?: string[]) => {
      if (!selectedStatement) {
        return;
      }
      const targetIds = fileIds?.length ? fileIds : selectedStatementDriveFileIds;
      if (!targetIds.length) {
        setStatementDriveDownloadMessage('Выберите хотя бы один файл для скачивания.');
        return;
      }
      setStatementDriveDownloading(true);
      setStatementDriveDownloadMessage(null);
      try {
        const { blob, filename } = await downloadStatementDriveFiles(
          selectedStatement.id,
          targetIds,
        );
        if (typeof window === 'undefined') {
          return;
        }
        const url = window.URL.createObjectURL(blob);
        const link = window.document.createElement('a');
        link.href = url;
        let resolvedFilename = filename;
        if (!resolvedFilename && targetIds.length === 1) {
          const targetFile = statementDriveFiles.find((file) => file.id === targetIds[0]);
          if (targetFile) {
            resolvedFilename = targetFile.name;
          }
        }
        link.download = resolvedFilename || 'files.zip';
        window.document.body.appendChild(link);
        link.click();
        link.remove();
        window.URL.revokeObjectURL(url);
      } catch (error) {
        setStatementDriveDownloadMessage(formatErrorMessage(error, 'Не удалось скачать файлы.'));
      } finally {
        setStatementDriveDownloading(false);
      }
    },
    [selectedStatement, selectedStatementDriveFileIds, statementDriveFiles],
  );

  const statementRows = useMemo<IncomeExpenseRow[]>(() => {
    const result: IncomeExpenseRow[] = [];
    payments.forEach((payment) => {
      const records = payment.financialRecords ?? [];
      const paidEntries = records
        .filter((record) => Boolean(record.date))
        .map((record) => ({
          amount: record.amount,
          date: record.date as string,
        }));
      const paidBalance = paidEntries.reduce((sum, entry) => {
        const value = Number(entry.amount);
        return Number.isFinite(value) ? sum + value : sum;
      }, 0);
      const paymentPaidBalance = Number.isFinite(paidBalance) ? paidBalance : undefined;

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
          paymentPaidBalance,
          paymentPaidEntries: paidEntries,
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
    // В режиме "Все записи" сортировка и пагинация должны соответствовать серверу.
    // Любая клиентская сортировка ломает порядок (особенно при "Показать ещё").
    if (viewMode === 'all') {
      return [...allRows];
    }

    if (!selectedStatementId) {
      return [];
    }

    const result = statementRows.filter((row) => row.statementId === selectedStatementId);
    const compareByDate = (a: IncomeExpenseRow, b: IncomeExpenseRow) => {
      const aTime = a.recordDate ? new Date(a.recordDate).getTime() : 0;
      const bTime = b.recordDate ? new Date(b.recordDate).getTime() : 0;
      return bTime - aTime;
    };

    if (recordAmountSort !== 'none') {
      result.sort((a, b) => {
        const aAmount = Number(a.recordAmount) || 0;
        const bAmount = Number(b.recordAmount) || 0;
        if (aAmount === bAmount) {
          return compareByDate(a, b);
        }
        return recordAmountSort === 'asc' ? aAmount - bAmount : bAmount - aAmount;
      });
    } else {
      result.sort(compareByDate);
    }
    return result;
  }, [allRows, recordAmountSort, selectedStatementId, statementRows, viewMode]);

  const toggleAmountSort = useCallback(() => {
    setRecordAmountSort((prev) => {
      if (prev === 'none') {
        return 'asc';
      }
      if (prev === 'asc') {
        return 'desc';
      }
      return 'none';
    });
  }, []);

  const getAmountSortIndicator = () => {
    if (recordAmountSort === 'asc') {
      return '↑';
    }
    if (recordAmountSort === 'desc') {
      return '↓';
    }
    return '↕';
  };

  const getAmountSortLabel = () => {
    if (recordAmountSort === 'asc') {
      return 'по возрастанию';
    }
    if (recordAmountSort === 'desc') {
      return 'по убыванию';
    }
    return 'не сортируется';
  };

  const toggleAllRecordsSort = useCallback(
    (key: AllRecordsSortKey) => {
      if (viewMode !== 'all') {
        return;
      }
      if (allRecordsSortKey !== key) {
        setAllRecordsSortKey(key);
        setAllRecordsSortDirection('asc');
        return;
      }
      if (allRecordsSortDirection === 'asc') {
        setAllRecordsSortDirection('desc');
        return;
      }
      setAllRecordsSortKey('none');
      setAllRecordsSortDirection('asc');
    },
    [allRecordsSortDirection, allRecordsSortKey, viewMode],
  );

  const getAllRecordsSortIndicator = (key: AllRecordsSortKey) => {
    if (viewMode !== 'all') {
      return '';
    }
    if (allRecordsSortKey !== key) {
      return '↕';
    }
    return allRecordsSortDirection === 'asc' ? '↑' : '↓';
  };

  const getAllRecordsSortLabel = (key: AllRecordsSortKey) => {
    if (viewMode !== 'all') {
      return '';
    }
    if (allRecordsSortKey !== key) {
      return 'не сортируется';
    }
    return allRecordsSortDirection === 'asc' ? 'по возрастанию' : 'по убыванию';
  };

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

  const getAbsoluteSaldoBase = useCallback((row: IncomeExpenseRow) => {
    const value = Number(row.paymentPaidBalance ?? 0);
    if (!Number.isFinite(value)) {
      return 0;
    }
    return Math.abs(value);
  }, []);

  const getPercentFromSaldo = useCallback(
    (row: IncomeExpenseRow, absoluteAmount: number) => {
      const base = getAbsoluteSaldoBase(row);
      if (!Number.isFinite(absoluteAmount) || base <= 0) {
        return '';
      }
      const percent = (Math.abs(absoluteAmount) / base) * 100;
      return percent.toFixed(2).replace(/\.?0+$/, '');
    },
    [getAbsoluteSaldoBase],
  );

  const handleRecordAmountChange = useCallback((recordId: string, value: string) => {
    setAmountDrafts((prev) => ({
      ...prev,
      [recordId]: { mode: prev[recordId]?.mode ?? 'rub', value },
    }));
  }, []);

  const toggleRecordAmountMode = useCallback(
    (row: IncomeExpenseRow) => {
      setAmountDrafts((prev) => {
        const current = prev[row.recordId];
        const currentMode: AmountDraft['mode'] = current?.mode ?? 'rub';
        const nextMode: AmountDraft['mode'] = currentMode === 'rub' ? 'percent' : 'rub';

        const base = getAbsoluteSaldoBase(row);
        const currentValue = current?.value;
        const currentNumber = currentValue !== undefined ? Number(currentValue) : NaN;

        if (nextMode === 'percent') {
          if (base <= 0) {
            return prev;
          }
          const absoluteAmount = Number.isFinite(currentNumber)
            ? currentNumber
            : Math.abs(row.recordAmount);
          return {
            ...prev,
            [row.recordId]: { mode: 'percent', value: getPercentFromSaldo(row, absoluteAmount) },
          };
        }

        if (currentMode === 'percent' && base > 0) {
          const percent = Number.isFinite(currentNumber) ? currentNumber : NaN;
          const absoluteAmount = Number.isFinite(percent) ? (base * percent) / 100 : NaN;
          if (Number.isFinite(absoluteAmount)) {
            return {
              ...prev,
              [row.recordId]: {
                mode: 'rub',
                value: absoluteAmount.toFixed(2).replace(/\.?0+$/, ''),
              },
            };
          }
        }

        return {
          ...prev,
          [row.recordId]: { mode: 'rub', value: Math.abs(row.recordAmount).toString() },
        };
      });
    },
    [getAbsoluteSaldoBase, getPercentFromSaldo],
  );

  const handleRecordAmountBlur = useCallback(
    async (row: IncomeExpenseRow) => {
      if (!onUpdateFinancialRecord) {
        return;
      }
      const draft = amountDrafts[row.recordId];
      if (!draft) {
        return;
      }
      const parsed = Number(draft.value);
      if (!Number.isFinite(parsed)) {
        return;
      }

      const absoluteAmount =
        draft.mode === 'percent'
          ? (() => {
              const base = getAbsoluteSaldoBase(row);
              if (base <= 0) {
                return NaN;
              }
              return (base * parsed) / 100;
            })()
          : parsed;

      if (!Number.isFinite(absoluteAmount)) {
        return;
      }
      const recordType: AddFinancialRecordFormValues['recordType'] =
        row.recordAmount >= 0 ? 'income' : 'expense';
      await onUpdateFinancialRecord(row.recordId, {
        paymentId: row.payment.id,
        recordType,
        amount: Math.abs(absoluteAmount).toString(),
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
    [amountDrafts, getAbsoluteSaldoBase, onUpdateFinancialRecord],
  );

  useEffect(() => {
    if (viewMode !== 'statements' || !selectedStatement) {
      setStatementDriveFiles([]);
      setStatementDriveError(null);
      return;
    }
    if (statementTab !== 'files') {
      return;
    }
    void loadStatementDriveFiles(selectedStatement.id);
  }, [loadStatementDriveFiles, selectedStatement, statementTab, viewMode]);

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
    if (viewMode === 'all') {
      await loadAllRecords('reset');
    }
    setSelectedRecordIds([]);
  }, [attachStatement, loadAllRecords, onUpdateStatement, selectedRecordIds, viewMode]);

  const handleRemoveSelected = useCallback(async () => {
    if (!selectedStatement || !onRemoveStatementRecords || !selectedRecordIds.length) {
      return;
    }
    await onRemoveStatementRecords(selectedStatement.id, selectedRecordIds);
    setSelectedRecordIds([]);
  }, [onRemoveStatementRecords, selectedRecordIds, selectedStatement]);

  const selectableRecordIds = useMemo(() => {
    if (!attachStatement || isAttachStatementPaid) {
      return [];
    }
    return filteredRows.filter((row) => canAttachRow(row)).map((row) => row.recordId);
  }, [attachStatement, canAttachRow, filteredRows, isAttachStatementPaid]);

  const allSelectableSelected =
    selectableRecordIds.length > 0 &&
    selectableRecordIds.every((id) => selectedRecordIds.includes(id));
  const someSelectableSelected = selectableRecordIds.some((id) => selectedRecordIds.includes(id));

  useEffect(() => {
    if (!selectAllRef.current) {
      return;
    }
    selectAllRef.current.indeterminate = someSelectableSelected && !allSelectableSelected;
  }, [allSelectableSelected, someSelectableSelected]);

  const toggleSelectAll = useCallback(() => {
    if (!attachStatement || isAttachStatementPaid) {
      return;
    }
    setSelectedRecordIds((prev) => {
      const next = new Set(prev);
      if (allSelectableSelected) {
        selectableRecordIds.forEach((id) => next.delete(id));
      } else {
        selectableRecordIds.forEach((id) => next.add(id));
      }
      return Array.from(next);
    });
  }, [allSelectableSelected, attachStatement, isAttachStatementPaid, selectableRecordIds]);

  const handleStatementDriveDelete = useCallback(
    async (file: DriveFile) => {
      if (!selectedStatement || file.isFolder) {
        return;
      }
      const confirmed = await confirm({
        title: 'Удалить файл',
        message: `Удалить файл "${file.name}"?`,
        confirmText: 'Удалить',
        tone: 'danger',
      });
      if (!confirmed) {
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
    [confirm, loadStatementDriveFiles, selectedStatement],
  );

  const handleCreateStatement = useCallback(async () => {
    if (!onCreateStatement) {
      return;
    }
    if (isStatementCreating) {
      return;
    }
    if (!statementForm.name.trim()) {
      return;
    }
    setIsStatementCreating(true);
    try {
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
    } finally {
      setIsStatementCreating(false);
    }
  }, [isStatementCreating, onCreateStatement, statementForm]);

  const handleEditStatementOpen = useCallback((statement: Statement) => {
    setEditingStatement(statement);
    setEditStatementForm({
      name: statement.name ?? '',
      statementType: statement.statementType,
      counterparty: statement.counterparty ?? '',
      comment: statement.comment ?? '',
      paidAt: statement.paidAt ?? '',
    });
  }, []);

  const handleEditStatementSubmit = useCallback(async () => {
    if (!editingStatement || !onUpdateStatement) {
      return;
    }
    const existingPaidAt = editingStatement.paidAt ?? '';
    const nextPaidAt = editStatementForm.paidAt ?? '';
    const isSettingPaidAtNow = Boolean(nextPaidAt) && !existingPaidAt;
    if (isSettingPaidAtNow) {
      const confirmed = await confirm({
        title: 'Подтвердите выплату',
        message:
          'Если указать дату выплаты, ведомость будет считаться выплаченной. После сохранения редактирование и удаление ведомости будут недоступны, а всем записям будет проставлена дата выплаты.\n\nПродолжить?',
        confirmText: 'Продолжить',
        tone: 'primary',
      });
      if (!confirmed) {
        return;
      }
    }
    await onUpdateStatement(editingStatement.id, {
      name: editStatementForm.name.trim(),
      statementType: editStatementForm.statementType,
      counterparty: editStatementForm.counterparty.trim(),
      comment: editStatementForm.comment.trim(),
      paidAt: editStatementForm.paidAt || null,
    });
    setEditingStatement(null);
  }, [confirm, editStatementForm, editingStatement, onUpdateStatement]);

  const handleDeleteStatementConfirm = useCallback(async () => {
    if (!deletingStatement || !onDeleteStatement) {
      return;
    }
    await onDeleteStatement(deletingStatement.id);
    setDeletingStatement(null);
  }, [deletingStatement, onDeleteStatement]);

  // Ведомость считается выплаченной по факту наличия paidAt.

  const recordsTable = (
    <RecordsTable
      attachStatement={attachStatement}
      isAttachStatementPaid={isAttachStatementPaid}
      selectedStatement={selectedStatement}
      isSelectedStatementPaid={isSelectedStatementPaid}
      viewMode={viewMode}
      selectedRecordIds={selectedRecordIds}
      selectableRecordIds={selectableRecordIds}
      allSelectableSelected={allSelectableSelected}
      selectAllRef={selectAllRef}
      filteredRows={filteredRows}
      policiesById={policiesById}
      statementsById={statementsById}
      amountDrafts={amountDrafts}
      isAllRecordsLoading={isAllRecordsLoading}
      isRecordAmountEditable={Boolean(onUpdateFinancialRecord)}
      canAttachSelectedAction={Boolean(onUpdateStatement)}
      canRemoveSelectedAction={Boolean(onRemoveStatementRecords)}
      normalizeText={normalizeText}
      canAttachRow={canAttachRow}
      onAttachSelected={handleAttachSelected}
      onRemoveSelected={handleRemoveSelected}
      onResetSelection={() => setSelectedRecordIds([])}
      onToggleSelectAll={toggleSelectAll}
      onToggleRecordSelection={toggleRecordSelection}
      onOpenDeal={handleOpenDeal}
      onDealSelect={onDealSelect}
      onToggleAllRecordsSort={toggleAllRecordsSort}
      getAllRecordsSortLabel={getAllRecordsSortLabel}
      getAllRecordsSortIndicator={getAllRecordsSortIndicator}
      onToggleAmountSort={toggleAmountSort}
      getAmountSortLabel={getAmountSortLabel}
      getAmountSortIndicator={getAmountSortIndicator}
      getPercentFromSaldo={getPercentFromSaldo}
      getAbsoluteSaldoBase={getAbsoluteSaldoBase}
      onRecordAmountChange={handleRecordAmountChange}
      onRecordAmountBlur={handleRecordAmountBlur}
      onToggleRecordAmountMode={toggleRecordAmountMode}
    />
  );

  const statementTabs = [
    { id: 'records' as const, label: 'Записи', count: selectedStatement?.recordsCount ?? 0 },
    { id: 'files' as const, label: 'Файлы', count: sortedStatementDriveFiles.length },
  ];

  const statementFilesTab = (
    <StatementFilesTab
      selectedStatement={selectedStatement}
      statementDriveFolderLink={statementDriveFolderLink}
      isStatementDriveLoading={isStatementDriveLoading}
      isStatementDriveUploading={isStatementDriveUploading}
      isStatementDriveTrashing={isStatementDriveTrashing}
      isStatementDriveDownloading={isStatementDriveDownloading}
      selectedStatementDriveFileIds={selectedStatementDriveFileIds}
      statementDriveError={statementDriveError}
      statementDriveTrashMessage={statementDriveTrashMessage}
      statementDriveDownloadMessage={statementDriveDownloadMessage}
      hasStatementDriveFolder={Boolean(selectedStatementDriveFolderId)}
      sortedStatementDriveFiles={sortedStatementDriveFiles}
      onRefresh={() => {
        if (!selectedStatement) {
          return;
        }
        void loadStatementDriveFiles(selectedStatement.id);
      }}
      onUpload={async (file) => {
        if (!selectedStatement) {
          return;
        }
        setStatementDriveUploading(true);
        try {
          await uploadStatementDriveFile(selectedStatement.id, file);
          await loadStatementDriveFiles(selectedStatement.id);
          setStatementDriveError(null);
        } catch (error) {
          setStatementDriveError(formatErrorMessage(error, 'Не удалось загрузить файл.'));
        } finally {
          setStatementDriveUploading(false);
        }
      }}
      onDownloadSelected={() => {
        void handleDownloadStatementDriveFiles();
      }}
      onTrashSelected={() => {
        void handleTrashSelectedStatementDriveFiles();
      }}
      onToggleSelection={toggleStatementDriveFileSelection}
      onDownloadFile={(fileId) => {
        void handleDownloadStatementDriveFiles([fileId]);
      }}
      onDeleteFile={(file) => {
        void handleStatementDriveDelete(file);
      }}
    />
  );

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
        <div
          role="tabpanel"
          id="financial-tabpanel-statements"
          aria-labelledby="financial-tab-statements"
          tabIndex={0}
          className="outline-none"
          hidden={viewMode !== 'statements'}
        >
          <div className="divide-y divide-slate-200 bg-white">
            <div className="px-4 py-4 bg-white">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-baseline lg:justify-between">
                <div className="flex flex-wrap items-baseline gap-2">
                  <span className="text-lg font-semibold text-slate-900 whitespace-nowrap">
                    Ведомости
                  </span>
                  <span className="text-sm text-slate-500 whitespace-nowrap">
                    Всего: {statements.length}
                  </span>
                </div>
                <p className="text-sm text-slate-600">
                  Выберите ведомость, чтобы посмотреть ее записи.
                </p>
              </div>
              {onCreateStatement && (
                <div className="mt-3 flex flex-wrap items-center gap-4">
                  <button
                    type="button"
                    onClick={() => setStatementModalOpen(true)}
                    className="btn btn-secondary btn-sm rounded-xl"
                  >
                    + Создать ведомость
                  </button>
                  <label className="flex items-center gap-2 text-xs font-semibold text-slate-500">
                    <input
                      type="checkbox"
                      checked={showPaidStatements}
                      onChange={(event) => setShowPaidStatements(event.target.checked)}
                      className="check"
                    />
                    Показывать оплаченные ведомости
                  </label>
                </div>
              )}
            </div>

            <div className="max-h-[360px] overflow-y-auto bg-white border-t border-slate-200">
              {(showPaidStatements
                ? statements
                : statements.filter((statement) => !statement.paidAt)
              ).length ? (
                <ul className="divide-y divide-slate-200">
                  {(showPaidStatements
                    ? statements
                    : statements.filter((statement) => !statement.paidAt)
                  ).map((statement) => {
                    const isActive = statement.id === selectedStatementId;
                    const totalAmount = Number(statement.totalAmount ?? 0);
                    const totalLabel = Number.isFinite(totalAmount)
                      ? formatCurrencyRu(totalAmount)
                      : '—';
                    const recordsCount = statement.recordsCount ?? 0;
                    const paidAt = statement.paidAt ? formatDateRu(statement.paidAt) : null;
                    const statusLabel = statement.paidAt ? 'Выплачена' : 'Черновик';
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
                                  !statement.paidAt
                                    ? 'text-slate-900'
                                    : statement.statementType === 'income'
                                      ? 'text-emerald-700'
                                      : 'text-rose-700'
                                }`}
                              >
                                {normalizeText(statement.name)}
                              </p>
                              <p className="text-xs text-slate-500">
                                {typeLabel} · {statusLabel}
                                {statement.counterparty
                                  ? ` · ${normalizeText(statement.counterparty)}`
                                  : ''}
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
                  <PanelMessage>
                    {showPaidStatements ? 'Ведомостей пока нет' : 'Нет черновиков ведомостей'}
                  </PanelMessage>
                </div>
              )}
            </div>

            <div className="px-4 py-5 bg-white">
              {selectedStatement ? (
                <div className="rounded-2xl border bg-white shadow-md p-6 space-y-6 border-sky-500 ring-2 ring-sky-400/30">
                  <div className="flex flex-col gap-4">
                    <div className="flex flex-wrap items-start justify-between gap-4">
                      <div className="space-y-2">
                        <p className="text-xs uppercase tracking-[0.2em] text-slate-400">
                          Ведомость
                        </p>
                        <p className="text-lg font-semibold text-slate-900">
                          {normalizeText(selectedStatement.name)}
                        </p>
                        <p className="text-xs text-slate-500">
                          {selectedStatementTypeLabel} · {selectedStatementStatusLabel}
                          {selectedStatement.counterparty
                            ? ` · ${normalizeText(selectedStatement.counterparty)}`
                            : ''}
                          {selectedStatementPaidAt ? ` · Выплата ${selectedStatementPaidAt}` : ''}
                        </p>
                        {selectedStatement.paidAt && (
                          <p className="text-xs text-rose-600">
                            Выплаченная ведомость недоступна для редактирования и удаления.
                          </p>
                        )}
                      </div>

                      <div className="flex flex-wrap items-center justify-end gap-3">
                        <div className="flex flex-wrap items-center gap-2">
                          <button
                            type="button"
                            onClick={() => void handleExportStatement()}
                            disabled={isStatementExporting}
                            className="btn btn-secondary"
                            title="Сформировать XLSX-файл ведомости и сохранить в Google Drive"
                          >
                            {isStatementExporting ? 'Формируем...' : 'Сформировать ведомость'}
                          </button>
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
                        </div>
                      </div>
                    </div>

                    {statementExportError && (
                      <p className="app-alert app-alert-danger">{statementExportError}</p>
                    )}

                    <div
                      role="tablist"
                      aria-label="Разделы ведомости"
                      className="flex w-full flex-nowrap gap-2 overflow-x-auto app-panel-muted p-1 shadow-none scrollbar-none"
                    >
                      {statementTabs.map((tab) => {
                        const isActive = statementTab === tab.id;
                        return (
                          <button
                            key={tab.id}
                            id={`statement-tab-${tab.id}`}
                            role="tab"
                            aria-label={tab.label}
                            aria-selected={isActive}
                            aria-controls={`statement-tabpanel-${tab.id}`}
                            type="button"
                            onClick={() => setStatementTab(tab.id)}
                            className={`min-w-[120px] flex-shrink-0 rounded-xl px-4 py-2 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 ${
                              isActive
                                ? 'bg-white font-semibold text-sky-700 border border-slate-200 shadow-sm'
                                : 'text-slate-600 hover:bg-white/70 hover:text-slate-900'
                            }`}
                          >
                            <span className="flex items-center justify-center gap-2">
                              <span className={isActive ? 'font-semibold' : 'font-medium'}>
                                {tab.label}
                              </span>
                              <span className="app-counter" aria-hidden="true">
                                {tab.count}
                              </span>
                            </span>
                          </button>
                        );
                      })}
                    </div>

                    <div
                      role="tabpanel"
                      id="statement-tabpanel-records"
                      aria-labelledby="statement-tab-records"
                      tabIndex={0}
                      className="outline-none"
                      hidden={statementTab !== 'records'}
                    >
                      {recordsTable}
                    </div>
                    <div
                      role="tabpanel"
                      id="statement-tabpanel-files"
                      aria-labelledby="statement-tab-files"
                      tabIndex={0}
                      className="outline-none"
                      hidden={statementTab !== 'files'}
                    >
                      {statementFilesTab}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="bg-white px-6 py-10 text-center">
                  <PanelMessage>Выберите ведомость в списке выше.</PanelMessage>
                </div>
              )}
            </div>
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
          <AllRecordsPanel
            allRecordsSearch={allRecordsSearch}
            onSearchChange={setAllRecordsSearch}
            allRecordsError={allRecordsError}
            isAllRecordsLoading={isAllRecordsLoading}
            onRetryLoad={() => {
              void loadAllRecords('reset');
            }}
            showUnpaidPayments={showUnpaidPayments}
            onToggleShowUnpaidPayments={setShowUnpaidPayments}
            showStatementRecords={showStatementRecords}
            onToggleShowStatementRecords={setShowStatementRecords}
            showPaidRecords={showPaidRecords}
            onToggleShowPaidRecords={setShowPaidRecords}
            showZeroSaldo={showZeroSaldo}
            onToggleShowZeroSaldo={setShowZeroSaldo}
            recordTypeFilter={recordTypeFilter}
            onRecordTypeFilterChange={setRecordTypeFilter}
            isRecordTypeLocked={isRecordTypeLocked}
            targetStatementId={targetStatementId}
            onTargetStatementChange={setTargetStatementId}
            statements={statements}
            normalizeText={normalizeText}
            shownRecordsCount={allRecords.length}
            totalRecordsCount={allRecordsTotalCount}
            isAllRecordsLoadingMore={isAllRecordsLoadingMore}
            allRecordsHasMore={allRecordsHasMore}
            onLoadMore={() => {
              void loadAllRecords('more');
            }}
            recordsTable={recordsTable}
          />
        </div>
      </div>

      <CreateStatementModal
        isOpen={isStatementModalOpen}
        isSubmitting={isStatementCreating}
        form={statementForm}
        onClose={() => setStatementModalOpen(false)}
        onSubmit={handleCreateStatement}
        onFormChange={setStatementForm}
      />
      <EditStatementModal
        isOpen={Boolean(editingStatement)}
        form={editStatementForm}
        onClose={() => setEditingStatement(null)}
        onSubmit={handleEditStatementSubmit}
        onFormChange={setEditStatementForm}
      />
      <DeleteStatementModal
        isOpen={Boolean(deletingStatement)}
        statementName={normalizeText(deletingStatement?.name)}
        onClose={() => setDeletingStatement(null)}
        onConfirm={handleDeleteStatementConfirm}
      />
      <ConfirmDialogRenderer />
    </section>
  );
};
