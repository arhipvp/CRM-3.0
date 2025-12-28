import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { DealsView } from '../views/DealsView';
import { ClientsView } from '../views/ClientsView';
import { PoliciesView } from '../views/PoliciesView';
import { TasksView } from '../views/TasksView';
import { SettingsView } from '../views/SettingsView';
import { KnowledgeDocumentsView } from '../views/KnowledgeDocumentsView';
import type {
  ActivityLog,
  ChatMessage,
  Client,
  Deal,
  FinancialRecord,
  Payment,
  Policy,
  Quote,
  Task,
  User,
} from '../../types';
import type { AddFinancialRecordFormValues } from '../../components/forms/AddFinancialRecordForm';
import type { AddPaymentFormValues } from '../../components/forms/AddPaymentForm';
import type { AddTaskFormValues } from '../forms/AddTaskForm';
import type { DealFormValues } from '../../components/forms/DealForm';

export interface AppRoutesProps {
  deals: Deal[];
  clients: Client[];
  onClientEdit: (client: Client) => void;
  onClientDelete: (client: Client) => void;
  onClientMerge: (client: Client) => void;
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
  onPostponeDeal?: (dealId: string, data: DealFormValues) => Promise<void>;
  onRequestAddQuote: (dealId: string) => void;
  onRequestEditQuote: (quote: Quote) => void;
  onRequestAddPolicy: (dealId: string) => void;
  onRequestEditPolicy: (policy: Policy) => void;
  onRequestAddClient: () => void;
  onDeleteQuote: (dealId: string, quoteId: string) => Promise<void>;
  onDeletePolicy: (policyId: string) => Promise<void>;
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
  onMergeDeals: (targetDealId: string, sourceDealIds: string[], resultingClientId?: string | undefined) => Promise<void>;
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
  onPolicyDraftReady?: (
    dealId: string,
    parsed: Record<string, unknown>,
    fileName?: string | null,
    fileId?: string | null
  ) => void;
  onLoadMoreDeals: () => Promise<void>;
  dealsHasMore: boolean;
  isLoadingMoreDeals: boolean;
}

export const AppRoutes: React.FC<AppRoutesProps> = ({
  deals,
  clients,
  onClientEdit,
  onClientDelete,
  onClientMerge,
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
  onPostponeDeal,
  onRequestAddQuote,
  onRequestEditQuote,
  onRequestAddPolicy,
  onRequestEditPolicy,
  onRequestAddClient,
  onDeleteQuote,
  onDeletePolicy,
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
  onPolicyDraftReady,
  onLoadMoreDeals,
  dealsHasMore,
  isLoadingMoreDeals,
}) => (
  <Routes>
    <Route
      path="/deals"
      element={
          <DealsView
            deals={deals}
            clients={clients}
            onClientEdit={onClientEdit}
          policies={policies}
          payments={payments}
          financialRecords={financialRecords}
          tasks={tasks}
          users={users}
          currentUser={currentUser}
          selectedDealId={selectedDealId}
          onSelectDeal={onSelectDeal}
          onCloseDeal={onCloseDeal}
          onReopenDeal={onReopenDeal}
          onUpdateDeal={onUpdateDeal}
          onPostponeDeal={onPostponeDeal}
          onRequestAddQuote={onRequestAddQuote}
          onRequestEditQuote={onRequestEditQuote}
          onRequestAddPolicy={onRequestAddPolicy}
          onRequestEditPolicy={onRequestEditPolicy}
          onDeleteQuote={onDeleteQuote}
          onDeletePolicy={onDeletePolicy}
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
            onMergeDeals={onMergeDeals}
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
            onRequestAddClient={onRequestAddClient}
            onPolicyDraftReady={onPolicyDraftReady}
            onLoadMoreDeals={onLoadMoreDeals}
            dealsHasMore={dealsHasMore}
            isLoadingMoreDeals={isLoadingMoreDeals}
          />
      }
    />
    <Route
      path="/clients"
      element={
        <ClientsView
          clients={clients}
          deals={deals}
          onClientEdit={onClientEdit}
          onClientDelete={onClientDelete}
          onClientMerge={onClientMerge}
        />
      }
    />
    <Route
      path="/policies"
      element={
        <PoliciesView
          policies={policies}
          clients={clients}
          payments={payments}
          onDealSelect={onSelectDeal}
          onClientEdit={onClientEdit}
          onRequestEditPolicy={onRequestEditPolicy}
          onAddFinancialRecord={onAddFinancialRecord}
          onUpdateFinancialRecord={onUpdateFinancialRecord}
          onDeleteFinancialRecord={onDeleteFinancialRecord}
        />
      }
    />
    <Route path="/payments" element={<Navigate to="/policies" replace />} />
    <Route
      path="/tasks"
      element={
        <TasksView tasks={tasks} currentUser={currentUser} onDealSelect={onSelectDeal} />
      }
    />
    <Route
      path="/knowledge"
      element={<KnowledgeDocumentsView />}
    />
    <Route path="/settings" element={<SettingsView />} />
    <Route path="*" element={<Navigate to="/deals" replace />} />
  </Routes>
);
