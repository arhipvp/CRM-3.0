import React from 'react';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import AppContent from '../AppContent';
import {
  APIError,
  createDeal,
  fetchQuotesByDeal,
  fetchTasksByDeal,
  updateDeal,
  updateTask,
} from '../api';

vi.mock('../contexts/NotificationContext', () => ({
  useNotification: () => ({
    addNotification: vi.fn(),
    notifications: [],
    removeNotification: vi.fn(),
  }),
}));

vi.mock('../hooks/useConfirm', () => ({
  useConfirm: () => ({
    confirm: vi.fn().mockResolvedValue(true),
    ConfirmDialogRenderer: () => null,
  }),
}));

const authStateMock = vi.hoisted(() => ({
  authLoading: false,
  currentUser: { id: 'user-1', username: 'Tester', roles: ['Admin'] },
  isAuthenticated: true,
}));

vi.mock('../hooks/useAuthBootstrap', () => ({
  useAuthBootstrap: () => ({
    authLoading: authStateMock.authLoading,
    currentUser: authStateMock.currentUser,
    handleLoginSuccess: vi.fn(),
    isAuthenticated: authStateMock.isAuthenticated,
    setCurrentUser: vi.fn(),
    setIsAuthenticated: vi.fn(),
  }),
}));

const appDataMock = vi.hoisted(() => ({
  clients: [] as Array<{
    id: string;
    name: string;
    createdAt: string;
    updatedAt: string;
  }>,
  deals: [] as Array<{
    id: string;
    title: string;
    clientId: string;
    status: 'open' | 'won' | 'lost' | 'on_hold';
    createdAt: string;
    quotes: [];
    documents: [];
    clientName?: string;
  }>,
  tasks: [] as Array<{
    id: string;
    title: string;
    status: 'todo' | 'in_progress' | 'done' | 'overdue' | 'canceled';
    priority: 'low' | 'normal' | 'high' | 'urgent';
    createdAt: string;
    dueAt?: string | null;
    dealId?: string;
  }>,
  policiesList: [] as Array<{
    id: string;
    number: string;
    insuranceCompanyId: string;
    insuranceCompany: string;
    insuranceTypeId: string;
    insuranceType: string;
    dealId: string;
    status: 'active' | 'inactive' | 'expired' | 'canceled';
    createdAt: string;
    updatedAt?: string;
  }>,
}));

const updateAppDataMock = vi.hoisted(() => vi.fn());
const refreshDealsMock = vi.hoisted(() => vi.fn());
const invalidateDealsCacheMock = vi.hoisted(() => vi.fn());
const updateDealMock = vi.hoisted(() => vi.fn());
const setErrorMock = vi.hoisted(() => vi.fn());
const fetchDealMock = vi.hoisted(() => vi.fn());
const fetchTasksByDealMock = vi.hoisted(() => vi.fn());
const fetchQuotesByDealMock = vi.hoisted(() => vi.fn());
const createDealMock = vi.hoisted(() => vi.fn());
const ensureCommissionsDataLoadedMock = vi.hoisted(() => vi.fn().mockResolvedValue(undefined));
const ensureFinanceDataLoadedMock = vi.hoisted(() => vi.fn().mockResolvedValue(undefined));

vi.mock('../hooks/useAppData', () => ({
  useAppData: () => ({
    dataState: {
      clients: appDataMock.clients,
      deals: appDataMock.deals,
      policies: appDataMock.policiesList,
      salesChannels: [],
      payments: [],
      financialRecords: [],
      statements: [],
      tasks: appDataMock.tasks,
      users: [],
    },
    loadData: vi.fn(),
    ensureCommissionsDataLoaded: ensureCommissionsDataLoadedMock,
    ensureFinanceDataLoaded: ensureFinanceDataLoadedMock,
    ensureTasksLoaded: vi.fn().mockResolvedValue(undefined),
    refreshDeals: refreshDealsMock.mockImplementation(async () => appDataMock.deals),
    invalidateDealsCache: invalidateDealsCacheMock,
    refreshPolicies: vi.fn().mockResolvedValue([]),
    refreshPoliciesList: vi.fn().mockResolvedValue([]),
    updateAppData: updateAppDataMock,
    setAppData: vi.fn(),
    resetPoliciesState: vi.fn(),
    resetPoliciesListState: vi.fn(),
    loadMoreDeals: vi.fn().mockResolvedValue(undefined),
    dealsHasMore: false,
    dealsTotalCount: appDataMock.deals.length,
    policiesList: appDataMock.policiesList,
    loadMorePolicies: vi.fn().mockResolvedValue(undefined),
    policiesHasMore: false,
    isPoliciesListLoading: false,
    isLoadingMorePolicies: false,
    isLoadingMoreDeals: false,
    isLoading: false,
    isCommissionsDataLoading: false,
    hasCommissionsSnapshotLoaded: true,
    isFinanceDataLoading: false,
    hasFinanceSnapshotLoaded: true,
    isTasksLoading: false,
    isSyncing: false,
    setIsSyncing: vi.fn(),
    error: null,
    setError: setErrorMock,
  }),
}));

vi.mock('../components/MainLayout', () => ({
  MainLayout: ({ children, topSlot }: { children: React.ReactNode; topSlot?: React.ReactNode }) => (
    <div data-testid="main-layout">
      {topSlot ? <div data-testid="top-slot">{topSlot}</div> : null}
      {children}
    </div>
  ),
}));

vi.mock('../components/app/AppRoutes', () => ({
  AppRoutes: ({
    dealsActions,
    filters,
  }: {
    dealsActions?: {
      onPostponeDeal?: (dealId: string, data: Record<string, unknown>) => Promise<void>;
      onUpdateTask?: (taskId: string, data: { status?: string }) => Promise<void>;
      onSelectDeal?: (dealId: string) => void;
      onRefreshDealsList?: () => Promise<void>;
      selectedDealId?: string | null;
      isDealFocusCleared?: boolean;
    };
    filters?: {
      onDealSearchChange?: (value: string) => void;
      onDealSearchSubmit?: (value?: string) => void;
    };
  }) => (
    <div data-testid="app-routes">
      <div data-testid="selected-deal">{dealsActions?.selectedDealId ?? 'null'}</div>
      <div data-testid="focus-cleared">{dealsActions?.isDealFocusCleared ? 'true' : 'false'}</div>
      <button
        type="button"
        onClick={() =>
          void dealsActions
            ?.onPostponeDeal?.('deal-1', {
              title: 'Сделка первая',
              description: '',
              clientId: 'client-1',
              source: null,
              nextContactDate: '2026-12-31',
              expectedClose: '2027-02-28',
            })
            .catch(() => undefined)
        }
      >
        Trigger postpone
      </button>
      <button
        type="button"
        onClick={() => void dealsActions?.onUpdateTask?.('task-1', { status: 'done' })}
      >
        Trigger task update
      </button>
      <button type="button" onClick={() => dealsActions?.onSelectDeal?.('deal-2')}>
        Select deal-2
      </button>
      <button type="button" onClick={() => dealsActions?.onSelectDeal?.('deal-1')}>
        Select deal-1
      </button>
      <button type="button" onClick={() => filters?.onDealSearchChange?.('refresh')}>
        Trigger search change
      </button>
      <button type="button" onClick={() => filters?.onDealSearchSubmit?.()}>
        Trigger search submit
      </button>
      <button type="button" onClick={() => filters?.onDealSearchSubmit?.('')}>
        Trigger search clear
      </button>
      <button type="button" onClick={() => void dealsActions?.onRefreshDealsList?.()}>
        Trigger deals refresh
      </button>
    </div>
  ),
}));

vi.mock('../components/app/AppModals', () => ({
  AppModals: ({
    modal,
    editingPolicy,
    handleAddDeal,
  }: {
    modal: string | null;
    editingPolicy?: { number: string } | null;
    handleAddDeal?: (data: {
      title: string;
      clientId: string;
      description?: string;
      expectedClose?: string | null;
      executorId?: string | null;
      source?: string | null;
      visibleUserIds?: string[];
    }) => Promise<void>;
  }) => (
    <div data-testid="app-modals">
      <span>{modal}</span>
      {editingPolicy && (
        <span data-testid="app-modals-editing-policy">editing-policy:{editingPolicy.number}</span>
      )}
      <button
        type="button"
        onClick={() =>
          void handleAddDeal?.({
            title: 'Новая сделка',
            clientId: 'client-1',
            description: '',
            expectedClose: null,
            executorId: null,
            source: null,
            visibleUserIds: [],
          })
        }
      >
        Trigger create deal
      </button>
    </div>
  ),
}));

vi.mock('../components/views/dealsView/DealDetailsPanel', () => ({
  DealDetailsPanel: ({ selectedDeal }: { selectedDeal?: { title?: string } | null }) => (
    <div data-testid="deal-preview-panel">{selectedDeal?.title ?? 'preview'}</div>
  ),
}));

vi.mock('../components/Modal', () => ({
  Modal: ({
    title,
    children,
  }: {
    title: string;
    children: React.ReactNode;
    onClose: () => void;
  }) => (
    <div role="dialog" aria-label={title}>
      <h2>{title}</h2>
      {children}
    </div>
  ),
}));

vi.mock('../components/forms/ClientForm', () => ({
  ClientForm: ({ initial }: { initial?: { name?: string } }) => (
    <div data-testid="client-form">{initial?.name ?? 'new-client'}</div>
  ),
}));

vi.mock('../api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../api')>();
  return {
    ...actual,
    updateTask: vi
      .fn()
      .mockImplementation(async (taskId: string, payload: { status?: string }) => ({
        id: taskId,
        title: 'Task',
        status: (payload.status ?? 'todo') as
          | 'todo'
          | 'in_progress'
          | 'done'
          | 'overdue'
          | 'canceled',
        priority: 'normal' as const,
        createdAt: '2026-01-01T00:00:00Z',
      })),
    updateDeal: updateDealMock,
    createDeal: createDealMock,
    fetchDeal: fetchDealMock,
    fetchTasksByDeal: fetchTasksByDealMock,
    fetchQuotesByDeal: fetchQuotesByDealMock,
  };
});

const renderAppContent = (path: string) =>
  render(
    <MemoryRouter initialEntries={[path]}>
      <AppContent />
    </MemoryRouter>,
  );

describe('AppContent hotkeys integration', () => {
  beforeEach(() => {
    vi.spyOn(window.navigator, 'platform', 'get').mockReturnValue('Win32');
    authStateMock.authLoading = false;
    authStateMock.currentUser = { id: 'user-1', username: 'Tester', roles: ['Admin'] };
    authStateMock.isAuthenticated = true;
    appDataMock.clients = [];
    appDataMock.deals = [];
    appDataMock.tasks = [];
    appDataMock.policiesList = [];
    updateAppDataMock.mockReset();
    setErrorMock.mockReset();
    vi.mocked(updateTask).mockClear();
    vi.mocked(updateDeal).mockClear();
    refreshDealsMock.mockReset();
    refreshDealsMock.mockImplementation(async () => appDataMock.deals);
    invalidateDealsCacheMock.mockReset();
    fetchDealMock.mockReset();
    fetchTasksByDealMock.mockReset();
    fetchQuotesByDealMock.mockReset();
    createDealMock.mockReset();
    ensureCommissionsDataLoadedMock.mockReset();
    ensureCommissionsDataLoadedMock.mockResolvedValue(undefined);
    ensureFinanceDataLoadedMock.mockReset();
    ensureFinanceDataLoadedMock.mockResolvedValue(undefined);
    fetchDealMock.mockImplementation(async (dealId: string) => ({
      id: dealId,
      title: `Сделка ${dealId}`,
      clientId: 'client-1',
      status: 'won' as const,
      createdAt: '2026-01-01T00:00:00Z',
      quotes: [],
      documents: [],
      clientName: 'Клиент 1',
    }));
    fetchTasksByDealMock.mockResolvedValue([]);
    fetchQuotesByDealMock.mockResolvedValue([]);
    createDealMock.mockImplementation(async () => ({
      id: 'deal-created',
      title: 'Новая сделка',
      clientId: 'client-1',
      status: 'open' as const,
      createdAt: '2026-01-01T00:00:00Z',
      quotes: [],
      documents: [],
      clientName: 'Клиент 1',
    }));
    updateDealMock.mockReset();
    updateDealMock.mockResolvedValue({
      id: 'deal-1',
      title: 'Сделка первая',
      clientId: 'client-1',
      status: 'open',
      createdAt: '2025-01-01T00:00:00Z',
      quotes: [],
      documents: [],
    });
  });

  it('opens command palette via Ctrl+K', async () => {
    renderAppContent('/deals');

    fireEvent.keyDown(window, { key: 'k', ctrlKey: true });

    await waitFor(() => {
      expect(screen.getByText(/Командная палитра/i)).toBeInTheDocument();
    });
  });

  it('loads finance data globally after authentication', async () => {
    renderAppContent('/deals');

    await waitFor(() => {
      expect(ensureFinanceDataLoadedMock).toHaveBeenCalledTimes(1);
    });
  });

  it('loads full finance data on commissions route without lightweight commissions snapshot', async () => {
    renderAppContent('/commissions');

    await waitFor(() => {
      expect(ensureFinanceDataLoadedMock).toHaveBeenCalledTimes(1);
    });
    expect(ensureCommissionsDataLoadedMock).not.toHaveBeenCalled();
  });

  it('loads quotes for the first auto-selected deal without explicit selectedDealId', async () => {
    appDataMock.deals = [
      {
        id: 'deal-1',
        title: 'Сделка первая',
        clientId: 'client-1',
        status: 'open',
        createdAt: '2025-01-01T00:00:00Z',
        quotes: [],
        documents: [],
        clientName: 'Клиент 1',
      },
    ];

    renderAppContent('/deals');

    await waitFor(() => {
      expect(screen.getByTestId('selected-deal')).toHaveTextContent('deal-1');
      expect(fetchQuotesByDeal).toHaveBeenCalledWith('deal-1', { showDeleted: true });
      expect(fetchTasksByDeal).toHaveBeenCalledWith('deal-1', { showDeleted: true });
    });
  });

  it('switches selected deal and opens preview with Ctrl+O', async () => {
    appDataMock.deals = [
      {
        id: 'deal-1',
        title: 'Сделка первая',
        clientId: 'client-1',
        status: 'open',
        createdAt: '2025-01-01T00:00:00Z',
        quotes: [],
        documents: [],
        clientName: 'Клиент 1',
      },
      {
        id: 'deal-2',
        title: 'Сделка вторая',
        clientId: 'client-2',
        status: 'open',
        createdAt: '2026-01-01T00:00:00Z',
        quotes: [],
        documents: [],
        clientName: 'Клиент 2',
      },
    ];

    renderAppContent('/deals?dealId=deal-1');

    expect(screen.getByText('Сделка первая')).toBeInTheDocument();

    fireEvent.keyDown(window, { key: 'ArrowDown', altKey: true });

    await waitFor(() => {
      expect(screen.getByText('Сделка вторая')).toBeInTheDocument();
    });

    fireEvent.keyDown(window, { key: 'o', ctrlKey: true });

    await waitFor(() => {
      expect(screen.getByText(/Сделка: Сделка вторая/i)).toBeInTheDocument();
      expect(screen.getByTestId('deal-preview-panel')).toHaveTextContent('Сделка вторая');
    });
  });

  it('deduplicates repeated tasks/quotes loading for the same selected deal within TTL', async () => {
    appDataMock.deals = [
      {
        id: 'deal-1',
        title: 'Сделка первая',
        clientId: 'client-1',
        status: 'open',
        createdAt: '2025-01-01T00:00:00Z',
        quotes: [],
        documents: [],
        clientName: 'Клиент 1',
      },
    ];

    renderAppContent('/deals?dealId=deal-1');

    await waitFor(() => {
      expect(fetchTasksByDeal).toHaveBeenCalledWith('deal-1', { showDeleted: true });
      expect(fetchQuotesByDeal).toHaveBeenCalledWith('deal-1', { showDeleted: true });
    });
    expect(fetchTasksByDeal).toHaveBeenCalledTimes(1);
    expect(fetchQuotesByDeal).toHaveBeenCalledTimes(1);

    fireEvent.keyDown(window, { key: 'ArrowDown', altKey: true });
    fireEvent.keyDown(window, { key: 'ArrowUp', altKey: true });

    await waitFor(() => {
      expect(fetchTasksByDeal).toHaveBeenCalledTimes(1);
      expect(fetchQuotesByDeal).toHaveBeenCalledTimes(1);
    });
  });

  it('loads quotes for the second deal after manual selection from auto-selected first deal', async () => {
    appDataMock.deals = [
      {
        id: 'deal-1',
        title: 'Сделка первая',
        clientId: 'client-1',
        status: 'open',
        createdAt: '2025-01-01T00:00:00Z',
        quotes: [],
        documents: [],
        clientName: 'Клиент 1',
      },
      {
        id: 'deal-2',
        title: 'Сделка вторая',
        clientId: 'client-2',
        status: 'open',
        createdAt: '2025-02-01T00:00:00Z',
        quotes: [],
        documents: [],
        clientName: 'Клиент 2',
      },
    ];

    renderAppContent('/deals');

    await waitFor(() => {
      expect(fetchQuotesByDeal).toHaveBeenCalledWith('deal-1', { showDeleted: true });
    });

    fireEvent.click(screen.getByRole('button', { name: 'Select deal-2' }));

    await waitFor(() => {
      expect(screen.getByTestId('selected-deal')).toHaveTextContent('deal-2');
      expect(fetchQuotesByDeal).toHaveBeenCalledWith('deal-2', { showDeleted: true });
      expect(fetchTasksByDeal).toHaveBeenCalledWith('deal-2', { showDeleted: true });
    });
  });

  it('restores cached quotes after deals refresh with embed-none payload', async () => {
    const cachedQuote = {
      id: 'quote-1',
      dealId: 'deal-1',
      sellerId: 'user-1',
      sellerName: 'Tester',
      insuranceCompanyId: 'ins-1',
      insuranceCompany: 'Компания',
      insuranceTypeId: 'type-1',
      insuranceType: 'Каско',
      sumInsured: 1000000,
      premium: 50000,
      deductible: '',
      officialDealer: false,
      gap: false,
      comments: 'Тест',
      createdAt: '2026-01-01T00:00:00Z',
      deletedAt: null,
    };

    appDataMock.deals = [
      {
        id: 'deal-1',
        title: 'Сделка первая',
        clientId: 'client-1',
        status: 'open',
        createdAt: '2025-01-01T00:00:00Z',
        quotes: [],
        documents: [],
        clientName: 'Клиент 1',
      },
    ];
    fetchQuotesByDealMock.mockResolvedValue([cachedQuote]);

    renderAppContent('/deals');

    await waitFor(() => {
      expect(fetchQuotesByDeal).toHaveBeenCalledWith('deal-1', { showDeleted: true });
    });

    updateAppDataMock.mockClear();
    fireEvent.click(screen.getByRole('button', { name: 'Trigger search change' }));
    fireEvent.click(screen.getByRole('button', { name: 'Trigger search submit' }));

    await waitFor(() => {
      expect(refreshDealsMock).toHaveBeenCalled();
      expect(updateAppDataMock).toHaveBeenCalled();
    });

    const baseState = {
      deals: [
        {
          ...appDataMock.deals[0],
          quotes: [],
        },
      ],
    };
    const restored = updateAppDataMock.mock.calls
      .map(([updater]) => (typeof updater === 'function' ? updater(baseState) : updater))
      .find(
        (result) =>
          result &&
          'deals' in result &&
          Array.isArray(result.deals) &&
          result.deals[0]?.quotes?.[0]?.id === 'quote-1',
      );

    expect(restored).toBeTruthy();
  });

  it('invalidates cached deal tasks after task mutation and reloads data', async () => {
    appDataMock.deals = [
      {
        id: 'deal-1',
        title: 'Сделка первая',
        clientId: 'client-1',
        status: 'open',
        createdAt: '2025-01-01T00:00:00Z',
        quotes: [],
        documents: [],
        clientName: 'Клиент 1',
      },
      {
        id: 'deal-2',
        title: 'Сделка вторая',
        clientId: 'client-2',
        status: 'open',
        createdAt: '2025-02-01T00:00:00Z',
        quotes: [],
        documents: [],
        clientName: 'Клиент 2',
      },
    ];

    renderAppContent('/deals?dealId=deal-1');

    await waitFor(() => {
      expect(fetchTasksByDeal).toHaveBeenCalledTimes(1);
    });

    fireEvent.click(screen.getByRole('button', { name: 'Trigger task update' }));

    await waitFor(() => {
      expect(updateTask).toHaveBeenCalledWith('task-1', { status: 'done' });
    });

    fireEvent.click(screen.getByRole('button', { name: 'Select deal-2' }));
    fireEvent.click(screen.getByRole('button', { name: 'Select deal-1' }));

    await waitFor(() => {
      expect(fetchTasksByDeal).toHaveBeenCalledTimes(3);
    });
  });

  it('keeps deep-link selection when deal is loaded outside current deals list', async () => {
    appDataMock.deals = [];
    refreshDealsMock.mockResolvedValue([]);
    fetchDealMock.mockResolvedValue({
      id: 'deal-remote',
      title: 'Сделка удаленная',
      clientId: 'client-1',
      status: 'lost',
      createdAt: '2026-01-01T00:00:00Z',
      quotes: [],
      documents: [],
      clientName: 'Клиент 1',
    });

    renderAppContent('/deals?dealId=deal-remote');

    await waitFor(() => {
      expect(fetchDealMock).toHaveBeenCalledWith('deal-remote');
      expect(screen.getByTestId('selected-deal')).toHaveTextContent('deal-remote');
    });
  });

  it('opens deep-linked deal after authentication on the same URL', async () => {
    authStateMock.isAuthenticated = false;
    appDataMock.deals = [];
    fetchDealMock.mockResolvedValue({
      id: 'deal-auth',
      title: 'Сделка после входа',
      clientId: 'client-1',
      status: 'won',
      createdAt: '2026-01-01T00:00:00Z',
      quotes: [],
      documents: [],
      clientName: 'Клиент 1',
    });

    const view = renderAppContent('/deals?dealId=deal-auth');

    expect(fetchDealMock).not.toHaveBeenCalled();

    authStateMock.isAuthenticated = true;
    view.rerender(
      <MemoryRouter initialEntries={['/deals?dealId=deal-auth']}>
        <AppContent />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(fetchDealMock).toHaveBeenCalledWith('deal-auth');
      expect(screen.getByTestId('selected-deal')).toHaveTextContent('deal-auth');
    });
  });

  it('keeps selected created deal when refresh payload does not contain it', async () => {
    appDataMock.deals = [
      {
        id: 'deal-1',
        title: 'Сделка первая',
        clientId: 'client-1',
        status: 'open',
        createdAt: '2025-01-01T00:00:00Z',
        quotes: [],
        documents: [],
        clientName: 'Клиент 1',
      },
    ];
    refreshDealsMock.mockResolvedValue(appDataMock.deals);

    renderAppContent('/deals?dealId=deal-1');
    await waitFor(() => {
      expect(screen.getByTestId('selected-deal')).toHaveTextContent('deal-1');
    });

    fireEvent.click(screen.getByRole('button', { name: 'Trigger create deal' }));

    await waitFor(() => {
      expect(createDeal).toHaveBeenCalledTimes(1);
      expect(screen.getByTestId('selected-deal')).toHaveTextContent('deal-created');
    });

    fireEvent.click(screen.getByRole('button', { name: 'Trigger search change' }));

    await waitFor(() => {
      expect(refreshDealsMock).toHaveBeenCalledTimes(1);
      expect(screen.getByTestId('selected-deal')).toHaveTextContent('deal-created');
    });

    fireEvent.click(screen.getByRole('button', { name: 'Trigger search submit' }));

    await waitFor(() => {
      expect(refreshDealsMock).toHaveBeenCalledTimes(2);
      expect(screen.getByTestId('selected-deal')).toHaveTextContent('deal-created');
    });
  });

  it('does not refresh deals on search input change without submit', async () => {
    appDataMock.deals = [
      {
        id: 'deal-1',
        title: 'Сделка первая',
        clientId: 'client-1',
        status: 'open',
        createdAt: '2025-01-01T00:00:00Z',
        quotes: [],
        documents: [],
        clientName: 'Клиент 1',
      },
    ];
    refreshDealsMock.mockResolvedValue(appDataMock.deals);

    renderAppContent('/deals?dealId=deal-1');
    await waitFor(() => {
      expect(screen.getByTestId('selected-deal')).toHaveTextContent('deal-1');
    });

    expect(refreshDealsMock).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole('button', { name: 'Trigger search change' }));

    await new Promise((resolve) => setTimeout(resolve, 350));
    expect(refreshDealsMock).toHaveBeenCalledTimes(1);
  });

  it('refreshes deals on search clear action', async () => {
    appDataMock.deals = [
      {
        id: 'deal-1',
        title: 'Сделка первая',
        clientId: 'client-1',
        status: 'open',
        createdAt: '2025-01-01T00:00:00Z',
        quotes: [],
        documents: [],
        clientName: 'Клиент 1',
      },
    ];
    refreshDealsMock.mockResolvedValue(appDataMock.deals);

    renderAppContent('/deals?dealId=deal-1');

    await waitFor(() => {
      expect(screen.getByTestId('selected-deal')).toHaveTextContent('deal-1');
    });

    expect(refreshDealsMock).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole('button', { name: 'Trigger search change' }));
    fireEvent.click(screen.getByRole('button', { name: 'Trigger search submit' }));
    await waitFor(() => {
      expect(refreshDealsMock).toHaveBeenCalledTimes(2);
    });

    fireEvent.click(screen.getByRole('button', { name: 'Trigger search clear' }));
    await waitFor(() => {
      expect(refreshDealsMock).toHaveBeenCalledTimes(3);
    });
  });

  it('forces deals list refresh without losing selected deal', async () => {
    appDataMock.deals = [
      {
        id: 'deal-1',
        title: 'Сделка первая',
        clientId: 'client-1',
        status: 'open',
        createdAt: '2025-01-01T00:00:00Z',
        quotes: [],
        documents: [],
        clientName: 'Клиент 1',
      },
    ];
    refreshDealsMock.mockResolvedValue(appDataMock.deals);

    renderAppContent('/deals?dealId=deal-1');

    await waitFor(() => {
      expect(screen.getByTestId('selected-deal')).toHaveTextContent('deal-1');
    });

    fireEvent.click(screen.getByRole('button', { name: 'Trigger deals refresh' }));

    await waitFor(() => {
      expect(invalidateDealsCacheMock).toHaveBeenCalledTimes(1);
      expect(refreshDealsMock).toHaveBeenLastCalledWith({}, { force: true });
      expect(screen.getByTestId('selected-deal')).toHaveTextContent('deal-1');
    });
  });

  it('shows dedicated 403 deep-link error and keeps selected deal id', async () => {
    appDataMock.deals = [];
    fetchDealMock.mockRejectedValue(new APIError('Forbidden', 403, '/deals/deal-no-access/'));

    renderAppContent('/deals?dealId=deal-no-access');

    await waitFor(() => {
      expect(setErrorMock).toHaveBeenCalledWith('Нет доступа к сделке по ссылке.');
    });
    expect(screen.getByTestId('selected-deal')).toHaveTextContent('deal-no-access');
  });

  it('shows dedicated 404 deep-link error and keeps selected deal id', async () => {
    appDataMock.deals = [];
    fetchDealMock.mockRejectedValue(new APIError('Not found', 404, '/deals/deal-missing/'));

    renderAppContent('/deals?dealId=deal-missing');

    await waitFor(() => {
      expect(setErrorMock).toHaveBeenCalledWith('Сделка по ссылке не найдена.');
    });
    expect(screen.getByTestId('selected-deal')).toHaveTextContent('deal-missing');
  });

  it('always clears deal focus after successful postpone', async () => {
    appDataMock.deals = [
      {
        id: 'deal-1',
        title: 'Сделка первая',
        clientId: 'client-1',
        status: 'open',
        createdAt: '2025-01-01T00:00:00Z',
        quotes: [],
        documents: [],
        clientName: 'Клиент 1',
      },
    ];
    refreshDealsMock.mockResolvedValue(appDataMock.deals);

    renderAppContent('/deals?dealId=deal-1');

    expect(screen.getByTestId('selected-deal')).toHaveTextContent('deal-1');
    expect(screen.getByTestId('focus-cleared')).toHaveTextContent('false');

    fireEvent.click(screen.getByRole('button', { name: 'Trigger postpone' }));

    await waitFor(() => {
      expect(updateDealMock).toHaveBeenCalled();
      expect(screen.getByTestId('selected-deal')).toHaveTextContent('null');
      expect(screen.getByTestId('focus-cleared')).toHaveTextContent('true');
    });
  });

  it('restores previous selection when postpone fails', async () => {
    appDataMock.deals = [
      {
        id: 'deal-1',
        title: 'Сделка первая',
        clientId: 'client-1',
        status: 'open',
        createdAt: '2025-01-01T00:00:00Z',
        quotes: [],
        documents: [],
        clientName: 'Клиент 1',
      },
    ];
    updateDealMock.mockRejectedValueOnce(new Error('network'));

    renderAppContent('/deals?dealId=deal-1');
    fireEvent.click(screen.getByRole('button', { name: 'Trigger postpone' }));

    await waitFor(() => {
      expect(updateDealMock).toHaveBeenCalled();
      expect(screen.getByTestId('selected-deal')).toHaveTextContent('deal-1');
      expect(screen.getByTestId('focus-cleared')).toHaveTextContent('false');
    });
  });

  it('opens client delete modal via Ctrl+Backspace in clients context', async () => {
    appDataMock.clients = [
      {
        id: 'client-old',
        name: 'Клиент Старый',
        createdAt: '2025-01-01T00:00:00Z',
        updatedAt: '2025-01-01T00:00:00Z',
      },
      {
        id: 'client-new',
        name: 'Клиент Новый',
        createdAt: '2026-01-01T00:00:00Z',
        updatedAt: '2026-01-01T00:00:00Z',
      },
    ];

    renderAppContent('/clients');

    fireEvent.keyDown(window, { key: 'Backspace', ctrlKey: true });

    await waitFor(() => {
      const dialog = screen.getByRole('dialog', { name: /Удалить клиента/i });
      expect(dialog).toBeInTheDocument();
      expect(within(dialog).getByText(/Клиент Новый/i)).toBeInTheDocument();
    });
  });

  it('switches selected client and opens edit modal via Ctrl+O in clients context', async () => {
    appDataMock.clients = [
      {
        id: 'client-old',
        name: 'Клиент Старый',
        createdAt: '2025-01-01T00:00:00Z',
        updatedAt: '2025-01-01T00:00:00Z',
      },
      {
        id: 'client-new',
        name: 'Клиент Новый',
        createdAt: '2026-01-01T00:00:00Z',
        updatedAt: '2026-01-01T00:00:00Z',
      },
    ];

    renderAppContent('/clients');

    fireEvent.keyDown(window, { key: 'ArrowDown', altKey: true });
    fireEvent.keyDown(window, { key: 'o', ctrlKey: true });

    await waitFor(() => {
      const dialog = screen.getByRole('dialog', { name: /Редактировать клиента/i });
      expect(dialog).toBeInTheDocument();
      expect(within(dialog).getByTestId('client-form')).toHaveTextContent(/Клиент Старый/i);
    });
  });

  it('switches selected policy and opens edit policy by Ctrl+O', async () => {
    appDataMock.policiesList = [
      {
        id: 'policy-1',
        number: 'AAA-001',
        insuranceCompanyId: 'ins-1',
        insuranceCompany: 'Inscorp',
        insuranceTypeId: 'type-1',
        insuranceType: 'КАСКО',
        dealId: 'deal-1',
        status: 'active',
        createdAt: '2025-01-01T00:00:00Z',
        updatedAt: '2025-01-01T00:00:00Z',
      },
      {
        id: 'policy-2',
        number: 'BBB-002',
        insuranceCompanyId: 'ins-2',
        insuranceCompany: 'Inscorp 2',
        insuranceTypeId: 'type-2',
        insuranceType: 'ОСАГО',
        dealId: 'deal-2',
        status: 'active',
        createdAt: '2026-01-01T00:00:00Z',
        updatedAt: '2026-01-01T00:00:00Z',
      },
    ];

    renderAppContent('/policies');

    expect(screen.getByText('BBB-002')).toBeInTheDocument();

    fireEvent.keyDown(window, { key: 'ArrowDown', altKey: true });

    await waitFor(() => {
      expect(screen.getByText('AAA-001')).toBeInTheDocument();
    });

    fireEvent.keyDown(window, { key: 'o', ctrlKey: true });

    await waitFor(() => {
      expect(screen.getByTestId('app-modals-editing-policy')).toHaveTextContent(
        'editing-policy:AAA-001',
      );
    });
  });

  it('switches selected task and marks it done via Ctrl+Enter', async () => {
    appDataMock.tasks = [
      {
        id: 'task-1',
        title: 'Перезвонить клиенту',
        status: 'todo',
        priority: 'normal',
        createdAt: '2026-01-02T00:00:00Z',
        dueAt: '2026-01-02',
        dealId: 'deal-1',
      },
      {
        id: 'task-2',
        title: 'Отправить документы',
        status: 'todo',
        priority: 'normal',
        createdAt: '2026-01-03T00:00:00Z',
        dueAt: '2026-01-03',
        dealId: 'deal-2',
      },
    ];

    renderAppContent('/tasks');

    fireEvent.keyDown(window, { key: 'ArrowDown', altKey: true });
    fireEvent.keyDown(window, { key: 'Enter', ctrlKey: true });

    await waitFor(() => {
      expect(updateTask).toHaveBeenCalledWith('task-2', { status: 'done' });
    });
  });
});
