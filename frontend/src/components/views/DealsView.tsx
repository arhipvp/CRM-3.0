import React from 'react';

import {
  ActivityLog,
  ChatMessage,
  Deal,
  Client,
  FinancialRecord,
  Payment,
  Policy,
  Quote,
  Task,
  User,
} from '../../types';
import type { AddFinancialRecordFormValues } from '../forms/AddFinancialRecordForm';
import type { AddPaymentFormValues } from '../forms/AddPaymentForm';
import type { AddTaskFormValues } from '../forms/AddTaskForm';
import type { DealFormValues } from '../forms/DealForm';
import type { DealMailboxCreateResult, DealMailboxSyncResult } from '../../api/deals';
import { DealDetailsPanel } from './dealsView/DealDetailsPanel';
import { DealsList } from './dealsView/DealsList';
import { useSelectedDeal } from '../../hooks/useSelectedDeal';

interface DealsViewProps {
  deals: Deal[];
  clients: Client[];
  onClientEdit?: (client: Client) => void;
  policies: Policy[];
  payments: Payment[];
  financialRecords: FinancialRecord[];
  tasks: Task[];
  users: User[];
  currentUser: User | null;
  selectedDealId: string | null;
  isDealFocusCleared?: boolean;
  dealRowFocusRequest?: { dealId: string; nonce: number } | null;
  onSelectDeal: (dealId: string) => void;
  onClearDealFocus?: () => void;
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
  onDeleteQuote: (dealId: string, quoteId: string) => Promise<void>;
  onDeletePolicy: (policyId: string) => Promise<void>;
  onRefreshPolicies?: (options?: { force?: boolean }) => Promise<void>;
  onPolicyDraftReady?: (
    dealId: string,
    parsed: Record<string, unknown>,
    fileName?: string | null,
    fileId?: string | null,
  ) => void;
  onAddPayment: (values: AddPaymentFormValues) => Promise<void>;
  onUpdatePayment: (paymentId: string, values: AddPaymentFormValues) => Promise<void>;
  onDeletePayment: (paymentId: string) => Promise<void>;
  onAddFinancialRecord: (values: AddFinancialRecordFormValues) => Promise<void>;
  onUpdateFinancialRecord: (
    recordId: string,
    values: AddFinancialRecordFormValues,
  ) => Promise<void>;
  onDeleteFinancialRecord: (recordId: string) => Promise<void>;
  onDriveFolderCreated: (dealId: string, folderId: string) => void;
  onCreateDealMailbox: (dealId: string) => Promise<DealMailboxCreateResult>;
  onCheckDealMailbox: (dealId: string) => Promise<DealMailboxSyncResult>;
  onFetchChatMessages: (dealId: string) => Promise<ChatMessage[]>;
  onSendChatMessage: (dealId: string, body: string) => Promise<ChatMessage>;
  onDeleteChatMessage: (messageId: string) => Promise<void>;
  onFetchDealHistory: (dealId: string, includeDeleted?: boolean) => Promise<ActivityLog[]>;
  onCreateTask: (dealId: string, data: AddTaskFormValues) => Promise<void>;
  onUpdateTask: (taskId: string, data: Partial<AddTaskFormValues>) => Promise<void>;
  onDeleteTask: (taskId: string) => Promise<void>;
  onDeleteDeal: (dealId: string) => Promise<void>;
  onRestoreDeal: (dealId: string) => Promise<void>;
  onMergeDeals: (
    targetDealId: string,
    sourceDealIds: string[],
    finalDeal: DealFormValues,
    previewSnapshotId?: string,
  ) => Promise<void>;
  onLoadMoreDeals: () => Promise<void>;
  dealsHasMore: boolean;
  dealsTotalCount: number;
  isLoadingMoreDeals: boolean;
  isBackgroundRefreshingDeals?: boolean;
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
  onDealSelectionBlockedChange?: (blocked: boolean) => void;
}

export const DealsView: React.FC<DealsViewProps> = ({
  deals,
  clients,
  onClientEdit,
  policies,
  payments,
  financialRecords,
  tasks,
  users,
  currentUser,
  selectedDealId,
  isDealFocusCleared = false,
  dealRowFocusRequest,
  onSelectDeal,
  onClearDealFocus,
  onCloseDeal,
  onReopenDeal,
  onUpdateDeal,
  onRefreshDeal,
  onPinDeal,
  onUnpinDeal,
  onPostponeDeal,
  onRequestAddQuote,
  onRequestEditQuote,
  onRequestAddPolicy,
  onRequestEditPolicy,
  onRequestAddClient,
  onDeleteQuote,
  onDeletePolicy,
  onRefreshPolicies,
  onPolicyDraftReady,
  onAddPayment,
  onUpdatePayment,
  onDeletePayment,
  onAddFinancialRecord,
  onUpdateFinancialRecord,
  onDeleteFinancialRecord,
  onDriveFolderCreated,
  onCreateDealMailbox,
  onCheckDealMailbox,
  onFetchChatMessages,
  onSendChatMessage,
  onDeleteChatMessage,
  onFetchDealHistory,
  onCreateTask,
  onUpdateTask,
  onDeleteTask,
  onDeleteDeal,
  onRestoreDeal,
  onMergeDeals,
  onLoadMoreDeals,
  dealsHasMore,
  dealsTotalCount,
  isLoadingMoreDeals,
  isBackgroundRefreshingDeals = false,
  dealSearch,
  onDealSearchChange,
  dealExecutorFilter,
  onDealExecutorFilterChange,
  dealShowDeleted,
  onDealShowDeletedChange,
  dealShowClosed,
  onDealShowClosedChange,
  dealOrdering,
  onDealOrderingChange,
  onDealSelectionBlockedChange,
}) => {
  const [isDealSelectionBlocked, setDealSelectionBlocked] = React.useState(false);
  const { sortedDeals, selectedDeal, selectedClient, sellerUser, executorUser } = useSelectedDeal({
    deals,
    clients,
    users,
    selectedDealId,
    isDealFocusCleared,
  });
  const handleDealSelectionBlockedChange = React.useCallback(
    (blocked: boolean) => {
      setDealSelectionBlocked(blocked);
      onDealSelectionBlockedChange?.(blocked);
    },
    [onDealSelectionBlockedChange],
  );
  const handleSelectDeal = React.useCallback(
    (dealId: string) => {
      if (isDealSelectionBlocked) {
        return;
      }
      onSelectDeal(dealId);
    },
    [isDealSelectionBlocked, onSelectDeal],
  );

  return (
    <div className="flex h-full flex-col gap-6">
      {isBackgroundRefreshingDeals && (
        <div className="app-panel-muted px-4 py-2 text-xs font-semibold text-sky-800">
          Обновляем список сделок...
        </div>
      )}
      <section className="app-panel overflow-hidden">
        <div className="divide-y divide-slate-200">
          <DealsList
            sortedDeals={sortedDeals}
            selectedDeal={selectedDeal}
            dealRowFocusRequest={dealRowFocusRequest}
            dealSearch={dealSearch}
            onDealSearchChange={onDealSearchChange}
            dealExecutorFilter={dealExecutorFilter}
            onDealExecutorFilterChange={onDealExecutorFilterChange}
            dealShowDeleted={dealShowDeleted}
            onDealShowDeletedChange={onDealShowDeletedChange}
            dealShowClosed={dealShowClosed}
            onDealShowClosedChange={onDealShowClosedChange}
            dealOrdering={dealOrdering}
            onDealOrderingChange={onDealOrderingChange}
            users={users}
            dealsHasMore={dealsHasMore}
            dealsTotalCount={dealsTotalCount}
            isLoadingMoreDeals={isLoadingMoreDeals}
            onLoadMoreDeals={onLoadMoreDeals}
            onSelectDeal={handleSelectDeal}
            onPinDeal={onPinDeal}
            onUnpinDeal={onUnpinDeal}
            currentUser={currentUser}
            isDealSelectionBlocked={isDealSelectionBlocked}
          />
          <DealDetailsPanel
            deals={deals}
            clients={clients}
            onClientEdit={onClientEdit}
            policies={policies}
            payments={payments}
            financialRecords={financialRecords}
            tasks={tasks}
            users={users}
            currentUser={currentUser}
            sortedDeals={sortedDeals}
            selectedDeal={selectedDeal}
            selectedClient={selectedClient}
            sellerUser={sellerUser}
            executorUser={executorUser}
            onSelectDeal={handleSelectDeal}
            onCloseDeal={onCloseDeal}
            onReopenDeal={onReopenDeal}
            onUpdateDeal={onUpdateDeal}
            onRefreshDeal={onRefreshDeal}
            onPostponeDeal={onPostponeDeal}
            onMergeDeals={onMergeDeals}
            onRequestAddQuote={onRequestAddQuote}
            onRequestEditQuote={onRequestEditQuote}
            onRequestAddPolicy={onRequestAddPolicy}
            onRequestEditPolicy={onRequestEditPolicy}
            onRequestAddClient={onRequestAddClient}
            onDeleteQuote={onDeleteQuote}
            onDeletePolicy={onDeletePolicy}
            onRefreshPolicies={onRefreshPolicies}
            onPolicyDraftReady={onPolicyDraftReady}
            onAddPayment={onAddPayment}
            onUpdatePayment={onUpdatePayment}
            onDeletePayment={onDeletePayment}
            onAddFinancialRecord={onAddFinancialRecord}
            onUpdateFinancialRecord={onUpdateFinancialRecord}
            onDeleteFinancialRecord={onDeleteFinancialRecord}
            onDriveFolderCreated={onDriveFolderCreated}
            onCreateDealMailbox={onCreateDealMailbox}
            onCheckDealMailbox={onCheckDealMailbox}
            onFetchChatMessages={onFetchChatMessages}
            onSendChatMessage={onSendChatMessage}
            onDeleteChatMessage={onDeleteChatMessage}
            onFetchDealHistory={onFetchDealHistory}
            onCreateTask={onCreateTask}
            onUpdateTask={onUpdateTask}
            onDeleteTask={onDeleteTask}
            onDeleteDeal={onDeleteDeal}
            onRestoreDeal={onRestoreDeal}
            onDealSelectionBlockedChange={handleDealSelectionBlockedChange}
            onClearDealFocus={onClearDealFocus}
          />
        </div>
      </section>
    </div>
  );
};
