import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach } from 'vitest';

import type { Deal, User } from '../../../../types';

const { reloadNotesMock, loadDriveFilesMock } = vi.hoisted(() => ({
  reloadNotesMock: vi.fn().mockResolvedValue(undefined),
  loadDriveFilesMock: vi.fn().mockResolvedValue(undefined),
}));
const { driveFilesState } = vi.hoisted(() => ({
  driveFilesState: {
    isDriveLoading: false,
  },
}));

const { dealTimeTrackingState } = vi.hoisted(() => ({
  dealTimeTrackingState: {
    myTotalSeconds: 0,
    myTotalLabel: '00:00:00',
    isConfirmModalOpen: false,
    isPausedForConfirm: false,
    continueTracking: vi.fn(),
  },
}));

vi.mock('react-router-dom', () => ({
  useNavigate: () => vi.fn(),
}));

vi.mock('../../../hooks/useConfirm', () => ({
  useConfirm: () => ({
    confirm: vi.fn().mockResolvedValue(true),
    ConfirmDialogRenderer: () => null,
  }),
}));

vi.mock('../../../hooks/useFinancialRecordModal', () => ({
  useFinancialRecordModal: () => ({
    isOpen: false,
    paymentId: null,
    defaultRecordType: null,
    editingFinancialRecord: null,
    editingFinancialRecordId: null,
    setEditingFinancialRecordId: vi.fn(),
    setCreatingFinancialRecordContext: vi.fn(),
    closeFinancialRecordModal: vi.fn(),
  }),
}));

vi.mock('../../../hooks/usePaymentModal', () => ({
  usePaymentModal: () => ({
    isOpen: false,
    editingPaymentId: null,
    setEditingPaymentId: vi.fn(),
    setCreatingPaymentPolicyId: vi.fn(),
    editingPayment: null,
    fixedPolicyId: null,
    closePaymentModal: vi.fn(),
  }),
}));

vi.mock('../../../api/notifications', () => ({
  fetchNotificationSettings: vi
    .fn()
    .mockResolvedValue({ settings: { next_contact_lead_days: 90 } }),
}));

vi.mock('../hooks/useDealMerge', () => ({
  useDealMerge: () => ({
    isMergeModalOpen: false,
    openMergeModal: vi.fn(),
    closeMergeModal: vi.fn(),
    mergeStep: 'select',
    setMergeStep: vi.fn(),
    mergeSources: [],
    mergeError: null,
    mergeSearch: '',
    setMergeSearch: vi.fn(),
    mergeList: [],
    mergeQuery: '',
    isMergeSearchActive: false,
    isMergeSearchLoading: false,
    isMerging: false,
    isMergePreviewLoading: false,
    mergePreviewWarnings: [],
    isMergePreviewConfirmed: false,
    mergeFinalDraft: null,
    toggleMergeSource: vi.fn(),
    requestMergePreview: vi.fn(),
    handleMergeSubmit: vi.fn(),
    isSimilarModalOpen: false,
    openSimilarModal: vi.fn(),
    closeSimilarModal: vi.fn(),
    similarError: null,
    isSimilarLoading: false,
    similarCandidates: [],
    selectedSimilarIds: [],
    toggleSimilarCandidate: vi.fn(),
    similarIncludeClosed: false,
    setSimilarIncludeClosed: vi.fn(),
    continueFromSimilarToMerge: vi.fn(),
  }),
}));

vi.mock('../hooks/useDealDriveFiles', () => ({
  useDealDriveFiles: () => ({
    isDriveLoading: driveFilesState.isDriveLoading,
    driveError: null,
    selectedDriveFileIds: [],
    canRecognizeSelectedFiles: true,
    canRecognizeSelectedDocumentFiles: true,
    isRecognizing: false,
    recognitionResults: [],
    recognitionMessage: null,
    isDocumentRecognizing: false,
    documentRecognitionResults: [],
    documentRecognitionMessage: null,
    isTrashing: false,
    trashMessage: null,
    isDownloading: false,
    downloadMessage: null,
    isRenaming: false,
    renameMessage: null,
    sortedDriveFiles: [],
    driveSortDirection: 'asc',
    expandedFolderIds: new Set<string>(),
    loadDriveFiles: loadDriveFilesMock,
    loadFolderContents: vi.fn(),
    toggleFolderExpanded: vi.fn(),
    isFolderLoading: vi.fn().mockReturnValue(false),
    getDriveFileDepth: vi.fn().mockReturnValue(0),
    folderErrors: {},
    handleDriveFileUpload: vi.fn(),
    toggleDriveFileSelection: vi.fn(),
    toggleDriveSortDirection: vi.fn(),
    handleRecognizePolicies: vi.fn(),
    handleRecognizeDocuments: vi.fn(),
    handleTrashSelectedFiles: vi.fn(),
    handleDownloadDriveFiles: vi.fn(),
    handleRenameDriveFile: vi.fn(),
    resetDriveState: vi.fn(),
  }),
}));

vi.mock('../hooks/useDealNotes', () => ({
  useDealNotes: () => ({
    notes: [],
    notesLoading: false,
    notesFilter: 'active',
    noteDraft: '',
    noteIsImportant: false,
    notesError: null,
    notesAction: null,
    noteAttachments: [],
    noteAttachmentsUploading: false,
    setNoteDraft: vi.fn(),
    setNoteIsImportant: vi.fn(),
    setNotesFilter: vi.fn(),
    addNote: vi.fn(),
    attachNoteFile: vi.fn(),
    removeNoteAttachment: vi.fn(),
    archiveNote: vi.fn(),
    restoreNote: vi.fn(),
    reloadNotes: reloadNotesMock,
  }),
}));

vi.mock('../hooks/useDealInlineDates', () => ({
  useDealInlineDates: () => ({
    nextContactInputValue: '',
    expectedCloseInputValue: '',
    handleNextContactChange: vi.fn(),
    handleExpectedCloseChange: vi.fn(),
    handleNextContactBlur: vi.fn(),
    handleExpectedCloseBlur: vi.fn(),
    handleQuickNextContactShift: vi.fn(),
    quickInlinePostponeShift: vi.fn(),
    quickInlineShift: vi.fn(),
    quickInlineDateOptions: [],
    updateDealDates: vi.fn(),
  }),
}));

vi.mock('../hooks/useDealCommunication', () => ({
  useDealCommunication: () => ({
    chatMessages: [],
    isChatLoading: false,
    activityLogs: [],
    isActivityLoading: false,
    activityError: null,
    loadChatMessages: vi.fn().mockResolvedValue(undefined),
    loadActivityLogs: vi.fn().mockResolvedValue(undefined),
    handleChatSendMessage: vi.fn(),
    handleChatDelete: vi.fn(),
  }),
}));

vi.mock('../hooks/useDealTimeTracking', () => ({
  useDealTimeTracking: () => dealTimeTrackingState,
}));

vi.mock('../DealHeader', () => ({
  DealHeader: () => <div data-testid="deal-header" />,
}));

vi.mock('../DealActions', () => ({
  DealActions: ({ onRefresh, isRefreshing }: { onRefresh: () => void; isRefreshing?: boolean }) => (
    <div data-testid="deal-actions">
      <button type="button" onClick={onRefresh}>
        Обновить сделку
      </button>
      {isRefreshing && <span>Обновляем...</span>}
    </div>
  ),
}));

vi.mock('../DealDateControls', () => ({
  DealDateControls: () => <div data-testid="deal-date-controls" />,
}));

vi.mock('../DealNotesSection', () => ({
  DealNotesSection: () => <div data-testid="deal-notes" />,
}));

vi.mock('../tabs/TasksTab', () => ({
  TasksTab: () => <div data-testid="tasks-tab" />,
}));

vi.mock('../tabs/PoliciesTab', () => ({
  PoliciesTab: () => <div data-testid="policies-tab" />,
}));

vi.mock('../tabs/QuotesTab', () => ({
  QuotesTab: () => <div data-testid="quotes-tab" />,
}));

vi.mock('../tabs/ChatTab', () => ({
  ChatTab: () => <div data-testid="chat-tab" />,
}));

vi.mock('../DealDetailsModals', () => ({
  DealDelayModal: () => null,
  DealMergeModal: () => null,
  DealSimilarModal: () => null,
}));

vi.mock('../../ActivityTimeline', () => ({
  ActivityTimeline: () => <div data-testid="activity-timeline" />,
}));

vi.mock('../../financialRecords/FinancialRecordModal', () => ({
  FinancialRecordModal: () => null,
}));

vi.mock('../../payments/PaymentModal', () => ({
  PaymentModal: () => null,
}));

vi.mock('../../common/InlineAlert', () => ({
  InlineAlert: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

vi.mock('../../common/modal/PromptDialog', () => ({
  PromptDialog: () => null,
}));

vi.mock('../../forms/DealForm', () => ({
  DealForm: () => null,
}));

vi.mock('../../forms/AddTaskForm', () => ({
  AddTaskForm: () => null,
}));

vi.mock('../DealTabs', () => ({
  DealTabs: ({
    onChange,
    loadingByTab,
  }: {
    onChange: (tab: string) => void;
    loadingByTab?: { files?: boolean };
  }) => (
    <div>
      <button type="button" onClick={() => onChange('files')}>
        Open Files
      </button>
      {loadingByTab?.files && <span data-testid="files-tab-loading">Loading Files</span>}
    </div>
  ),
}));

vi.mock('../tabs/FilesTab', () => ({
  FilesTab: ({
    onCheckMailbox,
    mailboxActionSuccess,
    isCheckingMailbox,
  }: {
    onCheckMailbox: () => Promise<void>;
    mailboxActionSuccess: string | null;
    isCheckingMailbox: boolean;
  }) => (
    <div>
      <button type="button" disabled={isCheckingMailbox} onClick={() => void onCheckMailbox()}>
        Проверить почту
      </button>
      {mailboxActionSuccess && <div>{mailboxActionSuccess}</div>}
    </div>
  ),
}));

import { DealDetailsPanel } from '../DealDetailsPanel';

const selectedDeal: Deal = {
  id: 'deal-1',
  title: 'Сделка',
  clientId: 'client-1',
  clientName: 'Клиент',
  status: 'open',
  createdAt: '2025-01-01T00:00:00Z',
  quotes: [],
  documents: [],
  mailboxEmail: 'mailbox@example.com',
};

const currentUser: User = {
  id: 'user-1',
  username: 'manager',
  roles: ['Admin'],
};

describe('DealDetailsPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    reloadNotesMock.mockResolvedValue(undefined);
    loadDriveFilesMock.mockResolvedValue(undefined);
    driveFilesState.isDriveLoading = false;
    dealTimeTrackingState.myTotalSeconds = 0;
    dealTimeTrackingState.myTotalLabel = '00:00:00';
    dealTimeTrackingState.isConfirmModalOpen = false;
    dealTimeTrackingState.isPausedForConfirm = false;
    dealTimeTrackingState.continueTracking = vi.fn();
  });

  it('checks mailbox, reloads notes before drive files and shows success message', async () => {
    const onCheckDealMailbox = vi.fn().mockResolvedValue({
      deal: selectedDeal,
      mailboxSync: {
        processed: 2,
        skipped: 1,
        failed: 0,
        deleted: 3,
      },
    });

    render(
      <DealDetailsPanel
        deals={[selectedDeal]}
        clients={[]}
        policies={[]}
        payments={[]}
        financialRecords={[]}
        tasks={[]}
        users={[currentUser]}
        currentUser={currentUser}
        sortedDeals={[selectedDeal]}
        selectedDeal={selectedDeal}
        selectedClient={null}
        onSelectDeal={vi.fn()}
        onCloseDeal={vi.fn().mockResolvedValue(undefined)}
        onReopenDeal={vi.fn().mockResolvedValue(undefined)}
        onUpdateDeal={vi.fn().mockResolvedValue(undefined)}
        onMergeDeals={vi.fn().mockResolvedValue(undefined)}
        onRequestAddQuote={vi.fn()}
        onRequestEditQuote={vi.fn()}
        onRequestAddPolicy={vi.fn()}
        onRequestEditPolicy={vi.fn()}
        onRequestAddClient={vi.fn()}
        onDeleteQuote={vi.fn().mockResolvedValue(undefined)}
        onDeletePolicy={vi.fn().mockResolvedValue(undefined)}
        onAddPayment={vi.fn().mockResolvedValue(undefined)}
        onUpdatePayment={vi.fn().mockResolvedValue(undefined)}
        onDeletePayment={vi.fn().mockResolvedValue(undefined)}
        onAddFinancialRecord={vi.fn().mockResolvedValue(undefined)}
        onUpdateFinancialRecord={vi.fn().mockResolvedValue(undefined)}
        onDeleteFinancialRecord={vi.fn().mockResolvedValue(undefined)}
        onDriveFolderCreated={vi.fn()}
        onCreateDealMailbox={vi.fn().mockResolvedValue({ deal: selectedDeal })}
        onCheckDealMailbox={onCheckDealMailbox}
        onFetchChatMessages={vi.fn().mockResolvedValue([])}
        onSendChatMessage={vi.fn().mockResolvedValue({} as never)}
        onDeleteChatMessage={vi.fn().mockResolvedValue(undefined)}
        onFetchDealHistory={vi.fn().mockResolvedValue([])}
        onCreateTask={vi.fn().mockResolvedValue(undefined)}
        onUpdateTask={vi.fn().mockResolvedValue(undefined)}
        onDeleteTask={vi.fn().mockResolvedValue(undefined)}
        onDeleteDeal={vi.fn().mockResolvedValue(undefined)}
        onRestoreDeal={vi.fn().mockResolvedValue(undefined)}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Open Files' }));
    const baselineReloadCalls = reloadNotesMock.mock.calls.length;
    const baselineLoadCalls = loadDriveFilesMock.mock.calls.length;
    const baselineOrderMarker = Math.max(
      ...reloadNotesMock.mock.invocationCallOrder,
      ...loadDriveFilesMock.mock.invocationCallOrder,
      0,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Проверить почту' }));

    await waitFor(() => {
      expect(onCheckDealMailbox).toHaveBeenCalledWith('deal-1');
    });
    await waitFor(() => {
      expect(reloadNotesMock).toHaveBeenCalledTimes(baselineReloadCalls + 1);
      expect(loadDriveFilesMock.mock.calls.length).toBeGreaterThanOrEqual(baselineLoadCalls + 1);
    });

    const reloadOrder =
      reloadNotesMock.mock.invocationCallOrder.find((order) => order > baselineOrderMarker) ?? 0;
    const loadDriveOrder =
      loadDriveFilesMock.mock.invocationCallOrder.find((order) => order > baselineOrderMarker) ?? 0;
    expect(reloadOrder).toBeLessThan(loadDriveOrder);

    expect(
      screen.getByText('Почта проверена: обработано 2, пропущено 1, ошибок 0, удалено 3.'),
    ).toBeInTheDocument();
  });

  it('blocks deal selection when time tracking confirmation is required', async () => {
    dealTimeTrackingState.isConfirmModalOpen = true;
    const onDealSelectionBlockedChange = vi.fn();

    render(
      <DealDetailsPanel
        deals={[selectedDeal]}
        clients={[]}
        policies={[]}
        payments={[]}
        financialRecords={[]}
        tasks={[]}
        users={[currentUser]}
        currentUser={currentUser}
        sortedDeals={[selectedDeal]}
        selectedDeal={selectedDeal}
        selectedClient={null}
        onSelectDeal={vi.fn()}
        onCloseDeal={vi.fn().mockResolvedValue(undefined)}
        onReopenDeal={vi.fn().mockResolvedValue(undefined)}
        onUpdateDeal={vi.fn().mockResolvedValue(undefined)}
        onMergeDeals={vi.fn().mockResolvedValue(undefined)}
        onRequestAddQuote={vi.fn()}
        onRequestEditQuote={vi.fn()}
        onRequestAddPolicy={vi.fn()}
        onRequestEditPolicy={vi.fn()}
        onRequestAddClient={vi.fn()}
        onDeleteQuote={vi.fn().mockResolvedValue(undefined)}
        onDeletePolicy={vi.fn().mockResolvedValue(undefined)}
        onAddPayment={vi.fn().mockResolvedValue(undefined)}
        onUpdatePayment={vi.fn().mockResolvedValue(undefined)}
        onDeletePayment={vi.fn().mockResolvedValue(undefined)}
        onAddFinancialRecord={vi.fn().mockResolvedValue(undefined)}
        onUpdateFinancialRecord={vi.fn().mockResolvedValue(undefined)}
        onDeleteFinancialRecord={vi.fn().mockResolvedValue(undefined)}
        onDriveFolderCreated={vi.fn()}
        onCreateDealMailbox={vi.fn().mockResolvedValue({ deal: selectedDeal })}
        onCheckDealMailbox={vi.fn().mockResolvedValue({ deal: selectedDeal, mailboxSync: {} })}
        onFetchChatMessages={vi.fn().mockResolvedValue([])}
        onSendChatMessage={vi.fn().mockResolvedValue({} as never)}
        onDeleteChatMessage={vi.fn().mockResolvedValue(undefined)}
        onFetchDealHistory={vi.fn().mockResolvedValue([])}
        onCreateTask={vi.fn().mockResolvedValue(undefined)}
        onUpdateTask={vi.fn().mockResolvedValue(undefined)}
        onDeleteTask={vi.fn().mockResolvedValue(undefined)}
        onDeleteDeal={vi.fn().mockResolvedValue(undefined)}
        onRestoreDeal={vi.fn().mockResolvedValue(undefined)}
        onDealSelectionBlockedChange={onDealSelectionBlockedChange}
      />,
    );

    await waitFor(() => {
      expect(onDealSelectionBlockedChange).toHaveBeenCalledWith(true);
    });
    expect(screen.getByText('Продолжить учет времени по сделке?')).toBeInTheDocument();
  });

  it('clears selected deal focus by close button', async () => {
    const onClearDealFocus = vi.fn();

    render(
      <DealDetailsPanel
        deals={[selectedDeal]}
        clients={[]}
        policies={[]}
        payments={[]}
        financialRecords={[]}
        tasks={[]}
        users={[currentUser]}
        currentUser={currentUser}
        sortedDeals={[selectedDeal]}
        selectedDeal={selectedDeal}
        selectedClient={null}
        onSelectDeal={vi.fn()}
        onCloseDeal={vi.fn().mockResolvedValue(undefined)}
        onReopenDeal={vi.fn().mockResolvedValue(undefined)}
        onUpdateDeal={vi.fn().mockResolvedValue(undefined)}
        onRefreshDeal={vi.fn().mockResolvedValue(undefined)}
        onMergeDeals={vi.fn().mockResolvedValue(undefined)}
        onRequestAddQuote={vi.fn()}
        onRequestEditQuote={vi.fn()}
        onRequestAddPolicy={vi.fn()}
        onRequestEditPolicy={vi.fn()}
        onRequestAddClient={vi.fn()}
        onDeleteQuote={vi.fn().mockResolvedValue(undefined)}
        onDeletePolicy={vi.fn().mockResolvedValue(undefined)}
        onAddPayment={vi.fn().mockResolvedValue(undefined)}
        onUpdatePayment={vi.fn().mockResolvedValue(undefined)}
        onDeletePayment={vi.fn().mockResolvedValue(undefined)}
        onAddFinancialRecord={vi.fn().mockResolvedValue(undefined)}
        onUpdateFinancialRecord={vi.fn().mockResolvedValue(undefined)}
        onDeleteFinancialRecord={vi.fn().mockResolvedValue(undefined)}
        onDriveFolderCreated={vi.fn()}
        onCreateDealMailbox={vi.fn().mockResolvedValue({ deal: selectedDeal })}
        onCheckDealMailbox={vi.fn().mockResolvedValue({ deal: selectedDeal, mailboxSync: {} })}
        onFetchChatMessages={vi.fn().mockResolvedValue([])}
        onSendChatMessage={vi.fn().mockResolvedValue({} as never)}
        onDeleteChatMessage={vi.fn().mockResolvedValue(undefined)}
        onFetchDealHistory={vi.fn().mockResolvedValue([])}
        onCreateTask={vi.fn().mockResolvedValue(undefined)}
        onUpdateTask={vi.fn().mockResolvedValue(undefined)}
        onDeleteTask={vi.fn().mockResolvedValue(undefined)}
        onDeleteDeal={vi.fn().mockResolvedValue(undefined)}
        onRestoreDeal={vi.fn().mockResolvedValue(undefined)}
        onClearDealFocus={onClearDealFocus}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Снять фокус со сделки' }));
    expect(onClearDealFocus).toHaveBeenCalledTimes(1);
  });

  it('refreshes selected deal and shows loading marker for files tab', async () => {
    driveFilesState.isDriveLoading = true;
    const onRefreshDeal = vi.fn().mockResolvedValue(undefined);
    const onRefreshPolicies = vi.fn().mockResolvedValue(undefined);

    render(
      <DealDetailsPanel
        deals={[selectedDeal]}
        clients={[]}
        policies={[]}
        payments={[]}
        financialRecords={[]}
        tasks={[]}
        users={[currentUser]}
        currentUser={currentUser}
        sortedDeals={[selectedDeal]}
        selectedDeal={selectedDeal}
        selectedClient={null}
        onSelectDeal={vi.fn()}
        onCloseDeal={vi.fn().mockResolvedValue(undefined)}
        onReopenDeal={vi.fn().mockResolvedValue(undefined)}
        onUpdateDeal={vi.fn().mockResolvedValue(undefined)}
        onRefreshDeal={onRefreshDeal}
        onMergeDeals={vi.fn().mockResolvedValue(undefined)}
        onRequestAddQuote={vi.fn()}
        onRequestEditQuote={vi.fn()}
        onRequestAddPolicy={vi.fn()}
        onRequestEditPolicy={vi.fn()}
        onRequestAddClient={vi.fn()}
        onDeleteQuote={vi.fn().mockResolvedValue(undefined)}
        onDeletePolicy={vi.fn().mockResolvedValue(undefined)}
        onRefreshPolicies={onRefreshPolicies}
        onAddPayment={vi.fn().mockResolvedValue(undefined)}
        onUpdatePayment={vi.fn().mockResolvedValue(undefined)}
        onDeletePayment={vi.fn().mockResolvedValue(undefined)}
        onAddFinancialRecord={vi.fn().mockResolvedValue(undefined)}
        onUpdateFinancialRecord={vi.fn().mockResolvedValue(undefined)}
        onDeleteFinancialRecord={vi.fn().mockResolvedValue(undefined)}
        onDriveFolderCreated={vi.fn()}
        onCreateDealMailbox={vi.fn().mockResolvedValue({ deal: selectedDeal })}
        onCheckDealMailbox={vi.fn().mockResolvedValue({ deal: selectedDeal, mailboxSync: {} })}
        onFetchChatMessages={vi.fn().mockResolvedValue([])}
        onSendChatMessage={vi.fn().mockResolvedValue({} as never)}
        onDeleteChatMessage={vi.fn().mockResolvedValue(undefined)}
        onFetchDealHistory={vi.fn().mockResolvedValue([])}
        onCreateTask={vi.fn().mockResolvedValue(undefined)}
        onUpdateTask={vi.fn().mockResolvedValue(undefined)}
        onDeleteTask={vi.fn().mockResolvedValue(undefined)}
        onDeleteDeal={vi.fn().mockResolvedValue(undefined)}
        onRestoreDeal={vi.fn().mockResolvedValue(undefined)}
      />,
    );

    expect(screen.getByTestId('files-tab-loading')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Обновить сделку' }));

    await waitFor(() => {
      expect(onRefreshDeal).toHaveBeenCalledWith('deal-1');
      expect(onRefreshPolicies).toHaveBeenCalledWith({ force: true });
      expect(reloadNotesMock).toHaveBeenCalled();
      expect(loadDriveFilesMock).toHaveBeenCalled();
    });
  });
});
