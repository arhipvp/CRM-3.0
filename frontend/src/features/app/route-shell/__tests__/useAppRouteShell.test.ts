import type {
  AppRouteDealsActions,
  AppRouteFinanceActions,
} from '../../../../components/app/appRoutes.types';
import { renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import type { AppRouteShellResult } from '../types';
import { useAppRouteShell } from '../useAppRouteShell';

describe('useAppRouteShell', () => {
  it('returns the same binding contract shape for AppRoutes', () => {
    const noopDealsAction = {
      onCreateDealMailbox: (async () =>
        undefined) as unknown as AppRouteDealsActions['onCreateDealMailbox'],
      onCheckDealMailbox: (async () =>
        undefined) as unknown as AppRouteDealsActions['onCheckDealMailbox'],
      onSendChatMessage: (async () =>
        undefined) as unknown as AppRouteDealsActions['onSendChatMessage'],
    };
    const noopFinanceAction = {
      onCreateFinanceStatement: (async () =>
        undefined) as unknown as AppRouteFinanceActions['onCreateFinanceStatement'],
      onUpdateFinanceStatement: (async () =>
        undefined) as unknown as AppRouteFinanceActions['onUpdateFinanceStatement'],
    };

    const bindings: AppRouteShellResult = {
      routeData: {
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
      routeDealsActions: {
        onClientEdit: () => undefined,
        onClientDelete: () => undefined,
        onClientMerge: () => undefined,
        onClientFindSimilar: () => undefined,
        selectedDealId: null,
        onSelectDeal: () => undefined,
        onCloseDeal: async () => undefined,
        onReopenDeal: async () => undefined,
        onUpdateDeal: async () => undefined,
        onPinDeal: async () => undefined,
        onUnpinDeal: async () => undefined,
        onRequestAddQuote: () => undefined,
        onRequestEditQuote: () => undefined,
        onRequestAddPolicy: () => undefined,
        onRequestEditPolicy: () => undefined,
        onRequestAddClient: () => undefined,
        pendingDealClientId: null,
        onPendingDealClientConsumed: () => undefined,
        onDeleteQuote: async () => undefined,
        onDeletePolicy: async () => undefined,
        onDriveFolderCreated: () => undefined,
        onCreateDealMailbox: noopDealsAction.onCreateDealMailbox,
        onCheckDealMailbox: noopDealsAction.onCheckDealMailbox,
        onFetchChatMessages: async () => [],
        onSendChatMessage: noopDealsAction.onSendChatMessage,
        onDeleteChatMessage: async () => undefined,
        onFetchDealHistory: async () => [],
        onCreateTask: async () => undefined,
        onUpdateTask: async () => undefined,
        onDeleteTask: async () => undefined,
        onDeleteDeal: async () => undefined,
        onRestoreDeal: async () => undefined,
        onMergeDeals: async () => undefined,
      },
      routeFilters: {
        dealSearch: '',
        onDealSearchChange: () => undefined,
        onDealSearchSubmit: () => undefined,
        dealExecutorFilter: '',
        onDealExecutorFilterChange: () => undefined,
        dealShowDeleted: false,
        onDealShowDeletedChange: () => undefined,
        dealShowClosed: false,
        onDealShowClosedChange: () => undefined,
        dealOrdering: undefined,
        onDealOrderingChange: () => undefined,
      },
      routeFinanceActions: {
        onAddPayment: async () => undefined,
        onUpdatePayment: async () => undefined,
        onDeletePayment: async () => undefined,
        onAddFinancialRecord: async () => undefined,
        onUpdateFinancialRecord: async () => undefined,
        onDeleteFinancialRecord: async () => undefined,
        onCreateFinanceStatement: noopFinanceAction.onCreateFinanceStatement,
        onDeleteFinanceStatement: async () => undefined,
        onRemoveFinanceStatementRecords: async () => undefined,
        onUpdateFinanceStatement: noopFinanceAction.onUpdateFinanceStatement,
      },
      routeLoading: {
        onLoadMoreDeals: async () => undefined,
        dealsHasMore: false,
        dealsTotalCount: 0,
        isLoadingMoreDeals: false,
        onLoadMorePolicies: async () => undefined,
        policiesHasMore: false,
        isLoadingMorePolicies: false,
        isPoliciesListLoading: false,
        isCommissionsDataLoading: false,
        hasCommissionsSnapshotLoaded: true,
        isFinanceDataLoading: false,
        hasFinanceSnapshotLoaded: true,
        isTasksLoading: false,
      },
    };

    const { result } = renderHook(() => useAppRouteShell(bindings));

    expect(result.current.routeData).toBe(bindings.routeData);
    expect(result.current.routeDealsActions).toBe(bindings.routeDealsActions);
    expect(result.current.routeFilters).toBe(bindings.routeFilters);
    expect(result.current.routeFinanceActions).toBe(bindings.routeFinanceActions);
    expect(result.current.routeLoading).toBe(bindings.routeLoading);
  });
});
