import React from 'react';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import AppContent from '../AppContent';

const authState = vi.hoisted(() => ({
  authLoading: false,
  currentUser: { id: 'user-1', username: 'Tester', roles: ['Admin'] },
  isAuthenticated: true,
}));

const appDataState = vi.hoisted(() => ({
  isLoading: false,
}));

const bootstrapState = vi.hoisted(() => ({
  pendingPostLoginRedirect: null as string | null,
}));

vi.mock('../contexts/NotificationContext', () => ({
  useNotification: () => ({
    addNotification: vi.fn(),
  }),
}));

vi.mock('../hooks/useConfirm', () => ({
  useConfirm: () => ({
    confirm: vi.fn().mockResolvedValue(true),
    ConfirmDialogRenderer: () => <div data-testid="confirm-renderer" />,
  }),
}));

vi.mock('../hooks/useAppData', () => ({
  useAppData: () => ({
    dataState: {
      clients: [],
      deals: [],
      policies: [],
      salesChannels: [],
      payments: [],
      financialRecords: [],
      statements: [],
      tasks: [],
      users: [],
    },
    loadData: vi.fn(),
    ensureCommissionsDataLoaded: vi.fn(),
    ensureFinanceDataLoaded: vi.fn(),
    ensureTasksLoaded: vi.fn(),
    refreshDeals: vi.fn(),
    invalidateDealsCache: vi.fn(),
    refreshPolicies: vi.fn(),
    refreshPoliciesList: vi.fn(),
    updateAppData: vi.fn(),
    setAppData: vi.fn(),
    resetPoliciesState: vi.fn(),
    resetPoliciesListState: vi.fn(),
    loadMoreDeals: vi.fn(),
    dealsHasMore: false,
    dealsTotalCount: 0,
    policiesList: [],
    loadMorePolicies: vi.fn(),
    policiesHasMore: false,
    isPoliciesListLoading: false,
    isLoadingMorePolicies: false,
    isLoadingMoreDeals: false,
    isLoading: appDataState.isLoading,
    isCommissionsDataLoading: false,
    hasCommissionsSnapshotLoaded: true,
    isFinanceDataLoading: false,
    hasFinanceSnapshotLoaded: true,
    isTasksLoading: false,
    isSyncing: false,
    setIsSyncing: vi.fn(),
    error: null,
    setError: vi.fn(),
  }),
}));

vi.mock('../hooks/useAuthBootstrap', () => ({
  useAuthBootstrap: () => ({
    authLoading: authState.authLoading,
    currentUser: authState.currentUser,
    handleLoginSuccess: vi.fn(),
    isAuthenticated: authState.isAuthenticated,
    setCurrentUser: vi.fn(),
    setIsAuthenticated: vi.fn(),
  }),
}));

vi.mock('../features/app/bootstrap-shell/useAppBootstrapShell', () => ({
  useAppBootstrapShell: () => ({
    deepLinkedDealId: null,
    isClientsRoute: false,
    isCommissionsRoute: false,
    isDealsRoute: true,
    isLoginRoute: false,
    isPoliciesRoute: false,
    isTasksRoute: false,
    pendingPostLoginRedirect: bootstrapState.pendingPostLoginRedirect,
  }),
}));

vi.mock('../features/app/interaction-shell/useDealPreviewController', () => ({
  useDealPreviewController: () => ({
    selectedDealId: null,
    isDealFocusCleared: false,
    dealRowFocusRequest: null,
    previewDealId: null,
    setPreviewDealId: vi.fn(),
    clearSelectedDealFocus: vi.fn(),
    resetDealSelection: vi.fn(),
    selectDealById: vi.fn(),
    handleOpenDealPreview: vi.fn(),
    handleCloseDealPreview: vi.fn(),
    requestDealRowFocus: vi.fn(),
  }),
}));

vi.mock('../hooks/useDealFilters', () => ({
  useDealFilters: () => ({
    dealSearchInput: '',
    setDealSearchInput: vi.fn(),
    applyDealSearch: vi.fn(),
    dealExecutorFilter: '',
    setDealExecutorFilter: vi.fn(),
    dealShowDeleted: false,
    setDealShowDeleted: vi.fn(),
    dealShowClosed: false,
    setDealShowClosed: vi.fn(),
    dealOrdering: undefined,
    setDealOrdering: vi.fn(),
    filters: {},
  }),
}));

vi.mock('../hooks/appContent/useClientActions', () => ({
  useClientActions: () => ({
    isClientModalOverlayOpen: false,
    pendingDealClientId: null,
    editingClient: null,
    setEditingClient: vi.fn(),
    clientDeleteTarget: null,
    setClientDeleteTarget: vi.fn(),
    similarClientTargetId: null,
    similarCandidates: [],
    isSimilarClientsLoading: false,
    similarClientsError: null,
    mergeTargetClient: null,
    mergeCandidates: [],
    mergeSearch: '',
    setMergeSearch: vi.fn(),
    mergeSources: [],
    mergeError: null,
    isMergingClients: false,
    isClientMergePreviewLoading: false,
    clientMergePreview: null,
    isClientMergePreviewConfirmed: false,
    clientMergeStep: 'select',
    clientMergeFieldOverrides: { name: '', phone: '', email: '', notes: '' },
    setClientMergeFieldOverrides: vi.fn(),
    similarTargetClient: null,
    openClientModal: vi.fn(),
    closeClientModal: vi.fn(),
    handleAddClient: vi.fn(),
    handlePendingDealClientConsumed: vi.fn(),
    handleClientEditRequest: vi.fn(),
    handleUpdateClient: vi.fn(),
    handleClientDeleteRequest: vi.fn(),
    handleDeleteClient: vi.fn(),
    handleClientMergeRequest: vi.fn(),
    handleClientFindSimilarRequest: vi.fn(),
    closeSimilarClientsModal: vi.fn(),
    toggleMergeSource: vi.fn(),
    closeMergeModal: vi.fn(),
    handleClientMergePreview: vi.fn(),
    handleMergeSubmit: vi.fn(),
    handleMergeFromSimilar: vi.fn(),
  }),
}));

vi.mock('../hooks/appContent/useDealDetailsData', () => ({
  useDealDetailsData: () => ({
    dealsById: new Map(),
    mergeDealWithHydratedQuotes: vi.fn(),
    invalidateDealTasksCache: vi.fn(),
    invalidateDealQuotesCache: vi.fn(),
    invalidateDealPoliciesCache: vi.fn(),
    cacheDealQuotes: vi.fn(),
    refreshDealsWithSelection: vi.fn(),
    syncDealsByIds: vi.fn(),
    handleSelectDeal: vi.fn(),
    handleOpenDealPreview: vi.fn(),
    handleRefreshSelectedDeal: vi.fn(),
    handleRefreshDealsList: vi.fn(),
    loadDealPolicies: vi.fn(),
    handleRefreshSelectedDealPolicies: vi.fn(),
    handleRefreshPreviewDealPolicies: vi.fn(),
    registerProtectedCreatedDeal: vi.fn(),
    isSelectedDealTasksLoading: false,
    isSelectedDealQuotesLoading: false,
    isPreviewDealTasksLoading: false,
    isPreviewDealQuotesLoading: false,
  }),
}));

vi.mock('../hooks/appContent/useFinanceActions', () => ({
  useFinanceActions: () => ({
    handleAddPayment: vi.fn(),
    handleUpdatePayment: vi.fn(),
    handleDeletePayment: vi.fn(),
    handleAddFinancialRecord: vi.fn(),
    handleUpdateFinancialRecord: vi.fn(),
    handleDeleteFinancialRecord: vi.fn(),
    handleCreateFinanceStatement: vi.fn(),
    handleUpdateFinanceStatement: vi.fn(),
    handleDeleteFinanceStatement: vi.fn(),
    handleRemoveFinanceStatementRecords: vi.fn(),
  }),
}));

vi.mock('../hooks/appContent/usePolicyActions', () => ({
  usePolicyActions: () => ({
    policyDealId: null,
    policyPrefill: null,
    policyDefaultCounterparty: '',
    editingPolicy: null,
    setEditingPolicy: vi.fn(),
    closePolicyModal: vi.fn(),
    handlePolicyDraftReady: vi.fn(),
    handleRequestAddPolicy: vi.fn(),
    handleRequestEditPolicy: vi.fn(),
    handleAddPolicy: vi.fn(),
    handleUpdatePolicy: vi.fn(),
    handleDeletePolicy: vi.fn(),
    policyDealExecutorName: '',
    editingPolicyExecutorName: '',
  }),
}));

vi.mock('../hooks/appContent/useDealActions', () => ({
  useDealActions: () => ({
    handleAddDeal: vi.fn(),
    handleCloseDeal: vi.fn(),
    handleReopenDeal: vi.fn(),
    handleUpdateDeal: vi.fn(),
    handlePinDeal: vi.fn(),
    handleUnpinDeal: vi.fn(),
    handlePostponeDeal: vi.fn(),
    handleDeleteDeal: vi.fn(),
    handleRestoreDeal: vi.fn(),
    handleMergeDeals: vi.fn(),
    handleAddQuote: vi.fn(),
    handleUpdateQuote: vi.fn(),
    handleRequestEditQuote: vi.fn(),
    handleDeleteQuote: vi.fn(),
    handleDriveFolderCreated: vi.fn(),
    handleFetchChatMessages: vi.fn(),
    handleCreateDealMailbox: vi.fn(),
    handleCheckDealMailbox: vi.fn(),
    handleSendChatMessage: vi.fn(),
    handleDeleteChatMessage: vi.fn(),
    handleCreateTask: vi.fn(),
    handleUpdateTask: vi.fn(),
    handleDeleteTask: vi.fn(),
    cycleSelectedDeal: vi.fn(),
    openSelectedDealPreview: vi.fn(),
    deleteSelectedDeal: vi.fn(),
    restoreSelectedDeal: vi.fn(),
  }),
}));

vi.mock('../features/app/interaction-shell/useAppInteractionShell', () => ({
  useAppInteractionShell: () => ({
    paletteMode: null,
    openCommandsPalette: vi.fn(),
    closePalette: vi.fn(),
    commandItems: [],
    taskDealItems: [],
    shortcutContext: {
      deleteSelectedClient: vi.fn(),
      markSelectedTaskDone: vi.fn(),
      openSelectedClient: vi.fn(),
      openSelectedPolicy: vi.fn(),
      openSelectedTaskDealPreview: vi.fn(),
      selectedClientShortcut: null,
      selectedPolicyShortcut: null,
      selectedTaskShortcut: null,
    },
  }),
}));

vi.mock('../features/app/route-shell/useAppRouteShell', () => ({
  useAppRouteShell: (bindings: unknown) => bindings,
}));

vi.mock('../components/app/AppShell', () => ({
  AppShell: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="app-shell">{children}</div>
  ),
}));

vi.mock('../components/app/AppRoutes', () => ({
  AppRoutes: () => <div data-testid="app-routes" />,
}));

vi.mock('../components/app/AppShortcutsController', () => ({
  AppShortcutsController: () => <div data-testid="app-shortcuts" />,
}));

vi.mock('../features/app/overlay-shell/AppOverlayShell', () => ({
  AppOverlayShell: () => <div data-testid="app-overlay" />,
}));

vi.mock('../components/LoginPage', () => ({
  LoginPage: () => <div data-testid="login-page" />,
}));

describe('AppContent composition', () => {
  beforeEach(() => {
    authState.authLoading = false;
    authState.isAuthenticated = true;
    appDataState.isLoading = false;
    bootstrapState.pendingPostLoginRedirect = null;
  });

  it('shows loading guard while auth is loading', () => {
    authState.authLoading = true;

    render(
      <MemoryRouter>
        <AppContent />
      </MemoryRouter>,
    );

    expect(screen.getByText('Загрузка...')).toBeInTheDocument();
  });

  it('shows login page for unauthenticated state', async () => {
    authState.isAuthenticated = false;

    render(
      <MemoryRouter>
        <AppContent />
      </MemoryRouter>,
    );

    expect(await screen.findByTestId('login-page')).toBeInTheDocument();
  });

  it('shows redirect guard when post-login redirect is pending', () => {
    bootstrapState.pendingPostLoginRedirect = '/deals?dealId=deal-1';

    render(
      <MemoryRouter>
        <AppContent />
      </MemoryRouter>,
    );

    expect(screen.getByText('Переход...')).toBeInTheDocument();
  });

  it('renders authenticated shell composition', () => {
    render(
      <MemoryRouter>
        <AppContent />
      </MemoryRouter>,
    );

    expect(screen.getByTestId('app-shell')).toBeInTheDocument();
    expect(screen.getByTestId('app-routes')).toBeInTheDocument();
    expect(screen.getByTestId('app-shortcuts')).toBeInTheDocument();
    expect(screen.getByTestId('app-overlay')).toBeInTheDocument();
  });
});
