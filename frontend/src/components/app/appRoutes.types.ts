import type { FilterParams } from '../../api';
import type { DealMailboxCreateResult, DealMailboxSyncResult } from '../../api/deals';
import type { AddFinancialRecordFormValues } from '../../components/forms/AddFinancialRecordForm';
import type { AddPaymentFormValues } from '../../components/forms/AddPaymentForm';
import type { DealFormValues } from '../../components/forms/DealForm';
import type { AddTaskFormValues } from '../forms/AddTaskForm';
import type {
  ActivityLog,
  ChatMessage,
  Client,
  Deal,
  FinancialRecord,
  Payment,
  Policy,
  Quote,
  Statement,
  Task,
  User,
} from '../../types';

export type DealFocusRequest = { dealId: string; nonce: number };

export interface AppRouteDataBundle {
  deals: Deal[];
  clients: Client[];
  policies: Policy[];
  policiesList: Policy[];
  payments: Payment[];
  financialRecords: FinancialRecord[];
  statements: Statement[];
  tasks: Task[];
  users: User[];
  currentUser: User | null;
}

export interface AppRouteDealsActions {
  onClientEdit: (client: Client) => void;
  onClientDelete: (client: Client) => void;
  onClientMerge: (client: Client) => void;
  onClientFindSimilar: (client: Client) => void;
  selectedDealId: string | null;
  isDealFocusCleared?: boolean;
  dealRowFocusRequest?: DealFocusRequest | null;
  onSelectDeal: (dealId: string) => void;
  onClearDealFocus?: () => void;
  onDealPreview?: (dealId: string) => void;
  onCloseDeal: (
    dealId: string,
    payload: { reason: string; status?: 'won' | 'lost' },
  ) => Promise<void>;
  onReopenDeal: (dealId: string) => Promise<void>;
  onUpdateDeal: (dealId: string, data: DealFormValues) => Promise<void>;
  onRefreshDeal?: (dealId: string) => Promise<void>;
  onPinDeal: (dealId: string) => Promise<void>;
  onUnpinDeal: (dealId: string) => Promise<void>;
  onPostponeDeal?: (dealId: string, data: DealFormValues) => Promise<void>;
  onRequestAddQuote: (dealId: string) => void;
  onRequestEditQuote: (quote: Quote) => void;
  onRequestAddPolicy: (dealId: string) => void;
  onRequestEditPolicy: (policy: Policy) => void;
  onRequestAddClient: () => void;
  pendingDealClientId: string | null;
  onPendingDealClientConsumed: () => void;
  onDeleteQuote: (dealId: string, quoteId: string) => Promise<void>;
  onDeletePolicy: (policyId: string) => Promise<void>;
  onDriveFolderCreated: (dealId: string, folderId: string) => void;
  onCreateDealMailbox: (dealId: string) => Promise<DealMailboxCreateResult>;
  onCheckDealMailbox: (dealId: string) => Promise<DealMailboxSyncResult>;
  onFetchChatMessages: (dealId: string) => Promise<ChatMessage[]>;
  onSendChatMessage: (dealId: string, body: string) => Promise<ChatMessage>;
  onDeleteChatMessage: (messageId: string) => Promise<void>;
  onFetchDealHistory: (dealId: string, includeDeleted?: boolean) => Promise<ActivityLog[]>;
  onCreateTask: (dealId: string, data: AddTaskFormValues) => Promise<void>;
  onUpdateTask: (taskId: string, data: Partial<AddTaskFormValues>) => Promise<void>;
  onRefreshPolicies?: (options?: { force?: boolean }) => Promise<void>;
  onDeleteTask: (taskId: string) => Promise<void>;
  onRefreshPoliciesList?: (filters?: FilterParams) => Promise<void>;
  onDeleteDeal: (dealId: string) => Promise<void>;
  onRestoreDeal: (dealId: string) => Promise<void>;
  onMergeDeals: (
    targetDealId: string,
    sourceDealIds: string[],
    finalDeal: DealFormValues,
    previewSnapshotId?: string | undefined,
  ) => Promise<void>;
  onPolicyDraftReady?: (
    dealId: string,
    parsed: Record<string, unknown>,
    fileName?: string | null,
    fileId?: string | null,
  ) => void;
  onDealSelectionBlockedChange?: (blocked: boolean) => void;
}

export interface AppRouteFinanceActions {
  onAddPayment: (values: AddPaymentFormValues) => Promise<void>;
  onUpdatePayment: (paymentId: string, values: AddPaymentFormValues) => Promise<void>;
  onDeletePayment: (paymentId: string) => Promise<void>;
  onAddFinancialRecord: (values: AddFinancialRecordFormValues) => Promise<void>;
  onUpdateFinancialRecord: (
    recordId: string,
    values: AddFinancialRecordFormValues,
  ) => Promise<void>;
  onDeleteFinancialRecord: (recordId: string) => Promise<void>;
  onCreateFinanceStatement: (values: {
    name: string;
    statementType: Statement['statementType'];
    counterparty?: string;
    comment?: string;
    recordIds?: string[];
  }) => Promise<Statement>;
  onDeleteFinanceStatement: (statementId: string) => Promise<void>;
  onRemoveFinanceStatementRecords: (statementId: string, recordIds: string[]) => Promise<void>;
  onUpdateFinanceStatement: (
    statementId: string,
    values: Partial<{
      name: string;
      statementType: Statement['statementType'];
      status: Statement['status'];
      counterparty: string;
      comment: string;
      paidAt: string | null;
      recordIds: string[];
    }>,
  ) => Promise<Statement>;
}

export interface AppRouteFilterState {
  dealSearch: string;
  onDealSearchChange: (value: string) => void;
  dealExecutorFilter: string;
  onDealExecutorFilterChange: (value: string) => void;
  dealShowDeleted: boolean;
  onDealShowDeletedChange: (value: boolean) => void;
  dealShowClosed: boolean;
  onDealShowClosedChange: (value: boolean) => void;
  dealOrdering?: string;
  onDealOrderingChange: (value: string | undefined) => void;
}

export interface AppRouteLoadingState {
  onLoadMoreDeals: () => Promise<void>;
  dealsHasMore: boolean;
  dealsTotalCount: number;
  isLoadingMoreDeals: boolean;
  onLoadMorePolicies: () => Promise<void>;
  policiesHasMore: boolean;
  isLoadingMorePolicies: boolean;
  isPoliciesListLoading: boolean;
  isFinanceDataLoading: boolean;
  isTasksLoading: boolean;
  isSelectedDealTasksLoading?: boolean;
  isSelectedDealQuotesLoading?: boolean;
  isBackgroundRefreshingDeals: boolean;
  isBackgroundRefreshingPoliciesList: boolean;
  isBackgroundRefreshingTasks: boolean;
  isBackgroundRefreshingFinance: boolean;
}

export interface AppRoutesProps {
  data: AppRouteDataBundle;
  dealsActions: AppRouteDealsActions;
  financeActions: AppRouteFinanceActions;
  filters: AppRouteFilterState;
  loading: AppRouteLoadingState;
}
