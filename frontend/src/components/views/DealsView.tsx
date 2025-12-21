import React from 'react';

import { ActivityLog, ChatMessage, Deal, Client, FinancialRecord, Payment, Policy, Quote, Task, User } from '../../types';
import type { AddFinancialRecordFormValues } from '../forms/AddFinancialRecordForm';
import type { AddPaymentFormValues } from '../forms/AddPaymentForm';
import type { AddTaskFormValues } from '../forms/AddTaskForm';
import type { DealFormValues } from '../forms/DealForm';
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
  onSelectDeal: (dealId: string) => void;
  onCloseDeal: (dealId: string, payload: { reason: string; status?: 'won' | 'lost' }) => Promise<void>;
  onReopenDeal: (dealId: string) => Promise<void>;
  onUpdateDeal: (dealId: string, data: DealFormValues) => Promise<void>;
  onRequestAddQuote: (dealId: string) => void;
  onRequestEditQuote: (quote: Quote) => void;
  onRequestAddPolicy: (dealId: string) => void;
  onRequestEditPolicy: (policy: Policy) => void;
  onRequestAddClient: () => void;
  onDeleteQuote: (dealId: string, quoteId: string) => Promise<void>;
  onDeletePolicy: (policyId: string) => Promise<void>;
  onRefreshPolicies?: () => Promise<void>;
  onPolicyDraftReady?: (
    dealId: string,
    parsed: Record<string, unknown>,
    fileName?: string | null,
    fileId?: string | null
  ) => void;
  onAddPayment: (values: AddPaymentFormValues) => Promise<void>;
  onUpdatePayment: (paymentId: string, values: AddPaymentFormValues) => Promise<void>;
  onAddFinancialRecord: (values: AddFinancialRecordFormValues) => Promise<void>;
  onUpdateFinancialRecord: (recordId: string, values: AddFinancialRecordFormValues) => Promise<void>;
  onDeleteFinancialRecord: (recordId: string) => Promise<void>;
  onDriveFolderCreated: (dealId: string, folderId: string) => void;
  onFetchChatMessages: (dealId: string) => Promise<ChatMessage[]>;
  onSendChatMessage: (dealId: string, body: string) => Promise<ChatMessage>;
  onDeleteChatMessage: (messageId: string) => Promise<void>;
  onFetchDealHistory: (dealId: string, includeDeleted?: boolean) => Promise<ActivityLog[]>;
  onCreateTask: (dealId: string, data: AddTaskFormValues) => Promise<void>;
  onUpdateTask: (taskId: string, data: Partial<AddTaskFormValues>) => Promise<void>;
  onDeleteTask: (taskId: string) => Promise<void>;
  onDeleteDeal: (dealId: string) => Promise<void>;
  onRestoreDeal: (dealId: string) => Promise<void>;
  onMergeDeals: (targetDealId: string, sourceDealIds: string[], resultingClientId?: string) => Promise<void>;
  onLoadMoreDeals: () => Promise<void>;
  dealsHasMore: boolean;
  isLoadingMoreDeals: boolean;
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
  onSelectDeal,
  onCloseDeal,
  onReopenDeal,
  onUpdateDeal,
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
  onAddFinancialRecord,
  onUpdateFinancialRecord,
  onDeleteFinancialRecord,
  onDriveFolderCreated,
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
  isLoadingMoreDeals,
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
}) => {
  const { sortedDeals, selectedDeal, selectedClient, sellerUser, executorUser } = useSelectedDeal({
    deals,
    clients,
    users,
    selectedDealId,
  });

  return (
    <div className="flex h-full flex-col gap-6">
      <section className="app-panel overflow-hidden">
        <div className="divide-y divide-slate-200">
          <DealsList
            sortedDeals={sortedDeals}
            selectedDeal={selectedDeal}
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
            isLoadingMoreDeals={isLoadingMoreDeals}
            onLoadMoreDeals={onLoadMoreDeals}
            onSelectDeal={onSelectDeal}
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
            onSelectDeal={onSelectDeal}
            onCloseDeal={onCloseDeal}
            onReopenDeal={onReopenDeal}
            onUpdateDeal={onUpdateDeal}
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
            onAddFinancialRecord={onAddFinancialRecord}
            onUpdateFinancialRecord={onUpdateFinancialRecord}
            onDeleteFinancialRecord={onDeleteFinancialRecord}
            onDriveFolderCreated={onDriveFolderCreated}
            onFetchChatMessages={onFetchChatMessages}
            onSendChatMessage={onSendChatMessage}
            onDeleteChatMessage={onDeleteChatMessage}
            onFetchDealHistory={onFetchDealHistory}
            onCreateTask={onCreateTask}
            onUpdateTask={onUpdateTask}
            onDeleteTask={onDeleteTask}
            onDeleteDeal={onDeleteDeal}
            onRestoreDeal={onRestoreDeal}
          />
        </div>
      </section>
    </div>
  );
};
