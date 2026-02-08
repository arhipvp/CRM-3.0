import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import type { DriveFile, FinancialRecord, Payment, Policy, Statement } from '../../types';
import type { FilterParams } from '../../api';
import {
  fetchFinancialRecordsWithPagination,
  fetchStatementDriveFiles,
  downloadStatementDriveFiles,
  trashStatementDriveFiles,
  uploadStatementDriveFile,
} from '../../api';
import type { AddFinancialRecordFormValues } from '../forms/AddFinancialRecordForm';
import { FileUploadManager } from '../FileUploadManager';
import { PanelMessage } from '../PanelMessage';
import { TableHeadCell } from '../common/TableHeadCell';
import { Modal } from '../Modal';
import {
  TABLE_CELL_CLASS_SM,
  TABLE_ROW_CLASS,
  TABLE_ROW_CLASS_PLAIN,
  TABLE_THEAD_CLASS,
} from '../common/tableStyles';
import { formatCurrencyRu, formatDateRu } from '../../utils/formatting';
import { useDebouncedValue } from '../../hooks/useDebouncedValue';
import { formatErrorMessage } from '../../utils/formatErrorMessage';
import { buildDriveFolderLink } from '../../utils/links';
import { formatDriveDate, formatDriveFileSize, getDriveItemIcon } from './dealsView/helpers';
import { PolicyNumberButton } from '../policies/PolicyNumberButton';

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

  type AllRecordsSortKey = 'none' | 'payment' | 'saldo' | 'comment' | 'amount';

  const [amountDrafts, setAmountDrafts] = useState<Record<string, string>>({});
  const [selectedStatementId, setSelectedStatementId] = useState<string | null>(null);
  const [selectedRecordIds, setSelectedRecordIds] = useState<string[]>([]);
  const [viewMode, setViewMode] = useState<'all' | 'statements'>('all');
  const [statementTab, setStatementTab] = useState<'records' | 'files'>('records');
  const [allRecordsSearch, setAllRecordsSearch] = useState('');
  const [showUnpaidPayments, setShowUnpaidPayments] = useState(true);
  const [showStatementRecords, setShowStatementRecords] = useState(true);
  const [showPaidOnlyRecords, setShowPaidOnlyRecords] = useState(false);
  const [recordTypeFilter, setRecordTypeFilter] = useState<'all' | 'income' | 'expense'>('all');
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

  useEffect(() => {
    setStatementTab('records');
    setSelectedStatementDriveFileIds([]);
    setStatementDriveTrashMessage(null);
    setStatementDriveDownloadMessage(null);
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
      if (showPaidOnlyRecords) {
        filters.paid_only = true;
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
      showPaidOnlyRecords,
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
    const confirmText = `Удалить выбранные файлы (${selectedStatementDriveFileIds.length})?`;
    if (typeof window !== 'undefined' && !window.confirm(confirmText)) {
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
  }, [loadStatementDriveFiles, selectedStatement, selectedStatementDriveFileIds]);

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

  // Ведомость считается выплаченной по факту наличия paidAt.

  const recordsSelectionBar = (
    <div className="border-b border-slate-200 bg-white px-4 py-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="text-sm text-slate-700">
          {attachStatement ? (
            <>
              Выбрано: <span className="font-semibold">{selectedRecordIds.length}</span>
              {viewMode === 'all' && attachStatement
                ? ` · Ведомость: ${normalizeText(attachStatement.name)}`
                : ''}
            </>
          ) : (
            <span className="text-slate-500">Выберите ведомость, чтобы добавлять записи.</span>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {viewMode === 'statements' ? (
            <button
              type="button"
              onClick={() => void handleRemoveSelected()}
              className="btn btn-danger btn-sm rounded-xl"
              disabled={
                !selectedRecordIds.length ||
                !onRemoveStatementRecords ||
                isSelectedStatementPaid ||
                !selectedStatement
              }
            >
              Убрать из ведомости
            </button>
          ) : (
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
          )}
          {selectedRecordIds.length > 0 && (
            <button
              type="button"
              onClick={() => setSelectedRecordIds([])}
              className="btn btn-secondary btn-sm rounded-xl"
            >
              Сбросить выделение
            </button>
          )}
        </div>
      </div>
    </div>
  );

  const recordsTable = (
    <div className="rounded-2xl border-2 border-slate-300 bg-white shadow-sm overflow-hidden">
      {recordsSelectionBar}
      <div className="overflow-x-auto bg-white">
        <table
          className="deals-table min-w-full border-collapse text-left text-sm"
          aria-label="Доходы и расходы"
        >
          <thead className={TABLE_THEAD_CLASS}>
            <tr>
              <TableHeadCell padding="sm" align="center" className="w-10">
                <input
                  ref={selectAllRef}
                  type="checkbox"
                  checked={allSelectableSelected}
                  onChange={toggleSelectAll}
                  disabled={
                    !attachStatement || isAttachStatementPaid || selectableRecordIds.length === 0
                  }
                  className="check"
                  aria-label="Выбрать все видимые записи"
                  title={
                    !attachStatement
                      ? 'Выберите ведомость для добавления записей'
                      : isAttachStatementPaid
                        ? 'Выплаченная ведомость недоступна для изменений'
                        : undefined
                  }
                />
              </TableHeadCell>
              <TableHeadCell padding="sm" className="min-w-[260px]">
                Клиент / сделка
              </TableHeadCell>
              <TableHeadCell padding="sm" className="min-w-[150px]">
                Номер полиса
              </TableHeadCell>
              <TableHeadCell padding="sm" className="min-w-[140px]">
                Тип полиса
              </TableHeadCell>
              <TableHeadCell padding="sm" className="min-w-[160px]">
                Канал продаж
              </TableHeadCell>
              <TableHeadCell padding="sm" className="min-w-[190px]" align="right">
                {viewMode === 'all' ? (
                  <button
                    type="button"
                    onClick={() => toggleAllRecordsSort('payment')}
                    aria-label={`Сортировать по платежу, текущий порядок ${getAllRecordsSortLabel('payment')}`}
                    className="flex w-full items-center justify-end gap-2 rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 focus-visible:ring-offset-2 focus-visible:ring-offset-white"
                  >
                    <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-900">
                      Платеж
                    </span>
                    <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-900">
                      {getAllRecordsSortIndicator('payment')}
                    </span>
                  </button>
                ) : (
                  <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-900">
                    Платеж
                  </span>
                )}
              </TableHeadCell>
              <TableHeadCell padding="sm" className="min-w-[220px]" align="right">
                {viewMode === 'all' ? (
                  <button
                    type="button"
                    onClick={() => toggleAllRecordsSort('saldo')}
                    aria-label={`Сортировать по сальдо, текущий порядок ${getAllRecordsSortLabel('saldo')}`}
                    className="flex w-full items-center justify-end gap-2 rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 focus-visible:ring-offset-2 focus-visible:ring-offset-white"
                  >
                    <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-900">
                      Сальдо
                    </span>
                    <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-900">
                      {getAllRecordsSortIndicator('saldo')}
                    </span>
                  </button>
                ) : (
                  <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-900">
                    Сальдо
                  </span>
                )}
              </TableHeadCell>
              <TableHeadCell padding="sm" className="min-w-[220px]">
                {viewMode === 'all' ? (
                  <button
                    type="button"
                    onClick={() => toggleAllRecordsSort('comment')}
                    aria-label={`Сортировать по примечанию, текущий порядок ${getAllRecordsSortLabel('comment')}`}
                    className="flex w-full items-center justify-start gap-2 rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 focus-visible:ring-offset-2 focus-visible:ring-offset-white"
                  >
                    <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-900">
                      Примечание
                    </span>
                    <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-900">
                      {getAllRecordsSortIndicator('comment')}
                    </span>
                  </button>
                ) : (
                  <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-900">
                    Примечание
                  </span>
                )}
              </TableHeadCell>
              <TableHeadCell padding="sm" className="min-w-[180px]" align="right">
                {viewMode === 'all' ? (
                  <button
                    type="button"
                    onClick={() => toggleAllRecordsSort('amount')}
                    aria-label={`Сортировать по сумме, текущий порядок ${getAllRecordsSortLabel('amount')}`}
                    className="flex w-full items-center justify-end gap-2 rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 focus-visible:ring-offset-2 focus-visible:ring-offset-white"
                  >
                    <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-900">
                      Сумма
                    </span>
                    <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-900">
                      {getAllRecordsSortIndicator('amount')}
                    </span>
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={toggleAmountSort}
                    aria-label={`Сортировать по сумме, текущий порядок ${getAmountSortLabel()}`}
                    className="flex w-full items-center justify-end gap-2 rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 focus-visible:ring-offset-2 focus-visible:ring-offset-white"
                  >
                    <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-900">
                      Сумма
                    </span>
                    <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-900">
                      {getAmountSortIndicator()}
                    </span>
                  </button>
                )}
              </TableHeadCell>
            </tr>
          </thead>
          <tbody className="bg-white">
            {filteredRows.map((row) => {
              const payment = row.payment;
              const policy = payment.policyId ? policiesById.get(payment.policyId) : undefined;
              const policyNumber =
                normalizeText(payment.policyNumber) ||
                normalizeText(policiesById.get(payment.policyId ?? '')?.number) ||
                '-';
              const policyType =
                normalizeText(payment.policyInsuranceType) ||
                normalizeText(policiesById.get(payment.policyId ?? '')?.insuranceType) ||
                '-';
              const salesChannelLabel =
                normalizeText(policiesById.get(payment.policyId ?? '')?.salesChannelName) ||
                normalizeText(policiesById.get(payment.policyId ?? '')?.salesChannel) ||
                '-';
              const dealClientName = normalizeText(payment.dealClientName) || '-';
              const policyClientName =
                normalizeText(policy?.insuredClientName) ||
                normalizeText(policy?.clientName) ||
                dealClientName ||
                '-';
              const dealTitle = normalizeText(payment.dealTitle) || '-';
              const paymentActualDate = payment.actualDate
                ? formatDateRu(payment.actualDate)
                : null;
              const paymentScheduledDate = payment.scheduledDate
                ? formatDateRu(payment.scheduledDate)
                : null;
              const isPaymentPaid = Boolean(payment.actualDate);
              const recordAmount = row.recordAmount;
              const isIncome = recordAmount > 0;
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
              const commentParts = [row.recordNote, row.recordDescription, row.recordSource]
                .map((value) => normalizeText(value?.toString().trim()))
                .filter(Boolean);
              const primaryComment = commentParts[0] ?? '';
              const secondaryComment =
                commentParts.length > 1 ? commentParts.slice(1).join(' · ') : '';
              const amountValue = amountDrafts[row.recordId] ?? Math.abs(recordAmount).toString();
              const recordStatement = row.statementId
                ? statementsById.get(row.statementId)
                : undefined;
              const isRecordLocked = Boolean(recordStatement?.paidAt);
              const statementNote = recordStatement
                ? recordStatement.paidAt
                  ? `Ведомость от ${formatDateRu(recordStatement.paidAt)}: ${normalizeText(
                      recordStatement.name,
                    )}`
                  : `Ведомость: ${normalizeText(recordStatement.name)}`
                : null;
              const isSelectable = attachStatement ? canAttachRow(row) : false;
              const isSelected = selectedRecordIds.includes(row.recordId);

              return (
                <tr key={row.key} className={TABLE_ROW_CLASS}>
                  <td className="border border-slate-200 px-3 py-2 text-center">
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
                  <td className={TABLE_CELL_CLASS_SM}>
                    <p className="text-sm font-semibold text-slate-900">{policyClientName}</p>
                    <div className="mt-1 flex flex-wrap items-center gap-1 text-[11px] text-slate-500">
                      {payment.dealId && onDealSelect ? (
                        <button
                          type="button"
                          onClick={() => handleOpenDeal(payment.dealId)}
                          className="link-action text-[11px] font-semibold"
                        >
                          {dealTitle}
                        </button>
                      ) : (
                        <span>{dealTitle}</span>
                      )}
                    </div>
                    <p className="mt-1 text-[11px] text-slate-500">
                      Контакт по сделке:{' '}
                      <span className="font-semibold text-slate-700">{dealClientName}</span>
                    </p>
                  </td>
                  <td className={`${TABLE_CELL_CLASS_SM} text-slate-700`}>
                    <PolicyNumberButton
                      value={policyNumber === '-' ? '' : policyNumber}
                      placeholder="-"
                      className="link-action text-left"
                    />
                  </td>
                  <td
                    lang="ru"
                    className={`${TABLE_CELL_CLASS_SM} text-slate-700 hyphens-auto break-words`}
                  >
                    {policyType}
                  </td>
                  <td className={`${TABLE_CELL_CLASS_SM} text-slate-700`}>{salesChannelLabel}</td>
                  <td className={`${TABLE_CELL_CLASS_SM} text-right text-slate-700`}>
                    <p className="text-sm font-semibold">
                      {formatCurrencyRu(Number(payment.amount))}
                    </p>
                    {isPaymentPaid ? (
                      <p className="mt-1 text-[11px] font-semibold text-emerald-700">
                        Оплачен{paymentActualDate ? `: ${paymentActualDate}` : ''}
                      </p>
                    ) : (
                      <p className="mt-1 text-[11px] font-semibold text-rose-700">
                        Не оплачен{paymentScheduledDate ? ` (план: ${paymentScheduledDate})` : ''}
                      </p>
                    )}
                  </td>
                  <td className={`${TABLE_CELL_CLASS_SM} text-right text-slate-700`}>
                    <p className="text-sm font-semibold">{paymentBalanceLabel}</p>
                    {paymentEntries.length ? (
                      <div className="mt-1 space-y-1 text-[11px] text-slate-500">
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
                      <p className="mt-1 text-[11px] text-slate-500">Операций нет</p>
                    )}
                  </td>
                  <td className={`${TABLE_CELL_CLASS_SM} text-slate-700`}>
                    {primaryComment ? (
                      <p className="text-sm font-semibold text-slate-900">{primaryComment}</p>
                    ) : (
                      <p className="text-sm font-semibold text-slate-400">—</p>
                    )}
                    {secondaryComment && (
                      <p className="mt-1 text-[11px] text-slate-500">{secondaryComment}</p>
                    )}
                    {statementNote && (
                      <p className="mt-1 text-[11px] text-slate-500">{statementNote}</p>
                    )}
                  </td>
                  <td className={`${TABLE_CELL_CLASS_SM} text-right text-slate-700`}>
                    <p className={`text-sm font-semibold ${recordClass}`}>
                      {isIncome ? '+' : '-'}
                      {formatCurrencyRu(Math.abs(recordAmount))}
                    </p>
                    <p className="mt-1 text-[11px] text-slate-500">{recordDateLabel}</p>
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
                        className="mt-1 w-full max-w-[140px] rounded-lg border border-slate-200 bg-white px-2 py-0.5 text-[11px] text-slate-700 focus:border-sky-500 focus:outline-none focus:ring focus:ring-sky-100"
                      />
                    )}
                  </td>
                </tr>
              );
            })}
            {!filteredRows.length && (
              <tr>
                <td
                  colSpan={9}
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
    </div>
  );

  const statementTabs = [
    { id: 'records' as const, label: 'Записи', count: selectedStatement?.recordsCount ?? 0 },
    { id: 'files' as const, label: 'Файлы', count: sortedStatementDriveFiles.length },
  ];

  const statementFilesTab = (
    <section className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="app-label">Файлы</p>
            {statementDriveFolderLink && (
              <a
                href={statementDriveFolderLink}
                target="_blank"
                rel="noreferrer"
                className="link-action text-xs"
              >
                Открыть папку в Google Drive
              </a>
            )}
          </div>
          <p className="text-xs text-slate-500">
            Файлы загружаются прямо из папки, привязанной к этой ведомости.
          </p>
        </div>
        {selectedStatement && (
          <button
            type="button"
            onClick={() => void loadStatementDriveFiles(selectedStatement.id)}
            disabled={isStatementDriveLoading}
            className="btn btn-secondary btn-sm rounded-xl"
          >
            {isStatementDriveLoading ? 'Обновляю...' : 'Обновить'}
          </button>
        )}
      </div>

      <FileUploadManager
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
        disabled={
          !selectedStatement ||
          isStatementDriveUploading ||
          isStatementDriveLoading ||
          isStatementDriveTrashing ||
          isStatementDriveDownloading
        }
      />

      <div className="flex flex-wrap items-center gap-2 pt-2">
        <button
          type="button"
          onClick={() => void handleDownloadStatementDriveFiles()}
          disabled={
            isStatementDriveDownloading ||
            isStatementDriveTrashing ||
            isStatementDriveLoading ||
            !selectedStatement ||
            selectedStatementDriveFileIds.length === 0 ||
            !!statementDriveError
          }
          className="btn btn-secondary btn-sm rounded-xl"
        >
          {isStatementDriveDownloading ? 'Скачиваю...' : 'Скачать'}
        </button>
        <button
          type="button"
          onClick={() => void handleTrashSelectedStatementDriveFiles()}
          disabled={
            isStatementDriveDownloading ||
            isStatementDriveTrashing ||
            isStatementDriveLoading ||
            !selectedStatement ||
            selectedStatementDriveFileIds.length === 0 ||
            !!statementDriveError
          }
          className="btn btn-danger btn-sm rounded-xl"
        >
          {isStatementDriveTrashing ? 'Удаляю...' : 'Удалить'}
        </button>
        <p className="text-xs text-slate-500">
          {selectedStatementDriveFileIds.length
            ? `${selectedStatementDriveFileIds.length} файл${
                selectedStatementDriveFileIds.length === 1 ? '' : 'ов'
              } выбрано`
            : 'Выберите файлы для действий.'}
        </p>
      </div>

      {statementDriveError && <p className="app-alert app-alert-danger">{statementDriveError}</p>}

      {statementDriveTrashMessage && (
        <p className="text-xs text-rose-600 bg-rose-50 p-2 rounded-lg">
          {statementDriveTrashMessage}
        </p>
      )}

      {statementDriveDownloadMessage && (
        <p className="text-xs text-rose-600 bg-rose-50 p-2 rounded-lg">
          {statementDriveDownloadMessage}
        </p>
      )}

      {!statementDriveError &&
        selectedStatementDriveFolderId &&
        !isStatementDriveLoading &&
        sortedStatementDriveFiles.length === 0 && (
          <div className="app-panel-muted px-4 py-3 text-sm text-slate-600">Папка пуста.</div>
        )}

      {!statementDriveError && sortedStatementDriveFiles.length > 0 && (
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className={TABLE_THEAD_CLASS}>
                <tr>
                  <TableHeadCell padding="sm" className="w-10">
                    <span className="sr-only">Выбор</span>
                  </TableHeadCell>
                  <TableHeadCell padding="sm">Файл</TableHeadCell>
                  <TableHeadCell padding="sm" align="right">
                    Размер
                  </TableHeadCell>
                  <TableHeadCell padding="sm" align="right">
                    Дата
                  </TableHeadCell>
                  <TableHeadCell padding="sm" align="right">
                    Действия
                  </TableHeadCell>
                </tr>
              </thead>
              <tbody>
                {sortedStatementDriveFiles.map((file) => {
                  const isSelected = selectedStatementDriveFileIds.includes(file.id);
                  const canSelect =
                    !file.isFolder &&
                    !isStatementDriveLoading &&
                    !isStatementDriveTrashing &&
                    !isStatementDriveDownloading;

                  return (
                    <tr key={file.id} className={TABLE_ROW_CLASS_PLAIN}>
                      <td className={TABLE_CELL_CLASS_SM}>
                        <input
                          type="checkbox"
                          checked={isSelected}
                          disabled={!canSelect}
                          onChange={() => toggleStatementDriveFileSelection(file.id)}
                          className="check rounded-sm"
                          aria-label={`Выбрать файл: ${file.name}`}
                        />
                      </td>
                      <td className={TABLE_CELL_CLASS_SM}>
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="text-lg">{getDriveItemIcon(file.isFolder)}</span>
                          <div className="min-w-0">
                            <p className="text-sm font-semibold text-slate-900 break-all">
                              {file.name}
                            </p>
                            <p className="text-xs text-slate-500">{file.mimeType || '—'}</p>
                          </div>
                        </div>
                      </td>
                      <td className={`${TABLE_CELL_CLASS_SM} text-right text-xs text-slate-500`}>
                        {formatDriveFileSize(file.size)}
                      </td>
                      <td className={`${TABLE_CELL_CLASS_SM} text-right text-xs text-slate-500`}>
                        {formatDriveDate(file.modifiedAt ?? file.createdAt)}
                      </td>
                      <td className={`${TABLE_CELL_CLASS_SM} text-right`}>
                        <div className="flex items-center justify-end gap-3">
                          {file.webViewLink ? (
                            <a
                              href={file.webViewLink}
                              target="_blank"
                              rel="noreferrer"
                              className="link-action text-xs"
                            >
                              Открыть
                            </a>
                          ) : (
                            <span className="text-xs text-slate-400">—</span>
                          )}
                          <button
                            type="button"
                            onClick={() => void handleDownloadStatementDriveFiles([file.id])}
                            disabled={
                              file.isFolder ||
                              isStatementDriveDownloading ||
                              isStatementDriveTrashing ||
                              isStatementDriveLoading ||
                              !!statementDriveError
                            }
                            className="link-action text-xs disabled:text-slate-300"
                          >
                            Скачать
                          </button>
                          <button
                            type="button"
                            onClick={() => void handleStatementDriveDelete(file)}
                            disabled={
                              file.isFolder ||
                              isStatementDriveDownloading ||
                              isStatementDriveTrashing ||
                              isStatementDriveLoading ||
                              !!statementDriveError
                            }
                            className="link-action text-xs disabled:text-slate-300"
                          >
                            Удалить
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </section>
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
                <div className="mt-3">
                  <button
                    type="button"
                    onClick={() => setStatementModalOpen(true)}
                    className="btn btn-secondary btn-sm rounded-xl"
                  >
                    + Создать ведомость
                  </button>
                </div>
              )}
            </div>

            <div className="max-h-[360px] overflow-y-auto bg-white border-t border-slate-200">
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
                  <PanelMessage>Ведомостей пока нет</PanelMessage>
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
          <div className="divide-y divide-slate-200">
            <div className="px-4 py-4 bg-white">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-baseline lg:justify-between">
                <div className="flex flex-wrap items-baseline gap-2">
                  <span className="text-lg font-semibold text-slate-900 whitespace-nowrap">
                    Все финансовые записи
                  </span>
                  <span className="text-sm text-slate-500 whitespace-nowrap">
                    Фильтры по записям
                  </span>
                </div>
                <div className="w-full max-w-sm">
                  <label htmlFor="allFinancialSearch" className="sr-only">
                    Поиск по записям
                  </label>
                  <input
                    id="allFinancialSearch"
                    type="search"
                    value={allRecordsSearch}
                    onChange={(event) => setAllRecordsSearch(event.target.value)}
                    placeholder="Поиск по клиенту, полису, сделке, примечанию..."
                    className="field field-input"
                  />
                </div>
              </div>
            </div>
            {allRecordsError && (
              <div className="px-4 py-3 bg-white border-b border-slate-200">
                <div className="app-alert app-alert-danger flex flex-wrap items-center justify-between gap-3">
                  <span>{allRecordsError}</span>
                  <button
                    type="button"
                    onClick={() => void loadAllRecords('reset')}
                    className="btn btn-secondary btn-sm rounded-xl"
                    disabled={isAllRecordsLoading}
                  >
                    Повторить
                  </button>
                </div>
              </div>
            )}
            <div className="px-4 py-4 border-b border-slate-200 bg-white">
              <div className="flex flex-wrap items-center gap-4">
                <label className="flex items-center gap-2 text-xs font-semibold text-slate-500">
                  <input
                    type="checkbox"
                    checked={showUnpaidPayments}
                    onChange={(event) => setShowUnpaidPayments(event.target.checked)}
                    className="check"
                  />
                  Показывать неоплаченные платежи
                </label>
                <label className="flex items-center gap-2 text-xs font-semibold text-slate-500">
                  <input
                    type="checkbox"
                    checked={showStatementRecords}
                    onChange={(event) => setShowStatementRecords(event.target.checked)}
                    className="check"
                  />
                  Показывать записи в ведомостях
                </label>
                <label className="flex items-center gap-2 text-xs font-semibold text-slate-500">
                  <input
                    type="checkbox"
                    checked={showPaidOnlyRecords}
                    onChange={(event) => setShowPaidOnlyRecords(event.target.checked)}
                    className="check"
                  />
                  Показать оплаченные расходы/доходы
                </label>
                <div className="flex items-center gap-2 rounded-2xl border border-slate-200 bg-slate-50 p-1">
                  <button
                    type="button"
                    onClick={() => setRecordTypeFilter('income')}
                    className={`rounded-xl px-3 py-2 text-xs font-semibold transition ${
                      recordTypeFilter === 'income'
                        ? 'bg-emerald-600 text-white hover:bg-emerald-700'
                        : 'text-slate-600 hover:bg-white'
                    }`}
                  >
                    Доходы
                  </button>
                  <button
                    type="button"
                    onClick={() => setRecordTypeFilter('expense')}
                    className={`rounded-xl px-3 py-2 text-xs font-semibold transition ${
                      recordTypeFilter === 'expense'
                        ? 'bg-rose-600 text-white hover:bg-rose-700'
                        : 'text-slate-600 hover:bg-white'
                    }`}
                  >
                    Расходы
                  </button>
                  <button
                    type="button"
                    onClick={() => setRecordTypeFilter('all')}
                    className={`rounded-xl px-3 py-2 text-xs font-semibold transition ${
                      recordTypeFilter === 'all'
                        ? 'bg-slate-900 text-white hover:bg-slate-800'
                        : 'text-slate-600 hover:bg-white'
                    }`}
                  >
                    Все
                  </button>
                </div>
                <select
                  value={targetStatementId}
                  onChange={(event) => setTargetStatementId(event.target.value)}
                  className="field field-input h-10 min-w-[220px] text-sm"
                >
                  <option value="">Выберите ведомость</option>
                  {statements.map((statement) => (
                    <option key={statement.id} value={statement.id}>
                      {statement.statementType === 'income' ? 'Доходы' : 'Расходы'} ·{' '}
                      {normalizeText(statement.name)}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div className="px-4 py-5 bg-white space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-slate-500">
                <span>
                  Показано:{' '}
                  <span className="font-semibold text-slate-700">{allRecords.length}</span>
                  {allRecordsTotalCount ? ` из ${allRecordsTotalCount}` : ''}
                </span>
                {isAllRecordsLoading && <span>Загрузка...</span>}
              </div>

              {recordsTable}

              {allRecordsHasMore && (
                <div className="border-t border-slate-100 bg-slate-50/70 px-4 py-3 text-center rounded-2xl">
                  <button
                    type="button"
                    onClick={() => void loadAllRecords('more')}
                    disabled={isAllRecordsLoadingMore || isAllRecordsLoading}
                    className="btn btn-quiet btn-sm rounded-xl"
                  >
                    {isAllRecordsLoadingMore ? 'Загрузка...' : 'Показать ещё'}
                  </button>
                </div>
              )}
            </div>
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
              <p className="text-xs text-slate-500">
                Ведомость считается выплаченной, когда указана дата выплаты. После этого
                редактирование и удаление будут недоступны, а всем записям будет проставлена дата.
              </p>
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
            Ведомость <span className="font-bold">{normalizeText(deletingStatement.name)}</span>{' '}
            будет удалена. Все записи отвяжутся от ведомости.
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
