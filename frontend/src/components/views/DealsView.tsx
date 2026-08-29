import React from 'react';
import { useSearchParams } from 'react-router-dom';

import {
  ActivityLog,
  ChatMessage,
  Deal,
  DealTimelineEvent,
  Client,
  ClientDuplicateHint,
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
import type { DealFormValues, PreselectedDealClient } from '../forms/DealForm';
import type { DealMailboxCreateResult, DealMailboxSyncResult } from '../../api/deals';
import { DealDetailsPanel } from './dealsView/DealDetailsPanel';
import { DealsList } from './dealsView/DealsList';
import { useSelectedDeal } from '../../hooks/useSelectedDeal';
import { isDealTabId, type DealTabId } from './dealsView/helpers';
import { PageHeader, PageShell } from '../common/layoutPrimitives';

interface DealsViewProps {
  deals: Deal[];
  clients: Client[];
  clientDuplicateHints: Record<string, ClientDuplicateHint>;
  onClientEdit?: (client: Client) => void;
  onClientOpenById?: (clientId: string) => Promise<void>;
  onClientFindSimilar?: (client: Client) => void;
  onClientNormalizeName?: (client: Client, normalizedName: string) => Promise<void>;
  policies: Policy[];
  payments: Payment[];
  financialRecords: FinancialRecord[];
  tasks: Task[];
  users: User[];
  currentUser: User | null;
  selectedDealId: string | null;
  isDealFocusCleared?: boolean;
  dealRowFocusRequest?: { dealId: string; nonce: number } | null;
  dealAccessMessage?: string | null;
  onClearDealAccessMessage?: () => void;
  onSelectDeal: (dealId: string) => void;
  onClearDealFocus?: () => void;
  onCloseDeal: (
    dealId: string,
    payload: { reason: string; status?: 'won' | 'lost' },
  ) => Promise<void>;
  onReopenDeal: (dealId: string) => Promise<void>;
  onUpdateDeal: (dealId: string, data: DealFormValues) => Promise<void>;
  onRefreshDeal?: (dealId: string) => Promise<void>;
  onRefreshDealsList?: () => Promise<void>;
  onPinDeal: (dealId: string) => Promise<void>;
  onUnpinDeal: (dealId: string) => Promise<void>;
  onPostponeDeal?: (dealId: string, data: DealFormValues) => Promise<void>;
  onRequestAddQuote: (dealId: string) => void;
  onRequestEditQuote: (quote: Quote) => void;
  onRequestAddPolicy: (dealId: string) => void;
  onRequestEditPolicy: (policy: Policy) => void;
  onRequestAddClient: () => void;
  pendingDealClient: PreselectedDealClient | null;
  onPendingDealClientConsumed: () => void;
  onDeleteQuote: (dealId: string, quoteId: string) => Promise<void>;
  onDeletePolicy: (policyId: string) => Promise<void>;
  onMovePolicy?: (policyId: string, targetDealId: string) => Promise<void>;
  onUpdatePolicyRenewed?: (policyId: string, isRenewed: boolean) => Promise<void>;
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
  onMarkPaymentPaid?: (paymentId: string, actualDate: string) => Promise<void>;
  onAddFinancialRecord: (values: AddFinancialRecordFormValues) => Promise<void>;
  onMarkFinancialRecordPaid?: (recordId: string, paidDate: string) => Promise<void>;
  onUpdateFinancialRecord: (
    recordId: string,
    values: AddFinancialRecordFormValues,
  ) => Promise<void>;
  onDeleteFinancialRecord: (recordId: string) => Promise<void>;
  onDriveFolderCreated: (dealId: string, folderId: string) => void;
  onCreateDealMailbox: (dealId: string) => Promise<DealMailboxCreateResult>;
  onCheckDealMailbox: (dealId: string) => Promise<DealMailboxSyncResult>;
  onFetchChatMessages: (dealId: string, options?: RequestInit) => Promise<ChatMessage[]>;
  onSendChatMessage: (dealId: string, body: string) => Promise<ChatMessage>;
  onDeleteChatMessage: (messageId: string) => Promise<void>;
  onFetchDealHistory: (
    dealId: string,
    includeDeleted?: boolean,
    options?: RequestInit,
  ) => Promise<ActivityLog[]>;
  onFetchDealEvents: (
    dealId: string,
    includeDeleted?: boolean,
    options?: RequestInit,
  ) => Promise<DealTimelineEvent[]>;
  dealEventsRefreshTokens?: Record<string, number>;
  onCreateDealEvent: (
    dealId: string,
    data: { eventDate: string; reason: string },
  ) => Promise<DealTimelineEvent>;
  onUpdateDealEvent: (
    dealId: string,
    eventId: string,
    data: { eventDate?: string; reason?: string },
  ) => Promise<DealTimelineEvent>;
  onDeleteDealEvent: (dealId: string, eventId: string) => Promise<void>;
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
  isRefreshingDealsList?: boolean;
  isSelectedDealTasksLoading?: boolean;
  isSelectedDealQuotesLoading?: boolean;
  dealSearch: string;
  onDealSearchChange: (value: string) => void;
  onDealSearchSubmit: (value?: string) => void;
  dealExecutorFilter: string;
  onDealExecutorFilterChange: (value: string) => void;
  dealShowDeleted: boolean;
  onDealShowDeletedChange: (value: boolean) => void;
  dealShowClosed: boolean;
  onDealShowClosedChange: (value: boolean) => void;
  dealOrdering?: string;
  onDealOrderingChange: (value: string | undefined) => void;
}

export const DealsView: React.FC<DealsViewProps> = ({
  deals,
  clients,
  clientDuplicateHints,
  onClientEdit,
  onClientOpenById,
  onClientFindSimilar,
  onClientNormalizeName,
  policies,
  payments,
  financialRecords,
  tasks,
  users,
  currentUser,
  selectedDealId,
  isDealFocusCleared = false,
  dealRowFocusRequest,
  dealAccessMessage = null,
  onClearDealAccessMessage,
  onSelectDeal,
  onClearDealFocus,
  onCloseDeal,
  onReopenDeal,
  onUpdateDeal,
  onRefreshDeal,
  onRefreshDealsList,
  onPinDeal,
  onUnpinDeal,
  onPostponeDeal,
  onRequestAddQuote,
  onRequestEditQuote,
  onRequestAddPolicy,
  onRequestEditPolicy,
  onRequestAddClient,
  pendingDealClient,
  onPendingDealClientConsumed,
  onDeleteQuote,
  onDeletePolicy,
  onMovePolicy = async () => undefined,
  onUpdatePolicyRenewed = async () => undefined,
  onRefreshPolicies,
  onPolicyDraftReady,
  onAddPayment,
  onUpdatePayment,
  onDeletePayment,
  onMarkPaymentPaid,
  onAddFinancialRecord,
  onMarkFinancialRecordPaid,
  onUpdateFinancialRecord,
  onDeleteFinancialRecord,
  onDriveFolderCreated,
  onCreateDealMailbox,
  onCheckDealMailbox,
  onFetchChatMessages,
  onSendChatMessage,
  onDeleteChatMessage,
  onFetchDealHistory,
  onFetchDealEvents,
  dealEventsRefreshTokens,
  onCreateDealEvent,
  onUpdateDealEvent,
  onDeleteDealEvent,
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
  isRefreshingDealsList = false,
  isSelectedDealTasksLoading = false,
  isSelectedDealQuotesLoading = false,
  dealSearch,
  onDealSearchChange,
  onDealSearchSubmit,
  dealExecutorFilter,
  onDealExecutorFilterChange,
  dealShowDeleted,
  onDealShowDeletedChange,
  dealShowClosed,
  onDealShowClosedChange,
  dealOrdering,
  onDealOrderingChange,
}) => {
  const [searchParams, setSearchParams] = useSearchParams();
  const requestedTabValue = searchParams.get('tab');
  const requestedTab: DealTabId = isDealTabId(requestedTabValue) ? requestedTabValue : 'overview';
  const { sortedDeals, selectedDeal, selectedClient, sellerUser, executorUser } = useSelectedDeal({
    deals,
    clients,
    users,
    selectedDealId,
    isDealFocusCleared,
  });
  const handleSelectDeal = React.useCallback(
    (dealId: string) => {
      onSelectDeal(dealId);
      setSearchParams((current) => {
        const next = new URLSearchParams(current);
        next.set('dealId', dealId);
        next.delete('tab');
        return next;
      });
    },
    [onSelectDeal, setSearchParams],
  );
  const handleTabChange = React.useCallback(
    (tab: DealTabId) => {
      setSearchParams(
        (current) => {
          const next = new URLSearchParams(current);
          if (tab === 'overview') {
            next.delete('tab');
          } else {
            next.set('tab', tab);
          }
          return next;
        },
        { replace: true, preventScrollReset: true },
      );
    },
    [setSearchParams],
  );

  return (
    <PageShell>
      <PageHeader
        title="Сделки"
        description="Воронка продаж и рабочая карточка выбранной сделки"
        meta={
          <span>
            Загружено: {sortedDeals.length} из {dealsTotalCount}
          </span>
        }
      />
      <section className="app-panel overflow-hidden shadow-none">
        <div className="divide-y divide-[var(--app-border)]">
          <DealsList
            sortedDeals={sortedDeals}
            selectedDeal={selectedDeal}
            dealRowFocusRequest={dealRowFocusRequest}
            dealSearch={dealSearch}
            onDealSearchChange={onDealSearchChange}
            onDealSearchSubmit={onDealSearchSubmit}
            onRefreshDealsList={onRefreshDealsList}
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
            isRefreshingDealsList={isRefreshingDealsList}
            onLoadMoreDeals={onLoadMoreDeals}
            onSelectDeal={(dealId) => {
              onClearDealAccessMessage?.();
              handleSelectDeal(dealId);
            }}
            onPinDeal={onPinDeal}
            onUnpinDeal={onUnpinDeal}
            currentUser={currentUser}
            clients={clients}
            clientDuplicateHints={clientDuplicateHints}
            onClientFindSimilar={onClientFindSimilar}
            onClientNormalizeName={onClientNormalizeName}
          />
          <DealDetailsPanel
            deals={deals}
            clients={clients}
            onClientEdit={onClientEdit}
            onClientOpenById={onClientOpenById}
            policies={policies}
            payments={payments}
            financialRecords={financialRecords}
            tasks={tasks}
            users={users}
            currentUser={currentUser}
            sortedDeals={sortedDeals}
            selectedDeal={selectedDeal}
            selectedClient={selectedClient}
            clientDuplicateHint={
              selectedClient ? clientDuplicateHints[selectedClient.id] : undefined
            }
            sellerUser={sellerUser}
            executorUser={executorUser}
            onClientFindSimilar={onClientFindSimilar}
            onClientNormalizeName={onClientNormalizeName}
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
            pendingDealClient={pendingDealClient}
            onPendingDealClientConsumed={onPendingDealClientConsumed}
            onDeleteQuote={onDeleteQuote}
            onDeletePolicy={onDeletePolicy}
            onMovePolicy={onMovePolicy}
            onUpdatePolicyRenewed={onUpdatePolicyRenewed}
            onRefreshPolicies={onRefreshPolicies}
            onPolicyDraftReady={onPolicyDraftReady}
            onAddPayment={onAddPayment}
            onUpdatePayment={onUpdatePayment}
            onDeletePayment={onDeletePayment}
            onMarkPaymentPaid={onMarkPaymentPaid}
            onAddFinancialRecord={onAddFinancialRecord}
            onMarkFinancialRecordPaid={onMarkFinancialRecordPaid}
            onUpdateFinancialRecord={onUpdateFinancialRecord}
            onDeleteFinancialRecord={onDeleteFinancialRecord}
            onDriveFolderCreated={onDriveFolderCreated}
            onCreateDealMailbox={onCreateDealMailbox}
            onCheckDealMailbox={onCheckDealMailbox}
            onFetchChatMessages={onFetchChatMessages}
            onSendChatMessage={onSendChatMessage}
            onDeleteChatMessage={onDeleteChatMessage}
            onFetchDealHistory={onFetchDealHistory}
            onFetchDealEvents={onFetchDealEvents}
            dealEventsRefreshToken={
              selectedDeal ? (dealEventsRefreshTokens?.[selectedDeal.id] ?? 0) : 0
            }
            onCreateDealEvent={onCreateDealEvent}
            onUpdateDealEvent={onUpdateDealEvent}
            onDeleteDealEvent={onDeleteDealEvent}
            onCreateTask={onCreateTask}
            onUpdateTask={onUpdateTask}
            onDeleteTask={onDeleteTask}
            onDeleteDeal={onDeleteDeal}
            onRestoreDeal={onRestoreDeal}
            onClearDealFocus={onClearDealFocus}
            accessMessage={dealAccessMessage}
            onClearAccessMessage={onClearDealAccessMessage}
            isTasksLoading={isSelectedDealTasksLoading}
            isQuotesLoading={isSelectedDealQuotesLoading}
            requestedTab={requestedTab}
            onTabChange={handleTabChange}
          />
        </div>
      </section>
    </PageShell>
  );
};
