import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { DealsView } from '../views/DealsView';
import { ClientsView } from '../views/ClientsView';
import { PoliciesView } from '../views/PoliciesView';
import { CommissionsView } from '../views/CommissionsView';
import { TasksView } from '../views/TasksView';
import { SettingsView } from '../views/SettingsView';
import { SellerDashboardView } from '../views/SellerDashboardView';
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
import type { FilterParams } from '../../api';
import type { DealMailboxCreateResult, DealMailboxSyncResult } from '../../api/deals';
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
  onClientFindSimilar: (client: Client) => void;
  policies: Policy[];
  policiesList: Policy[];
  payments: Payment[];
  financialRecords: FinancialRecord[];
  statements: Statement[];
  tasks: Task[];
  users: User[];
  currentUser: User | null;
  selectedDealId: string | null;
  isDealFocusCleared?: boolean;
  dealRowFocusRequest?: { dealId: string; nonce: number } | null;
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
  onDeleteQuote: (dealId: string, quoteId: string) => Promise<void>;
  onDeletePolicy: (policyId: string) => Promise<void>;
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
  onPolicyDraftReady?: (
    dealId: string,
    parsed: Record<string, unknown>,
    fileName?: string | null,
    fileId?: string | null,
  ) => void;
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
}

export const AppRoutes: React.FC<AppRoutesProps> = ({
  deals,
  clients,
  onClientEdit,
  onClientDelete,
  onClientMerge,
  onClientFindSimilar,
  policies,
  policiesList,
  payments,
  financialRecords,
  statements,
  tasks,
  users,
  currentUser,
  selectedDealId,
  isDealFocusCleared,
  dealRowFocusRequest,
  onSelectDeal,
  onClearDealFocus,
  onDealPreview,
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
  onAddPayment,
  onUpdatePayment,
  onDeletePayment,
  onAddFinancialRecord,
  onUpdateFinancialRecord,
  onDeleteFinancialRecord,
  onCreateFinanceStatement,
  onDeleteFinanceStatement,
  onRemoveFinanceStatementRecords,
  onUpdateFinanceStatement,
  onDriveFolderCreated,
  onCreateDealMailbox,
  onCheckDealMailbox,
  onFetchChatMessages,
  onSendChatMessage,
  onDeleteChatMessage,
  onFetchDealHistory,
  onCreateTask,
  onUpdateTask,
  onRefreshPolicies,
  onDeleteTask,
  onRefreshPoliciesList,
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
  onDealSelectionBlockedChange,
  onPolicyDraftReady,
  onLoadMoreDeals,
  dealsHasMore,
  dealsTotalCount,
  isLoadingMoreDeals,
  onLoadMorePolicies,
  policiesHasMore,
  isLoadingMorePolicies,
  isPoliciesListLoading,
  isFinanceDataLoading,
  isTasksLoading,
}) => (
  <Routes>
    <Route path="/seller-dashboard" element={<SellerDashboardView />} />
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
          isDealFocusCleared={isDealFocusCleared}
          dealRowFocusRequest={dealRowFocusRequest}
          onSelectDeal={onSelectDeal}
          onClearDealFocus={onClearDealFocus}
          onCloseDeal={onCloseDeal}
          onReopenDeal={onReopenDeal}
          onUpdateDeal={onUpdateDeal}
          onRefreshDeal={onRefreshDeal}
          onPinDeal={onPinDeal}
          onUnpinDeal={onUnpinDeal}
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
          onDeletePayment={onDeletePayment}
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
          onDealSelectionBlockedChange={onDealSelectionBlockedChange}
          onRequestAddClient={onRequestAddClient}
          onPolicyDraftReady={onPolicyDraftReady}
          onRefreshPolicies={onRefreshPolicies}
          onLoadMoreDeals={onLoadMoreDeals}
          dealsHasMore={dealsHasMore}
          dealsTotalCount={dealsTotalCount}
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
          onClientFindSimilar={onClientFindSimilar}
        />
      }
    />
    <Route
      path="/policies"
      element={
        <PoliciesView
          policies={policiesList}
          clients={clients}
          payments={payments}
          onDealSelect={onSelectDeal}
          onDealPreview={onDealPreview}
          onClientEdit={onClientEdit}
          onRequestEditPolicy={onRequestEditPolicy}
          onAddFinancialRecord={onAddFinancialRecord}
          onUpdateFinancialRecord={onUpdateFinancialRecord}
          onDeleteFinancialRecord={onDeleteFinancialRecord}
          onDeletePayment={onDeletePayment}
          onRefreshPoliciesList={onRefreshPoliciesList}
          onLoadMorePolicies={onLoadMorePolicies}
          policiesHasMore={policiesHasMore}
          isLoadingMorePolicies={isLoadingMorePolicies}
          isPoliciesLoading={isPoliciesListLoading}
        />
      }
    />
    <Route
      path="/commissions"
      element={
        <CommissionsView
          payments={payments}
          financialRecords={financialRecords}
          policies={policies}
          statements={statements}
          isLoading={isFinanceDataLoading}
          onDealSelect={onSelectDeal}
          onDealPreview={onDealPreview}
          onRequestEditPolicy={onRequestEditPolicy}
          onUpdateFinancialRecord={onUpdateFinancialRecord}
          onCreateStatement={onCreateFinanceStatement}
          onDeleteStatement={onDeleteFinanceStatement}
          onUpdateStatement={onUpdateFinanceStatement}
          onRemoveStatementRecords={onRemoveFinanceStatementRecords}
        />
      }
    />
    <Route path="/payments" element={<Navigate to="/commissions" replace />} />
    <Route
      path="/tasks"
      element={
        <TasksView
          tasks={tasks}
          currentUser={currentUser}
          isLoading={isTasksLoading}
          onDealSelect={onSelectDeal}
          onDealPreview={onDealPreview}
        />
      }
    />
    <Route path="/settings" element={<SettingsView />} />
    <Route path="*" element={<Navigate to="/deals" replace />} />
  </Routes>
);
