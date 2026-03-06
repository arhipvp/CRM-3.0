import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';

import { AppRoutes } from '../AppRoutes';
import type { AppRoutesProps } from '../appRoutes.types';

vi.mock('../../views/CommissionsView', () => ({
  CommissionsView: ({ isLoading }: { isLoading?: boolean }) => (
    <div>
      <div>CommissionsView mock</div>
      <div>{isLoading ? 'blocking-loader' : 'content-visible'}</div>
    </div>
  ),
}));

const noop = vi.fn();
const noopAsync = vi.fn(async () => undefined);

const createProps = (): AppRoutesProps => ({
  data: {
    deals: [],
    clients: [],
    policies: [],
    policiesList: [],
    payments: [],
    financialRecords: [],
    statements: [],
    tasks: [],
    users: [],
    currentUser: null,
  },
  dealsActions: {
    onClientEdit: noop,
    onClientDelete: noop,
    onClientMerge: noop,
    onClientFindSimilar: noop,
    selectedDealId: null,
    onSelectDeal: noop,
    onCloseDeal: vi.fn(async () => undefined),
    onReopenDeal: vi.fn(async () => undefined),
    onUpdateDeal: vi.fn(async () => undefined),
    onPinDeal: vi.fn(async () => undefined),
    onUnpinDeal: vi.fn(async () => undefined),
    onRequestAddQuote: noop,
    onRequestEditQuote: noop,
    onRequestAddPolicy: noop,
    onRequestEditPolicy: noop,
    onRequestAddClient: noop,
    pendingDealClientId: null,
    onPendingDealClientConsumed: noop,
    onDeleteQuote: vi.fn(async () => undefined),
    onDeletePolicy: vi.fn(async () => undefined),
    onDriveFolderCreated: noop,
    onCreateDealMailbox: vi.fn(async () => ({ mailbox: null, warning: null })),
    onCheckDealMailbox: vi.fn(async () => ({ mailbox: null, sync: null, warnings: [] })),
    onFetchChatMessages: vi.fn(async () => []),
    onSendChatMessage: vi.fn(async () => ({
      id: 'chat-1',
      dealId: 'deal-1',
      body: 'test',
      direction: 'outgoing',
      createdAt: '2026-03-06T10:00:00Z',
      updatedAt: '2026-03-06T10:00:00Z',
    })),
    onDeleteChatMessage: vi.fn(async () => undefined),
    onFetchDealHistory: vi.fn(async () => []),
    onCreateTask: vi.fn(async () => undefined),
    onUpdateTask: vi.fn(async () => undefined),
    onDeleteTask: vi.fn(async () => undefined),
    onDeleteDeal: vi.fn(async () => undefined),
    onRestoreDeal: vi.fn(async () => undefined),
    onMergeDeals: vi.fn(async () => undefined),
  },
  financeActions: {
    onAddPayment: noopAsync,
    onUpdatePayment: noopAsync,
    onDeletePayment: noopAsync,
    onAddFinancialRecord: noopAsync,
    onUpdateFinancialRecord: noopAsync,
    onDeleteFinancialRecord: noopAsync,
    onCreateFinanceStatement: vi.fn(async () => ({
      id: 'statement-1',
      name: 'Statement',
      statementType: 'income',
      status: 'draft',
      createdAt: '2026-03-06T10:00:00Z',
      updatedAt: '2026-03-06T10:00:00Z',
    })),
    onDeleteFinanceStatement: noopAsync,
    onRemoveFinanceStatementRecords: noopAsync,
    onUpdateFinanceStatement: vi.fn(async () => ({
      id: 'statement-1',
      name: 'Statement',
      statementType: 'income',
      status: 'draft',
      createdAt: '2026-03-06T10:00:00Z',
      updatedAt: '2026-03-06T10:00:00Z',
    })),
  },
  filters: {
    dealSearch: '',
    onDealSearchChange: noop,
    onDealSearchSubmit: noop,
    onDealSearchClear: noop,
    dealExecutorFilter: '',
    onDealExecutorFilterChange: noop,
    dealShowDeleted: false,
    onDealShowDeletedChange: noop,
    dealShowClosed: false,
    onDealShowClosedChange: noop,
    onDealOrderingChange: noop,
  },
  loading: {
    onLoadMoreDeals: vi.fn(async () => undefined),
    dealsHasMore: false,
    dealsTotalCount: 0,
    isLoadingMoreDeals: false,
    onLoadMorePolicies: vi.fn(async () => undefined),
    policiesHasMore: false,
    isLoadingMorePolicies: false,
    isPoliciesListLoading: false,
    isFinanceDataLoading: false,
    isTasksLoading: false,
    isBackgroundRefreshingDeals: false,
    isBackgroundRefreshingPoliciesList: false,
    isBackgroundRefreshingTasks: false,
    isBackgroundRefreshingFinance: false,
  },
});

describe('AppRoutes /commissions', () => {
  it('shows blocking loader on initial finance load without existing data', async () => {
    const props = createProps();
    props.loading.isFinanceDataLoading = true;

    render(
      <MemoryRouter initialEntries={['/commissions']}>
        <AppRoutes {...props} />
      </MemoryRouter>,
    );

    expect(await screen.findByText('blocking-loader')).toBeInTheDocument();
  });

  it('keeps commissions content visible during background finance refresh', async () => {
    const props = createProps();
    props.data.financialRecords = [
      {
        id: 'record-1',
        paymentId: 'payment-1',
        amount: '1000',
        createdAt: '2026-03-06T10:00:00Z',
        updatedAt: '2026-03-06T10:00:00Z',
      },
    ];
    props.loading.isFinanceDataLoading = true;
    props.loading.isBackgroundRefreshingFinance = true;

    render(
      <MemoryRouter initialEntries={['/commissions']}>
        <AppRoutes {...props} />
      </MemoryRouter>,
    );

    expect(await screen.findByText('content-visible')).toBeInTheDocument();
    expect(screen.getByText('Обновляем финансовые данные...')).toBeInTheDocument();
  });
});
