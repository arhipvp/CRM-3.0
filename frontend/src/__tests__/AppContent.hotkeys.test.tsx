import React from 'react';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import AppContent from '../AppContent';
import { APIError, fetchQuotesByDeal, fetchTasksByDeal, updateDeal, updateTask } from '../api';

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
const updateDealMock = vi.hoisted(() => vi.fn());
const setErrorMock = vi.hoisted(() => vi.fn());
const fetchDealMock = vi.hoisted(() => vi.fn());
const fetchTasksByDealMock = vi.hoisted(() => vi.fn());
const fetchQuotesByDealMock = vi.hoisted(() => vi.fn());

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
    ensureFinanceDataLoaded: vi.fn().mockResolvedValue(undefined),
    ensureTasksLoaded: vi.fn().mockResolvedValue(undefined),
    refreshDeals: refreshDealsMock.mockImplementation(async () => appDataMock.deals),
    invalidateDealsCache: vi.fn(),
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
    isFinanceDataLoading: false,
    isTasksLoading: false,
    isSyncing: false,
    setIsSyncing: vi.fn(),
    error: null,
    setError: setErrorMock,
  }),
}));

vi.mock('../components/MainLayout', () => ({
  MainLayout: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="main-layout">{children}</div>
  ),
}));

vi.mock('../components/app/AppRoutes', () => ({
  AppRoutes: ({
    onPostponeDeal,
    onUpdateTask,
    onSelectDeal,
    selectedDealId,
    isDealFocusCleared,
  }: {
    onPostponeDeal?: (dealId: string, data: Record<string, unknown>) => Promise<void>;
    onUpdateTask?: (taskId: string, data: { status?: string }) => Promise<void>;
    onSelectDeal?: (dealId: string) => void;
    selectedDealId?: string | null;
    isDealFocusCleared?: boolean;
  }) => (
    <div data-testid="app-routes">
      <div data-testid="selected-deal">{selectedDealId ?? 'null'}</div>
      <div data-testid="focus-cleared">{isDealFocusCleared ? 'true' : 'false'}</div>
      <button
        type="button"
        onClick={() =>
          void onPostponeDeal?.('deal-1', {
            title: 'Сделка первая',
            description: '',
            clientId: 'client-1',
            source: null,
            nextContactDate: '2026-12-31',
            expectedClose: '2027-02-28',
          }).catch(() => undefined)
        }
      >
        Trigger postpone
      </button>
      <button type="button" onClick={() => void onUpdateTask?.('task-1', { status: 'done' })}>
        Trigger task update
      </button>
      <button type="button" onClick={() => onSelectDeal?.('deal-2')}>
        Select deal-2
      </button>
      <button type="button" onClick={() => onSelectDeal?.('deal-1')}>
        Select deal-1
      </button>
    </div>
  ),
}));

vi.mock('../components/app/AppModals', () => ({
  AppModals: ({
    modal,
    editingPolicy,
  }: {
    modal: string | null;
    editingPolicy?: { number: string } | null;
  }) => (
    <div data-testid="app-modals">
      <span>{modal}</span>
      {editingPolicy && (
        <span data-testid="app-modals-editing-policy">editing-policy:{editingPolicy.number}</span>
      )}
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
    fetchDealMock.mockReset();
    fetchTasksByDealMock.mockReset();
    fetchQuotesByDealMock.mockReset();
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
