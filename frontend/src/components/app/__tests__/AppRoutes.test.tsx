import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';

import { AppRoutes } from '../AppRoutes';
import type { AppRoutesProps } from '../appRoutes.types';
import type { DealMailboxCreateResult, DealMailboxSyncResult } from '../../../api/deals';
import type { ChatMessage, Deal, Statement } from '../../../types';

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

const createDealStub = (): Deal => ({
  id: 'deal-1',
  title: 'Deal',
  clientId: 'client-1',
  status: 'open',
  createdAt: '2026-03-06T10:00:00Z',
  quotes: [],
  documents: [],
});

const createStatementStub = (): Statement => ({
  id: 'statement-1',
  name: 'Statement',
  statementType: 'income',
  status: 'draft',
  createdAt: '2026-03-06T10:00:00Z',
  updatedAt: '2026-03-06T10:00:00Z',
});

const createMailboxCreateResultStub = (): DealMailboxCreateResult => ({
  deal: createDealStub(),
  mailboxInitialPassword: null,
});

const createMailboxSyncResultStub = (): DealMailboxSyncResult => ({
  deal: createDealStub(),
  mailboxSync: {
    processed: 0,
    skipped: 0,
    failed: 0,
    deleted: 0,
  },
});

const createChatMessageStub = (): ChatMessage => ({
  id: 'chat-1',
  deal: 'deal-1',
  author_name: 'Test User',
  author_display_name: 'Test User',
  body: 'test',
  created_at: '2026-03-06T10:00:00Z',
});

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
    onCreateDealMailbox: vi.fn(async () => createMailboxCreateResultStub()),
    onCheckDealMailbox: vi.fn(async () => createMailboxSyncResultStub()),
    onFetchChatMessages: vi.fn(async () => []),
    onSendChatMessage: vi.fn(async () => createChatMessageStub()),
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
    onCreateFinanceStatement: vi.fn(async () => createStatementStub()),
    onDeleteFinanceStatement: noopAsync,
    onRemoveFinanceStatementRecords: noopAsync,
    onUpdateFinanceStatement: vi.fn(async () => createStatementStub()),
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
    isCommissionsDataLoading: false,
    hasCommissionsSnapshotLoaded: false,
    isFinanceDataLoading: false,
    hasFinanceSnapshotLoaded: false,
    isTasksLoading: false,
  },
});

describe('AppRoutes /commissions', () => {
  it('shows blocking loader on initial finance load without existing data', async () => {
    const props = createProps();
    props.loading.isCommissionsDataLoading = true;
    props.loading.hasCommissionsSnapshotLoaded = false;

    render(
      <MemoryRouter initialEntries={['/commissions']}>
        <AppRoutes {...props} />
      </MemoryRouter>,
    );

    expect(await screen.findByText('blocking-loader')).toBeInTheDocument();
  });

  it('keeps commissions content visible when data already exists', async () => {
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
    props.loading.isCommissionsDataLoading = true;
    props.loading.hasCommissionsSnapshotLoaded = true;

    render(
      <MemoryRouter initialEntries={['/commissions']}>
        <AppRoutes {...props} />
      </MemoryRouter>,
    );

    expect(await screen.findByText('content-visible')).toBeInTheDocument();
  });
});
