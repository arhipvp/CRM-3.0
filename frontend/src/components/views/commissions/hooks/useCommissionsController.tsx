import { useCallback, useEffect, useLayoutEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';

import type { Statement } from '../../../../types';
import { fetchPolicy, reopenFinanceStatement } from '../../../../api';
import { formatErrorMessage } from '../../../../utils/formatErrorMessage';
import { useConfirm } from '../../../../hooks/useConfirm';
import { RecordsTable, type IncomeExpenseRow } from '../RecordsTable';
import { StatementFilesTab } from '../StatementFilesTab';
import { useAllRecordsController } from './useAllRecordsController';
import { useCommissionsRows } from './useCommissionsRows';
import { useCommissionsViewModel } from './useCommissionsViewModel';
import { useRecordAmountEditing } from './useRecordAmountEditing';
import { useStatementDriveManager } from './useStatementDriveManager';
import { useStatementRecordsController } from './useStatementRecordsController';
import { useStatementRecordsSelection } from './useStatementRecordsSelection';
import { useStatementsManager } from './useStatementsManager';

import type { CommissionsViewProps } from '../commissionsViewTypes';

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

export const useCommissionsController = ({
  payments,
  policies,
  statements,
  salesChannels,
  currentUser,
  isLoading = false,
  hasCommissionsSnapshotLoaded = false,
  onRefreshStatements,
  onLoadMoreStatements,
  statementsTotalCount = statements.length,
  statementsHasMore = false,
  isLoadingMoreStatements = false,
  onDealSelect,
  onDealPreview,
  onRequestEditPolicy,
  onUpdateFinancialRecord,
  onDeleteStatement,
  onAttachStatementRecords,
  onRemoveStatementRecords,
  onApplyStatementAmount,
  onCreateStatement,
  onUpdateStatement,
}: CommissionsViewProps) => {
  const navigate = useNavigate();
  const [financeSearchParams, setFinanceSearchParams] = useSearchParams();
  const { confirm, ConfirmDialogRenderer } = useConfirm();
  const [isReopeningStatement, setIsReopeningStatement] = useState(false);
  const [reopenStatementError, setReopenStatementError] = useState<string | null>(null);
  const canReopenStatement = Boolean(
    currentUser?.isStaff ||
    currentUser?.roles?.some((role) => role === 'Admin' || role === 'Администратор'),
  );

  const [viewMode, setViewMode] = useState<'all' | 'statements'>(() =>
    financeSearchParams.get('financeView') === 'all' ? 'all' : 'statements',
  );
  const [statementTab, setStatementTab] = useState<'records' | 'files'>(() =>
    financeSearchParams.get('statementTab') === 'files' ? 'files' : 'records',
  );
  const [showPaidStatements, setShowPaidStatements] = useState(
    () => financeSearchParams.get('showPaidStatements') === '1',
  );
  const [editingPolicyRecordId, setEditingPolicyRecordId] = useState<string | null>(null);
  const [policyEditError, setPolicyEditError] = useState<string | null>(null);

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
  const {
    allRecordsSearchInput,
    setAllRecordsSearchInput,
    applyAllRecordsSearch,
    showUnpaidPayments,
    setShowUnpaidPayments,
    showStatementRecords,
    setShowStatementRecords,
    showPaidRecords,
    setShowPaidRecords,
    showZeroSaldo,
    setShowZeroSaldo,
    salesChannelFilter,
    setSalesChannelFilter,
    paymentScheduledDateFrom,
    setPaymentScheduledDateFrom,
    paymentScheduledDateTo,
    setPaymentScheduledDateTo,
    activeAllRecordsFilterCount,
    canResetAllRecordsFilters,
    resetAllRecordsFilters,
    applyProcessingPreset,
    isAllRecordsExporting,
    allRecordsExportError,
    allRecordsExportFile,
    exportAllRecords,
    recordTypeFilter,
    setRecordTypeFilter,
    targetStatementId,
    setTargetStatementId,
    isRecordTypeLocked,
    allRecords,
    isAllRecordsLoading,
    isAllRecordsLoadingMore,
    allRecordsError,
    allRecordsHasMore,
    allRecordsTotalCount,
    allRecordsSummary,
    allRecordsFilterKey,
    applyAttachedRecords,
    loadAllRecords,
    toggleAllRecordsSort,
    getAllRecordsSortLabel,
    getAllRecordsSortIndicator,
  } = useAllRecordsController({
    viewMode,
    statementsById,
  });
  const {
    selectedStatementId,
    setSelectedStatementId,
    selectedStatement,
    isSelectedStatementPaid,
    selectedStatementTypeLabel,
    selectedStatementStatusLabel,
    selectedStatementPaidAt,
    attachStatement,
    isAttachStatementPaid,
  } = useCommissionsViewModel({
    statements,
    statementsById,
    viewMode,
    targetStatementId,
    initialSelectedStatementId: financeSearchParams.get('statementId'),
  });
  useEffect(() => {
    const next = new URLSearchParams(financeSearchParams);
    if (viewMode === 'all') next.set('financeView', 'all');
    else next.delete('financeView');
    if (selectedStatementId) next.set('statementId', selectedStatementId);
    else next.delete('statementId');
    if (statementTab === 'files') next.set('statementTab', 'files');
    else next.delete('statementTab');
    if (showPaidStatements) next.set('showPaidStatements', '1');
    else next.delete('showPaidStatements');
    if (next.toString() !== financeSearchParams.toString()) {
      setFinanceSearchParams(next, { replace: true });
    }
  }, [
    financeSearchParams,
    selectedStatementId,
    setFinanceSearchParams,
    showPaidStatements,
    statementTab,
    viewMode,
  ]);

  useLayoutEffect(() => {
    setViewMode(financeSearchParams.get('financeView') === 'all' ? 'all' : 'statements');
    setStatementTab(financeSearchParams.get('statementTab') === 'files' ? 'files' : 'records');
    setShowPaidStatements(financeSearchParams.get('showPaidStatements') === '1');
    const statementId = financeSearchParams.get('statementId');
    if (statementId) setSelectedStatementId(statementId);
  }, [financeSearchParams, setSelectedStatementId]);
  const handleReopenStatement = useCallback(async () => {
    if (!selectedStatementId || isReopeningStatement) return;
    const confirmed = await confirm({
      title: 'Отменить выплату ведомости?',
      message: 'Дата выплаты и даты всех записей ведомости будут очищены.',
      confirmText: 'Отменить выплату',
      tone: 'danger',
    });
    if (!confirmed) return;
    setIsReopeningStatement(true);
    setReopenStatementError(null);
    try {
      await reopenFinanceStatement(selectedStatementId);
      await onRefreshStatements?.();
    } catch (error) {
      setReopenStatementError(formatErrorMessage(error, 'Не удалось отменить выплату ведомости.'));
    } finally {
      setIsReopeningStatement(false);
    }
  }, [confirm, isReopeningStatement, onRefreshStatements, selectedStatementId]);
  const {
    statementRecords,
    isStatementRecordsLoading,
    statementRecordsError,
    statementRecordsHasMore,
    isStatementRecordsLoadingMore,
    loadStatementRecords,
    toggleAmountSort,
    getAmountSortIndicator,
    getAmountSortLabel,
    toggleCommentSort,
    getCommentSortIndicator,
    getCommentSortLabel,
  } = useStatementRecordsController({
    selectedStatementId,
    viewMode,
  });
  const {
    amountDrafts,
    statementAmountDraft,
    isApplyingStatementAmount,
    savingRecordIds,
    recordAmountErrors,
    getAbsoluteSaldoBase,
    getPercentFromSaldo,
    handleRecordAmountChange,
    toggleRecordAmountMode,
    handleRecordAmountBlur,
    cancelRecordAmountEdit,
    handleStatementAmountChange,
    toggleStatementAmountMode,
    applyStatementAmountToRows,
  } = useRecordAmountEditing({
    onUpdateFinancialRecord: async (recordId, values) => {
      await onUpdateFinancialRecord?.(recordId, values);
      await onRefreshStatements?.();
      if (viewMode === 'statements') {
        await loadStatementRecords();
      }
    },
    onApplyStatementAmount: async (statementId, values) => {
      await onApplyStatementAmount?.(statementId, values);
      await onRefreshStatements?.();
      if (viewMode === 'statements') {
        await loadStatementRecords();
      }
    },
    isRowAmountLocked: (row) =>
      Boolean(row.statementId && statementsById.get(row.statementId)?.paidAt),
  });
  const { filteredRows } = useCommissionsRows({
    statementRecords,
    allRecords,
    paymentsById,
    selectedStatementId,
    viewMode,
    statementOrderingManagedByServer: true,
  });

  const {
    isStatementDriveLoading,
    isStatementDriveUploading,
    isStatementDriveTrashing,
    isStatementDriveDownloading,
    selectedStatementDriveFileIds,
    statementDriveError,
    statementDriveTrashMessage,
    statementDriveDownloadMessage,
    statementDriveFolderLink,
    hasStatementDriveFolder,
    sortedStatementDriveFiles,
    loadStatementDriveFiles,
    setStatementDriveDownloadMessage,
    toggleStatementDriveFileSelection,
    handleTrashSelectedStatementDriveFiles,
    handleDownloadStatementDriveFiles,
    handleStatementDriveDelete,
    handleUploadStatementDriveFile,
  } = useStatementDriveManager({
    selectedStatement,
    statementTab,
    viewMode,
    confirm,
  });

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

  const handleEditPolicyFromRecord = useCallback(
    async (row: IncomeExpenseRow) => {
      const policyId = row.policyId ?? row.payment.policyId;
      if (!onRequestEditPolicy || !policyId) {
        return;
      }

      setPolicyEditError(null);
      const existingPolicy = policiesById.get(policyId);
      setEditingPolicyRecordId(row.recordId);
      try {
        const policy = existingPolicy ?? (await fetchPolicy(policyId));
        await onRequestEditPolicy(policy);
      } catch (error) {
        setPolicyEditError(
          formatErrorMessage(error, 'Не удалось открыть полис для редактирования.'),
        );
      } finally {
        setEditingPolicyRecordId(null);
      }
    },
    [onRequestEditPolicy, policiesById],
  );

  const {
    selectedRecordIds,
    selectableRecordIds,
    allSelectableSelected,
    selectAllRef,
    canAttachRow,
    toggleRecordSelection,
    handleAttachSelected,
    isAttaching,
    handleRemoveSelected,
    toggleSelectAll,
    resetSelection,
  } = useStatementRecordsSelection({
    attachStatement,
    selectedStatement,
    isAttachStatementPaid,
    filteredRows,
    viewMode,
    onAttachStatementRecords,
    onRemoveStatementRecords: async (statementId, recordIds) => {
      await onRemoveStatementRecords?.(statementId, recordIds);
      await onRefreshStatements?.();
    },
    onAttachAllRecords: (recordIds, statementId) => {
      applyAttachedRecords(recordIds, statementId, allRecordsFilterKey);
    },
    onRefreshStatementRecords: loadStatementRecords,
  });

  useEffect(() => {
    resetSelection();
  }, [allRecordsFilterKey, resetSelection, selectedStatementId, targetStatementId, viewMode]);

  const {
    isStatementModalOpen,
    setStatementModalOpen,
    isStatementCreating,
    statementForm,
    setStatementForm,
    statementFormError,
    handleCreateStatement,
    editingStatement,
    setEditingStatement,
    editStatementForm,
    setEditStatementForm,
    editStatementFormError,
    handleEditStatementOpen,
    handleEditStatementSubmit,
    deletingStatement,
    setDeletingStatement,
    handleDeleteStatementConfirm,
    isStatementExporting,
    statementExportError,
    handleExportStatement,
  } = useStatementsManager({
    selectedStatementId,
    selectedStatement,
    onCreateStatement: async (values) => {
      const created = await onCreateStatement?.(values);
      await onRefreshStatements?.();
      return created as Statement;
    },
    onUpdateStatement: async (statementId, values) => {
      const updated = await onUpdateStatement?.(statementId, values);
      await onRefreshStatements?.();
      if (viewMode === 'statements') {
        await loadStatementRecords();
      }
      return updated as Statement;
    },
    onDeleteStatement: async (statementId) => {
      await onDeleteStatement?.(statementId);
      await onRefreshStatements?.();
    },
    confirm,
    resetSelection,
    setSelectedStatementId,
    setStatementTab,
    loadStatementDriveFiles,
    setStatementDriveDownloadMessage,
  });

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
      savingRecordIds={savingRecordIds}
      recordAmountErrors={recordAmountErrors}
      statementAmountDraft={statementAmountDraft}
      isApplyingStatementAmount={isApplyingStatementAmount}
      isAttaching={isAttaching}
      isAllRecordsLoading={isAllRecordsLoading}
      isStatementRecordsLoading={isStatementRecordsLoading}
      isRecordAmountEditable={Boolean(onUpdateFinancialRecord)}
      canAttachSelectedAction={Boolean(onAttachStatementRecords)}
      canRemoveSelectedAction={Boolean(onRemoveStatementRecords)}
      normalizeText={normalizeText}
      canAttachRow={canAttachRow}
      onAttachSelected={handleAttachSelected}
      onRemoveSelected={handleRemoveSelected}
      onResetSelection={resetSelection}
      onToggleSelectAll={toggleSelectAll}
      onToggleRecordSelection={toggleRecordSelection}
      onOpenDeal={handleOpenDeal}
      onDealSelect={onDealSelect}
      onRequestEditPolicy={onRequestEditPolicy ? handleEditPolicyFromRecord : undefined}
      editingPolicyRecordId={editingPolicyRecordId}
      onToggleAllRecordsSort={toggleAllRecordsSort}
      getAllRecordsSortLabel={getAllRecordsSortLabel}
      getAllRecordsSortIndicator={getAllRecordsSortIndicator}
      onToggleAmountSort={toggleAmountSort}
      getAmountSortLabel={getAmountSortLabel}
      getAmountSortIndicator={getAmountSortIndicator}
      onToggleCommentSort={toggleCommentSort}
      getCommentSortLabel={getCommentSortLabel}
      getCommentSortIndicator={getCommentSortIndicator}
      getPercentFromSaldo={getPercentFromSaldo}
      getAbsoluteSaldoBase={getAbsoluteSaldoBase}
      onRecordAmountChange={handleRecordAmountChange}
      onRecordAmountBlur={handleRecordAmountBlur}
      onCancelRecordAmountEdit={cancelRecordAmountEdit}
      onToggleRecordAmountMode={toggleRecordAmountMode}
      onStatementAmountChange={handleStatementAmountChange}
      onToggleStatementAmountMode={toggleStatementAmountMode}
      onApplyStatementAmount={() => applyStatementAmountToRows(selectedStatement?.id, filteredRows)}
    />
  );

  const statementTabs = [
    { id: 'records' as const, label: 'Записи', count: selectedStatement?.recordsCount ?? 0 },
    { id: 'files' as const, label: 'Файлы', count: sortedStatementDriveFiles.length },
  ];
  const visibleStatements = showPaidStatements
    ? statements
    : statements.filter((statement) => !statement.paidAt);
  const hasAnyFinanceData = statements.length > 0;
  const shouldShowStatementsPendingState =
    viewMode === 'statements' && !hasCommissionsSnapshotLoaded && (isLoading || hasAnyFinanceData);

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
      hasStatementDriveFolder={hasStatementDriveFolder}
      sortedStatementDriveFiles={sortedStatementDriveFiles}
      onRefresh={() => {
        if (!selectedStatement) {
          return;
        }
        void loadStatementDriveFiles(selectedStatement.id);
      }}
      onUpload={handleUploadStatementDriveFile}
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
  return {
    isLoading,
    viewMode,
    setViewMode,
    statements,
    statementsTotalCount,
    onCreateStatement,
    setStatementModalOpen,
    showPaidStatements,
    setShowPaidStatements,
    shouldShowStatementsPendingState,
    statementsHasMore,
    isLoadingMoreStatements,
    onLoadMoreStatements,
    visibleStatements,
    selectedStatementId,
    setSelectedStatementId,
    normalizeText,
    selectedStatement,
    selectedStatementTypeLabel,
    selectedStatementStatusLabel,
    selectedStatementPaidAt,
    onUpdateStatement,
    handleEditStatementOpen,
    isSelectedStatementPaid,
    canReopenStatement,
    handleReopenStatement,
    isReopeningStatement,
    reopenStatementError,
    onDeleteStatement,
    setDeletingStatement,
    isStatementExporting,
    handleExportStatement,
    statementExportError,
    statementTabs,
    statementTab,
    setStatementTab,
    statementRecordsError,
    loadStatementRecords,
    recordsTable,
    statementRecordsHasMore,
    isStatementRecordsLoading,
    isStatementRecordsLoadingMore,
    statementFilesTab,
    policyEditError,
    allRecordsSearchInput,
    setAllRecordsSearchInput,
    applyAllRecordsSearch,
    allRecordsError,
    isAllRecordsLoading,
    loadAllRecords,
    showUnpaidPayments,
    setShowUnpaidPayments,
    showStatementRecords,
    setShowStatementRecords,
    showPaidRecords,
    setShowPaidRecords,
    showZeroSaldo,
    setShowZeroSaldo,
    salesChannelFilter,
    setSalesChannelFilter,
    salesChannels,
    paymentScheduledDateFrom,
    setPaymentScheduledDateFrom,
    paymentScheduledDateTo,
    setPaymentScheduledDateTo,
    activeAllRecordsFilterCount,
    canResetAllRecordsFilters,
    resetAllRecordsFilters,
    applyProcessingPreset,
    allRecordsSummary,
    isAllRecordsExporting,
    allRecordsExportError,
    allRecordsExportFile,
    exportAllRecords,
    recordTypeFilter,
    setRecordTypeFilter,
    isRecordTypeLocked,
    targetStatementId,
    setTargetStatementId,
    allRecords,
    allRecordsTotalCount,
    isAllRecordsLoadingMore,
    allRecordsHasMore,
    isStatementModalOpen,
    isStatementCreating,
    statementForm,
    statementFormError,
    handleCreateStatement,
    setStatementForm,
    editingStatement,
    editStatementForm,
    editStatementFormError,
    setEditingStatement,
    handleEditStatementSubmit,
    setEditStatementForm,
    deletingStatement,
    handleDeleteStatementConfirm,
    ConfirmDialogRenderer,
  };
};

export type CommissionsController = ReturnType<typeof useCommissionsController>;
