import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import type { FinancialRecord, Payment, Policy, Statement } from '../../types';
import type { AddFinancialRecordFormValues } from '../forms/AddFinancialRecordForm';
import { PanelMessage } from '../PanelMessage';
import { formatCurrencyRu, formatDateRu } from '../../utils/formatting';
import { useConfirm } from '../../hooks/useConfirm';
import { CreateStatementModal } from './commissions/CreateStatementModal';
import { DeleteStatementModal } from './commissions/DeleteStatementModal';
import { EditStatementModal } from './commissions/EditStatementModal';
import { AllRecordsPanel } from './commissions/AllRecordsPanel';
import { RecordsTable } from './commissions/RecordsTable';
import { StatementFilesTab } from './commissions/StatementFilesTab';
import { useAllRecordsController } from './commissions/hooks/useAllRecordsController';
import { useCommissionsRows } from './commissions/hooks/useCommissionsRows';
import { useCommissionsViewModel } from './commissions/hooks/useCommissionsViewModel';
import { useRecordAmountEditing } from './commissions/hooks/useRecordAmountEditing';
import { useStatementDriveManager } from './commissions/hooks/useStatementDriveManager';
import { useStatementRecordsSelection } from './commissions/hooks/useStatementRecordsSelection';
import { useStatementsManager } from './commissions/hooks/useStatementsManager';

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

  const [viewMode, setViewMode] = useState<'all' | 'statements'>('all');
  const [statementTab, setStatementTab] = useState<'records' | 'files'>('records');
  const [showPaidStatements, setShowPaidStatements] = useState(false);

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
    allRecordsSearch,
    setAllRecordsSearch,
    showUnpaidPayments,
    setShowUnpaidPayments,
    showStatementRecords,
    setShowStatementRecords,
    showPaidRecords,
    setShowPaidRecords,
    showZeroSaldo,
    setShowZeroSaldo,
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
    loadAllRecords,
    toggleAllRecordsSort,
    getAllRecordsSortLabel,
    getAllRecordsSortIndicator,
  } = useAllRecordsController({
    viewMode,
    statementsById,
  });
  const {
    amountDrafts,
    getAbsoluteSaldoBase,
    getPercentFromSaldo,
    handleRecordAmountChange,
    toggleRecordAmountMode,
    handleRecordAmountBlur,
  } = useRecordAmountEditing({
    onUpdateFinancialRecord,
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
  });
  const { filteredRows, toggleAmountSort, getAmountSortIndicator, getAmountSortLabel } =
    useCommissionsRows({
      payments,
      allRecords,
      paymentsById,
      selectedStatementId,
      viewMode,
    });

  useEffect(() => {
    setStatementTab('records');
  }, [selectedStatementId]);

  useEffect(() => {
    if (viewMode !== 'statements') {
      setStatementTab('records');
    }
  }, [viewMode]);

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

  const {
    selectedRecordIds,
    selectableRecordIds,
    allSelectableSelected,
    selectAllRef,
    canAttachRow,
    toggleRecordSelection,
    handleAttachSelected,
    handleRemoveSelected,
    toggleSelectAll,
    resetSelection,
  } = useStatementRecordsSelection({
    attachStatement,
    selectedStatement,
    isAttachStatementPaid,
    filteredRows,
    viewMode,
    onUpdateStatement,
    onRemoveStatementRecords,
    onRefreshAllRecords: async () => {
      await loadAllRecords('reset');
    },
  });

  useEffect(() => {
    resetSelection();
  }, [resetSelection, selectedStatementId, targetStatementId, viewMode]);

  const {
    isStatementModalOpen,
    setStatementModalOpen,
    isStatementCreating,
    statementForm,
    setStatementForm,
    handleCreateStatement,
    editingStatement,
    setEditingStatement,
    editStatementForm,
    setEditStatementForm,
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
    onCreateStatement,
    onUpdateStatement,
    onDeleteStatement,
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
      isAllRecordsLoading={isAllRecordsLoading}
      isRecordAmountEditable={Boolean(onUpdateFinancialRecord)}
      canAttachSelectedAction={Boolean(onUpdateStatement)}
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
  const visibleStatements = showPaidStatements
    ? statements
    : statements.filter((statement) => !statement.paidAt);

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
              {visibleStatements.length ? (
                <ul className="divide-y divide-slate-200">
                  {visibleStatements.map((statement) => {
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
