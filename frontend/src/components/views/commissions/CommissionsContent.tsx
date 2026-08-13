import type { CommissionsController } from './hooks/useCommissionsController';
import { PanelMessage } from '../../PanelMessage';
import { Button } from '../../common/Button';
import { Tabs } from '../../common/Tabs';
import { handleTabKeyboardNavigation } from '../../common/tabKeyboard';
import { formatCurrencyRu, formatDateRu } from '../../../utils/formatting';
import { CreateStatementModal } from './CreateStatementModal';
import { DeleteStatementModal } from './DeleteStatementModal';
import { EditStatementModal } from './EditStatementModal';
import { AllRecordsPanel } from './AllRecordsPanel';
import { PageHeader } from '../../common/layoutPrimitives';

const STATEMENT_TAB_IDS = ['records', 'files'] as const;

export const CommissionsContent = ({ model }: { model: CommissionsController }) => {
  const {
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
  } = model;
  if (isLoading) {
    return (
      <section aria-labelledby="commissionsViewHeading" className="app-page">
        <PageHeader titleId="commissionsViewHeading" title="Доходы и расходы" />
        <PanelMessage>Загружаем финансовые данные...</PanelMessage>
      </section>
    );
  }

  return (
    <section aria-labelledby="commissionsViewHeading" className="app-page">
      <PageHeader
        titleId="commissionsViewHeading"
        title="Доходы и расходы"
        description="Финансовые ведомости, выплаты и связанные документы"
      />
      <Tabs
        idPrefix="financial-tab"
        ariaLabel="Разделы доходов и расходов"
        value={viewMode}
        onChange={setViewMode}
        className="[&>button]:min-w-[220px]"
        options={[
          {
            value: 'statements',
            label: 'Ведомости',
            controls: 'financial-tabpanel-statements',
          },
          {
            value: 'all',
            label: 'Все финансовые записи',
            controls: 'financial-tabpanel-all',
          },
        ]}
      />

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
                    Показано: {statements.length} из {statementsTotalCount}
                  </span>
                </div>
                <p className="text-sm text-slate-600">
                  Выберите ведомость, чтобы посмотреть ее записи.
                </p>
              </div>
              {onCreateStatement && (
                <div className="mt-3 flex flex-wrap items-center gap-4">
                  <Button
                    type="button"
                    onClick={() => setStatementModalOpen(true)}
                    variant="secondary"
                    size="sm"
                  >
                    + Создать ведомость
                  </Button>
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
              {!shouldShowStatementsPendingState && statementsHasMore && (
                <div className="border-t border-slate-200 p-3 text-center">
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    disabled={isLoadingMoreStatements}
                    onClick={() => void onLoadMoreStatements?.()}
                  >
                    {isLoadingMoreStatements ? 'Загружаем…' : 'Показать ещё ведомости'}
                  </Button>
                </div>
              )}
            </div>

            <div className="max-h-[360px] overflow-y-auto bg-white border-t border-slate-200">
              {shouldShowStatementsPendingState ? (
                <div className="px-6 py-10 text-center">
                  <PanelMessage>Загружаем согласованное состояние ведомостей...</PanelMessage>
                </div>
              ) : visibleStatements.length ? (
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
                          <Button
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
                          </Button>
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
              {shouldShowStatementsPendingState ? (
                <div className="bg-white px-6 py-10 text-center">
                  <PanelMessage>Загружаем согласованное состояние ведомостей...</PanelMessage>
                </div>
              ) : selectedStatement ? (
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
                          <p className={'ui-status-danger-text-xs'}>
                            Выплаченная ведомость недоступна для редактирования и удаления.
                          </p>
                        )}
                      </div>

                      <div className="flex flex-wrap items-center justify-end gap-3">
                        <div className="flex flex-wrap items-center gap-2">
                          <Button
                            type="button"
                            onClick={() => void handleExportStatement()}
                            disabled={isStatementExporting}
                            variant="secondary"
                            title="Сформировать XLSX-файл ведомости и сохранить в Google Drive"
                          >
                            {isStatementExporting ? 'Формируем...' : 'Сформировать ведомость'}
                          </Button>
                          {onUpdateStatement && (
                            <Button
                              type="button"
                              onClick={() => handleEditStatementOpen(selectedStatement)}
                              disabled={isSelectedStatementPaid}
                              variant="primary"
                            >
                              Редактировать
                            </Button>
                          )}
                          {selectedStatement.paidAt && canReopenStatement && (
                            <Button
                              type="button"
                              onClick={() => void handleReopenStatement()}
                              disabled={isReopeningStatement}
                              variant="danger"
                            >
                              {isReopeningStatement ? 'Отменяем…' : 'Отменить выплату'}
                            </Button>
                          )}
                          {reopenStatementError && (
                            <span role="alert" className={'ui-status-danger-text-xs'}>
                              {reopenStatementError}
                            </span>
                          )}
                          {onDeleteStatement && (
                            <Button
                              type="button"
                              onClick={() => setDeletingStatement(selectedStatement)}
                              disabled={isSelectedStatementPaid}
                              variant="danger"
                            >
                              Удалить
                            </Button>
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
                      className="app-segmented-control scrollbar-none"
                    >
                      {statementTabs.map((tab) => {
                        const isActive = statementTab === tab.id;
                        return (
                          <Button
                            key={tab.id}
                            id={`statement-tab-${tab.id}`}
                            role="tab"
                            aria-label={tab.label}
                            aria-selected={isActive}
                            aria-controls={`statement-tabpanel-${tab.id}`}
                            tabIndex={isActive ? 0 : -1}
                            type="button"
                            onClick={() => setStatementTab(tab.id)}
                            onKeyDown={(event) =>
                              handleTabKeyboardNavigation({
                                event,
                                tabs: STATEMENT_TAB_IDS,
                                activeTab: statementTab,
                                onChange: setStatementTab,
                                getTabElementId: (tabId) => `statement-tab-${tabId}`,
                              })
                            }
                            className={`app-segmented-control-button min-w-[120px] ${
                              isActive
                                ? 'border border-[var(--app-border)] bg-white font-semibold text-sky-700 shadow-sm'
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
                          </Button>
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
                      {statementRecordsError && (
                        <div className="mb-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                          <div className="flex flex-wrap items-center justify-between gap-3">
                            <span>{statementRecordsError}</span>
                            <Button
                              type="button"
                              onClick={() => {
                                void loadStatementRecords();
                              }}
                              variant="secondary"
                              size="sm"
                            >
                              Повторить
                            </Button>
                          </div>
                        </div>
                      )}
                      {recordsTable}
                      {statementRecordsHasMore && (
                        <div className="mt-4 flex justify-center">
                          <Button
                            type="button"
                            variant="secondary"
                            size="sm"
                            disabled={isStatementRecordsLoading || isStatementRecordsLoadingMore}
                            onClick={() => void loadStatementRecords('more')}
                          >
                            {isStatementRecordsLoadingMore ? 'Загружаем...' : 'Показать ещё'}
                          </Button>
                        </div>
                      )}
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
          {policyEditError && (
            <p className={`px-4 pt-3 ${'ui-status-danger-text-xs'}`}>{policyEditError}</p>
          )}
          <AllRecordsPanel
            allRecordsSearchInput={allRecordsSearchInput}
            onSearchChange={setAllRecordsSearchInput}
            onSearchSubmit={applyAllRecordsSearch}
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
            salesChannelFilter={salesChannelFilter}
            onSalesChannelFilterChange={setSalesChannelFilter}
            salesChannels={salesChannels}
            paymentScheduledDateFrom={paymentScheduledDateFrom}
            onPaymentScheduledDateFromChange={setPaymentScheduledDateFrom}
            paymentScheduledDateTo={paymentScheduledDateTo}
            onPaymentScheduledDateToChange={setPaymentScheduledDateTo}
            activeAllRecordsFilterCount={activeAllRecordsFilterCount}
            canResetAllRecordsFilters={canResetAllRecordsFilters}
            onResetAllRecordsFilters={resetAllRecordsFilters}
            onApplyProcessingPreset={applyProcessingPreset}
            summary={allRecordsSummary}
            isAllRecordsExporting={isAllRecordsExporting}
            allRecordsExportError={allRecordsExportError}
            allRecordsExportFile={allRecordsExportFile}
            onExportAllRecords={exportAllRecords}
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
        error={statementFormError}
        onClose={() => setStatementModalOpen(false)}
        onSubmit={handleCreateStatement}
        onFormChange={setStatementForm}
      />
      <EditStatementModal
        isOpen={Boolean(editingStatement)}
        form={editStatementForm}
        error={editStatementFormError}
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
