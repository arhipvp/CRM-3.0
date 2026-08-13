import { Button } from '../../common/Button';
import { DateInput } from '../../common/forms/DateInput';
import { FormActions } from '../../common/forms/FormActions';
import { FormField } from '../../common/forms/FormField';
import { InlineAlert } from '../../common/InlineAlert';
import { FormModal } from '../../common/modal/FormModal';
import { DealActions } from './DealActions';
import { DealDateControls } from './DealDateControls';
import { DealDetailsPanelModals } from './DealDetailsPanelModals';
import { DealDetailsPanelTabContent } from './DealDetailsPanelTabContent';
import { DealHeader } from './DealHeader';
import { DealTabs } from './DealTabs';
import { formatDate, getDealTabGroup, type DealTabId } from './helpers';
import type { useDealDetailsPanelController } from './hooks/useDealDetailsPanelController';

type DealDetailsPanelViewModel = ReturnType<typeof useDealDetailsPanelController>;

export function DealDetailsPanelView(viewModel: DealDetailsPanelViewModel) {
  const {
    ConfirmDialogRenderer,
    accessMessage,
    actionError,
    activeTab,
    activityError,
    activityLogs,
    attachNoteFile,
    canRecognizeSelectedFiles,
    canReopenClosedDeal,
    chatCount,
    chatError,
    chatMessages,
    clientDuplicateHint,
    clients,
    closeDealReason,
    closeDealReasonError,
    closeFinancialRecordModal,
    closeMergeModal,
    closePaymentModal,
    closeSimilarModal,
    completingTaskIds,
    continueFromSimilarToMerge,
    continueTracking,
    currentUser,
    dealEventsError,
    dealRefreshError,
    dealTimelineEvents,
    deals,
    delayLeadDaysLoading,
    displayedTasks,
    downloadMessage,
    driveError,
    driveSortDirection,
    editingFinancialRecord,
    editingFinancialRecordId,
    editingPayment,
    editingPaymentId,
    editingTask,
    editingTaskId,
    executorDisplayName,
    expandedFolderIds,
    expectedCloseInputValue,
    expectedCloseReasons,
    filesCount,
    financialRecordDefaultRecordType,
    financialRecordPaymentId,
    getDriveFileBlob,
    getDriveFileDepth,
    handleAddNote,
    handleArchiveNote,
    handleChatDelete,
    handleChatSendMessage,
    handleCheckMailbox,
    handleCloseDealClick,
    handleCloseDealConfirm,
    handleCloseManualEventModal,
    handleCreateMailbox,
    handleDeleteDealClick,
    handleDeleteManualDealEvent,
    handleDownloadDriveFiles,
    handleDriveFileUpload,
    handleEditDealClick,
    handleManualEventSubmit,
    handleMarkTaskDone,
    handleMergeClick,
    handleMergeSubmit,
    handleNextContactBlur,
    handleNextContactChange,
    handleOpenClient,
    handleOpenManualEventModal,
    handleQuickEventDelay,
    handleQuickNextContactShift,
    handleRecognizePolicies,
    handleRefreshDealWithContext,
    handleRenameDriveFile,
    handleReopenDealClick,
    handleRestoreDealClick,
    handleRestoreNote,
    handleSimilarClick,
    handleTrashDriveFile,
    handleTrashSelectedFiles,
    handleUpdateManualDealEvent,
    handleUploadAndRecognizePolicyFiles,
    headerExpectedCloseTone,
    isActivityLoading,
    isChatLoading,
    isCheckingMailbox,
    isCloseDealPromptOpen,
    isClosingDeal,
    isCreatingMailbox,
    isCreatingTask,
    isCurrentUserSeller,
    isDealClosedStatus,
    isDealEventsLoading,
    isDealRefreshing,
    isDeletingDeal,
    isDownloading,
    isDriveLoading,
    isEditingDeal,
    isFinancialRecordModalOpen,
    isFolderLoading,
    isManualEventModalOpen,
    isManualEventSaving,
    isMergeModalOpen,
    isMergePreviewConfirmed,
    isMergePreviewLoading,
    isMergeSearchActive,
    isMergeSearchLoading,
    isMerging,
    isPaymentModalOpen,
    isPoliciesRefreshing,
    isQuotesLoading,
    isRecognizing,
    isRenaming,
    isReopeningDeal,
    isRestoringDeal,
    isSchedulingDelay,
    isSelectedDealDeleted,
    isSimilarLoading,
    isSimilarModalOpen,
    isTasksLoading,
    isTimeTrackingConfirmModalOpen,
    isTrashing,
    loadChatMessages,
    loadDriveFiles,
    mailboxActionError,
    mailboxActionSuccess,
    manualEventDate,
    manualEventError,
    manualEventReason,
    mergeError,
    mergeFinalDraft,
    mergeList,
    mergePreviewWarnings,
    mergeQuery,
    mergeSearch,
    mergeSources,
    mergeStep,
    myTotalLabel,
    nextContactInputValue,
    noteAttachments,
    noteAttachmentsUploading,
    noteDraft,
    noteIsImportant,
    notes,
    notesAction,
    notesError,
    notesFilter,
    notesLoading,
    onAddFinancialRecord,
    onAddPayment,
    onClearAccessMessage,
    onClearDealFocus,
    onClientEdit,
    onClientFindSimilar,
    onClientNormalizeName,
    onCreateTask,
    onDeleteFinancialRecord,
    onDeletePayment,
    onDeletePolicy,
    onDeleteQuote,
    onDeleteTask,
    onMarkFinancialRecordPaid,
    onMarkPaymentPaid,
    onMovePolicy,
    onPendingDealClientConsumed,
    onPostponeDeal,
    onRefreshDeal,
    onRequestAddClient,
    onRequestAddPolicy,
    onRequestAddQuote,
    onRequestEditPolicy,
    onRequestEditQuote,
    onSelectDeal,
    onUpdateDeal,
    onUpdateFinancialRecord,
    onUpdatePayment,
    onUpdatePolicyRenewed,
    onUpdateTask,
    paymentFixedPolicyId,
    pendingDealClientId,
    policiesCount,
    policySortKey,
    policySortOrder,
    quickEventDelayEvent,
    quickEventDelayLabel,
    quickEventDelayNextContact,
    quickEventDelayTitle,
    quickInlineDateOptions,
    quickInlinePostponeShift,
    quickInlineShift,
    quotes,
    quotesCount,
    recognitionMessage,
    recognitionResults,
    relatedPayments,
    relatedPolicies,
    relatedTasks,
    removeNoteAttachment,
    renameMessage,
    requestMergePreview,
    selectedClient,
    selectedClientDisplayName,
    selectedDeal,
    selectedDriveFileIds,
    selectedSimilarIds,
    sellerDisplayName,
    setActiveTab,
    setCloseDealReason,
    setCreatingFinancialRecordContext,
    setCreatingPaymentPolicyId,
    setEditingFinancialRecordId,
    setEditingPaymentId,
    setEditingTaskId,
    setIsCloseDealPromptOpen,
    setIsCreatingTask,
    setIsEditingDeal,
    setManualEventDate,
    setManualEventReason,
    setMergeSearch,
    setMergeStep,
    setNoteDraft,
    setNoteIsImportant,
    setNotesFilter,
    setPolicySortKey,
    setPolicySortOrder,
    setSimilarIncludeClosed,
    similarCandidates,
    similarError,
    similarIncludeClosed,
    sortedDriveFiles,
    sortedPolicies,
    tasksCount,
    toggleDriveFileSelection,
    toggleDriveSortDirection,
    toggleFolderExpanded,
    toggleMergeSource,
    toggleSimilarCandidate,
    trashMessage,
    users,
  } = viewModel;
  return (
    <>
      <div className="space-y-4 px-4 py-5">
        {selectedDeal ? (
          <div
            className={`relative space-y-6 rounded-3xl border bg-white p-6 shadow-[0_18px_40px_rgba(15,23,42,0.09)] ${
              selectedDeal.isPinned
                ? 'border-rose-500 ring-2 ring-rose-500/30'
                : 'border-blue-500 ring-2 ring-blue-400/30'
            }`}
          >
            <Button
              type="button"
              onClick={onClearDealFocus}
              className="icon-btn absolute right-3 top-3 z-10 h-8 w-8"
              aria-label="Снять фокус со сделки"
              title="Снять фокус со сделки"
            >
              ✕
            </Button>
            <div className="flex flex-col gap-4">
              <DealHeader
                deal={selectedDeal}
                clientDisplayName={selectedClientDisplayName}
                client={selectedClient}
                clientDuplicateHint={clientDuplicateHint}
                clientPhone={selectedClient?.phone}
                sellerDisplayName={sellerDisplayName}
                executorDisplayName={executorDisplayName}
                myTrackedTimeLabel={myTotalLabel}
                onClientEdit={onClientEdit}
                onClientFindSimilar={onClientFindSimilar}
                onClientNormalizeName={onClientNormalizeName}
              />
              <DealActions
                isSelectedDealDeleted={isSelectedDealDeleted}
                isDeletingDeal={isDeletingDeal}
                isRestoringDeal={isRestoringDeal}
                isDealClosedStatus={isDealClosedStatus}
                isClosingDeal={isClosingDeal}
                isReopeningDeal={isReopeningDeal}
                isCurrentUserSeller={isCurrentUserSeller}
                canReopenClosedDeal={canReopenClosedDeal}
                onEdit={handleEditDealClick}
                onRestore={handleRestoreDealClick}
                onDelete={handleDeleteDealClick}
                onClose={handleCloseDealClick}
                onReopen={handleReopenDealClick}
                onMerge={handleMergeClick}
                onSimilar={handleSimilarClick}
                onRefresh={handleRefreshDealWithContext}
                isRefreshing={isDealRefreshing}
              />
            </div>
            {actionError && <InlineAlert>{actionError}</InlineAlert>}
            {dealRefreshError && <InlineAlert>{dealRefreshError}</InlineAlert>}
            <DealDateControls
              nextContactValue={nextContactInputValue}
              expectedCloseValue={formatDate(expectedCloseInputValue)}
              headerExpectedCloseTone={headerExpectedCloseTone}
              quickOptions={quickInlineDateOptions}
              eventDelayLabel={quickEventDelayLabel}
              eventDelayDisabled={
                !quickEventDelayEvent ||
                !quickEventDelayNextContact ||
                delayLeadDaysLoading ||
                isSchedulingDelay
              }
              eventDelayTitle={quickEventDelayTitle}
              onNextContactChange={handleNextContactChange}
              onNextContactBlur={handleNextContactBlur}
              onQuickShift={onPostponeDeal ? quickInlinePostponeShift : quickInlineShift}
              onEventDelayClick={() => void handleQuickEventDelay()}
              onAddEventClick={handleOpenManualEventModal}
              expectedCloseReason={expectedCloseReasons}
              isExpectedCloseReasonsLoading={isDealEventsLoading}
            />
            <div>
              <DealTabs
                activeTab={activeTab}
                onChange={(value) => setActiveTab(value as DealTabId)}
                tabCounts={{
                  tasks: tasksCount,
                  quotes: quotesCount,
                  policies: policiesCount,
                  chat: chatCount,
                  files: filesCount,
                  events: dealTimelineEvents.length,
                  history: activityLogs.length,
                }}
                loadingByTab={{
                  tasks: isTasksLoading,
                  quotes: isQuotesLoading,
                  policies: isPoliciesRefreshing,
                  chat: isChatLoading,
                  files: isDriveLoading,
                  events: isDealEventsLoading,
                  history: isActivityLoading,
                }}
              />
              <div
                className="min-h-[100dvh] border-t border-slate-100 pt-6 [overflow-anchor:none]"
                role="tabpanel"
                id={`deal-tabpanel-${activeTab}`}
                aria-labelledby={`deal-tab-group-${getDealTabGroup(activeTab).id}`}
                tabIndex={0}
              >
                <DealDetailsPanelTabContent
                  activeTab={activeTab}
                  notesSectionProps={{
                    dealId: selectedDeal?.id,
                    notes,
                    notesLoading,
                    notesFilter,
                    noteDraft,
                    noteIsImportant,
                    notesError,
                    notesAction,
                    noteAttachments,
                    noteAttachmentsUploading,
                    onSetFilter: setNotesFilter,
                    onSetDraft: setNoteDraft,
                    onToggleImportant: setNoteIsImportant,
                    onAddNote: handleAddNote,
                    onAttachNoteFile: attachNoteFile,
                    onRemoveNoteAttachment: removeNoteAttachment,
                    onArchiveNote: handleArchiveNote,
                    onRestoreNote: handleRestoreNote,
                  }}
                  tasksTabProps={{
                    selectedDeal,
                    displayedTasks,
                    relatedTasks,
                    onCreateTaskClick: () => setIsCreatingTask(true),
                    onEditTaskClick: setEditingTaskId,
                    onMarkTaskDone: handleMarkTaskDone,
                    onDeleteTask,
                    completingTaskIds,
                  }}
                  policiesTabProps={{
                    selectedDeal,
                    deals,
                    sortedPolicies,
                    policySortKey,
                    policySortOrder,
                    setPolicySortKey,
                    setPolicySortOrder,
                    onRequestAddPolicy,
                    onDeletePolicy,
                    onMovePolicy,
                    onUpdatePolicyRenewed,
                    onRequestEditPolicy,
                    relatedPayments,
                    clients,
                    onOpenClient: handleOpenClient,
                    setEditingPaymentId,
                    setCreatingPaymentPolicyId,
                    setCreatingFinancialRecordContext,
                    setEditingFinancialRecordId,
                    onDeleteFinancialRecord,
                    onDeletePayment,
                    onMarkPaymentPaid,
                    onMarkFinancialRecordPaid,
                    onDealSelect: onSelectDeal,
                    onUploadAndRecognizePolicyFiles: handleUploadAndRecognizePolicyFiles,
                    policyRecognitionMessage: recognitionMessage,
                    isRecognizingPolicyFiles: isRecognizing,
                    isLoading: isPoliciesRefreshing,
                  }}
                  quotesTabProps={{
                    selectedDeal,
                    quotes,
                    onRequestAddQuote,
                    onRequestEditQuote,
                    onDeleteQuote,
                  }}
                  filesTabProps={{
                    selectedDeal,
                    isDriveLoading,
                    loadDriveFiles,
                    onUploadDriveFile: handleDriveFileUpload,
                    isSelectedDealDeleted,
                    selectedDriveFileIds,
                    toggleDriveFileSelection,
                    handleRecognizePolicies,
                    isRecognizing,
                    recognitionResults,
                    recognitionMessage,
                    isTrashing,
                    trashMessage,
                    handleTrashSelectedFiles,
                    handleTrashDriveFile,
                    isDownloading,
                    downloadMessage,
                    handleDownloadDriveFiles,
                    getDriveFileBlob,
                    driveError,
                    sortedDriveFiles,
                    expandedFolderIds,
                    toggleFolderExpanded,
                    isFolderLoading,
                    getDriveFileDepth,
                    canRecognizeSelectedFiles,
                    driveSortDirection,
                    toggleDriveSortDirection,
                    isRenaming,
                    renameMessage,
                    handleRenameDriveFile,
                    isCreatingMailbox,
                    isCheckingMailbox,
                    mailboxActionError,
                    mailboxActionSuccess,
                    onCreateMailbox: handleCreateMailbox,
                    onCheckMailbox: handleCheckMailbox,
                  }}
                  calculationTabProps={{
                    selectedDeal,
                    sortedDriveFiles,
                    expandedFolderIds,
                    toggleFolderExpanded,
                    isFolderLoading,
                    getDriveFileDepth,
                    selectedDriveFileIds,
                    toggleDriveFileSelection,
                    isDriveLoading,
                    driveError,
                    loadDriveFiles,
                    onRefreshDeal,
                  }}
                  chatTabProps={{
                    selectedDeal,
                    chatMessages,
                    isChatLoading,
                    chatError,
                    currentUser,
                    onSendMessage: handleChatSendMessage,
                    onDeleteMessage: handleChatDelete,
                    onRetryLoad: loadChatMessages,
                  }}
                  activityProps={{
                    activityError,
                    activityLogs,
                    isActivityLoading,
                    dealEventsError,
                    dealTimelineEvents,
                    isDealEventsLoading,
                    onUpdateManualEvent: handleUpdateManualDealEvent,
                    onDeleteManualEvent: handleDeleteManualDealEvent,
                  }}
                />
              </div>
            </div>
          </div>
        ) : (
          <div
            className={`rounded-3xl border border-dashed p-6 text-sm ${
              accessMessage
                ? 'border-rose-300 bg-rose-50/80 text-rose-800'
                : 'border-slate-300 bg-slate-50/80 text-slate-600'
            }`}
            role={accessMessage ? 'alert' : 'status'}
          >
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="space-y-1">
                <p className="text-base font-semibold text-slate-900">
                  {accessMessage ? 'Сделка недоступна' : 'Выберите сделку'}
                </p>
                <p>
                  {accessMessage ??
                    'Откройте сделку из списка, чтобы увидеть контакты, задачи, полисы и историю.'}
                </p>
              </div>
              {accessMessage && onClearAccessMessage && (
                <Button
                  type="button"
                  onClick={onClearAccessMessage}
                  className="btn btn-sm btn-quiet"
                >
                  Понятно
                </Button>
              )}
            </div>
          </div>
        )}
      </div>
      <DealDetailsPanelModals
        clients={clients}
        users={users}
        selectedDeal={selectedDeal}
        relatedPolicies={relatedPolicies}
        selectedClientDisplayName={selectedClientDisplayName}
        pendingDealClientId={pendingDealClientId}
        onPendingDealClientConsumed={onPendingDealClientConsumed}
        onRequestAddClient={onRequestAddClient}
        onUpdateDeal={onUpdateDeal}
        onCreateTask={onCreateTask}
        onUpdateTask={onUpdateTask}
        onAddPayment={onAddPayment}
        onUpdatePayment={onUpdatePayment}
        onAddFinancialRecord={onAddFinancialRecord}
        onUpdateFinancialRecord={onUpdateFinancialRecord}
        isEditingDeal={isEditingDeal}
        setIsEditingDeal={setIsEditingDeal}
        isCreatingTask={isCreatingTask}
        setIsCreatingTask={setIsCreatingTask}
        editingTaskId={editingTaskId}
        editingTask={editingTask}
        setEditingTaskId={setEditingTaskId}
        isPaymentModalOpen={isPaymentModalOpen}
        editingPaymentId={editingPaymentId}
        editingPayment={editingPayment}
        paymentFixedPolicyId={paymentFixedPolicyId}
        closePaymentModal={closePaymentModal}
        isFinancialRecordModalOpen={isFinancialRecordModalOpen}
        editingFinancialRecordId={editingFinancialRecordId}
        editingFinancialRecord={editingFinancialRecord}
        financialRecordPaymentId={financialRecordPaymentId}
        financialRecordDefaultRecordType={financialRecordDefaultRecordType}
        closeFinancialRecordModal={closeFinancialRecordModal}
        isMergeModalOpen={isMergeModalOpen}
        mergeSearch={mergeSearch}
        setMergeSearch={setMergeSearch}
        mergeList={mergeList}
        mergeSources={mergeSources}
        toggleMergeSource={toggleMergeSource}
        mergeError={mergeError}
        mergePreviewWarnings={mergePreviewWarnings}
        mergeStep={mergeStep}
        setMergeStep={setMergeStep}
        mergeFinalDraft={mergeFinalDraft}
        requestMergePreview={requestMergePreview}
        isMergePreviewLoading={isMergePreviewLoading}
        isMergePreviewConfirmed={isMergePreviewConfirmed}
        isMergeSearchLoading={isMergeSearchLoading}
        isMergeSearchActive={isMergeSearchActive}
        mergeQuery={mergeQuery}
        isMerging={isMerging}
        closeMergeModal={closeMergeModal}
        handleMergeSubmit={handleMergeSubmit}
        isSimilarModalOpen={isSimilarModalOpen}
        similarCandidates={similarCandidates}
        selectedSimilarIds={selectedSimilarIds}
        similarIncludeClosed={similarIncludeClosed}
        isSimilarLoading={isSimilarLoading}
        similarError={similarError}
        setSimilarIncludeClosed={setSimilarIncludeClosed}
        toggleSimilarCandidate={toggleSimilarCandidate}
        continueFromSimilarToMerge={continueFromSimilarToMerge}
        closeSimilarModal={closeSimilarModal}
        isCloseDealPromptOpen={isCloseDealPromptOpen}
        setIsCloseDealPromptOpen={setIsCloseDealPromptOpen}
        closeDealReason={closeDealReason}
        setCloseDealReason={setCloseDealReason}
        closeDealReasonError={closeDealReasonError}
        handleCloseDealConfirm={handleCloseDealConfirm}
        isClosingDeal={isClosingDeal}
        quickInlineDateOptions={quickInlineDateOptions}
        handleQuickNextContactShift={handleQuickNextContactShift}
      />
      <FormModal
        isOpen={isManualEventModalOpen}
        title="Добавить событие"
        onClose={handleCloseManualEventModal}
        size="sm"
      >
        <form className="space-y-4" onSubmit={handleManualEventSubmit}>
          {manualEventError && <InlineAlert>{manualEventError}</InlineAlert>}
          <FormField label="Дата" htmlFor="deal-manual-event-date">
            <DateInput
              id="deal-manual-event-date"
              className="field field-input w-full"
              value={manualEventDate}
              onChange={(event) => setManualEventDate(event.target.value)}
            />
          </FormField>
          <FormField label="Причина" htmlFor="deal-manual-event-reason">
            <input
              id="deal-manual-event-reason"
              type="text"
              className="field field-input w-full"
              value={manualEventReason}
              onChange={(event) => setManualEventReason(event.target.value)}
              placeholder="Например: предположительно купит квартиру, предложить застраховать"
            />
          </FormField>
          <FormActions
            onCancel={handleCloseManualEventModal}
            submitLabel="Добавить"
            submittingLabel="Добавляем..."
            isSubmitting={isManualEventSaving}
          />
        </form>
      </FormModal>
      <ConfirmDialogRenderer />
      <FormModal
        isOpen={isTimeTrackingConfirmModalOpen}
        title="Продолжить учет времени по сделке?"
        onClose={() => undefined}
        size="sm"
        closeOnOverlayClick={false}
        closeOnEscape={false}
        hideCloseButton
        zIndex={80}
      >
        <div className="space-y-4">
          <p className="text-sm text-slate-700">
            Учет времени приостановлен. Чтобы продолжить работу со сделкой, подтвердите продолжение
            учета времени.
          </p>
          <Button type="button" onClick={continueTracking} variant="primary" className="w-full">
            Продолжить
          </Button>
        </div>
      </FormModal>
    </>
  );
}
