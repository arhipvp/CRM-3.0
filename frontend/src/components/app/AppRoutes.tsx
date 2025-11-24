import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { DealsView } from '../views/DealsView';
import { ClientsView } from '../views/ClientsView';
import { PoliciesView } from '../views/PoliciesView';
import { PaymentsView } from '../views/PaymentsView';
import { FinanceView } from '../views/FinanceView';
import { TasksView } from '../views/TasksView';
import { SettingsView } from '../views/SettingsView';
import { KnowledgeDocumentsView } from '../views/KnowledgeDocumentsView';
import type {
  ActivityLog,
  ChatMessage,
  Client,
  Deal,
  DealStatus,
  FinancialRecord,
  KnowledgeDocument,
  Payment,
  Policy,
  Quote,
  Task,
  User,
} from '../../types';
import type { AddFinancialRecordFormValues } from '../../components/forms/AddFinancialRecordForm';
import type { AddPaymentFormValues } from '../../components/forms/AddPaymentForm';
import type { AddTaskFormValues } from '../forms/AddTaskForm';
import type { EditDealFormValues } from '../../components/forms/EditDealForm';

export interface AppRoutesProps {
  deals: Deal[];
  clients: Client[];
  policies: Policy[];
  payments: Payment[];
  financialRecords: FinancialRecord[];
  tasks: Task[];
  users: User[];
  currentUser: User | null;
  selectedDealId: string | null;
  onSelectDeal: (dealId: string) => void;
  onUpdateStatus: (dealId: string, status: DealStatus) => Promise<void>;
  onUpdateDeal: (dealId: string, data: EditDealFormValues) => Promise<void>;
  onRequestAddQuote: (dealId: string) => void;
  onRequestEditQuote: (quote: Quote) => void;
  onRequestAddPolicy: (dealId: string) => void;
  onClientEdit: (client: Client) => void;
  onDeleteQuote: (dealId: string, quoteId: string) => Promise<void>;
  onDeletePolicy: (policyId: string) => Promise<void>;
  onAddPayment: (values: AddPaymentFormValues) => Promise<void>;
  onUpdatePayment: (paymentId: string, values: AddPaymentFormValues) => Promise<void>;
  onAddFinancialRecord: (values: AddFinancialRecordFormValues) => Promise<void>;
  onUpdateFinancialRecord: (recordId: string, values: AddFinancialRecordFormValues) => Promise<void>;
  onDeleteFinancialRecord: (recordId: string) => Promise<void>;
  onDriveFolderCreated: (dealId: string, folderId: string) => void;
  onFetchChatMessages: (dealId: string) => Promise<ChatMessage[]>;
  onSendChatMessage: (dealId: string, body: string) => Promise<void>;
  onDeleteChatMessage: (messageId: string) => Promise<void>;
  onFetchDealHistory: (dealId: string, includeDeleted?: boolean) => Promise<ActivityLog[]>;
  onCreateTask: (dealId: string, data: AddTaskFormValues) => Promise<void>;
  onUpdateTask: (taskId: string, data: Partial<AddTaskFormValues>) => Promise<void>;
  onDeleteTask: (taskId: string) => Promise<void>;
  onDeleteDeal: (dealId: string) => Promise<void>;
  onRestoreDeal: (dealId: string) => Promise<void>;
  dealSearch: string;
  onDealSearchChange: (value: string) => void;
  dealExecutorFilter: string;
  onDealExecutorFilterChange: (value: string) => void;
  dealSourceFilter: string;
  onDealSourceFilterChange: (value: string) => void;
  dealExpectedCloseFrom: string;
  onDealExpectedCloseFromChange: (value: string) => void;
  dealExpectedCloseTo: string;
  onDealExpectedCloseToChange: (value: string) => void;
  dealShowDeleted: boolean;
  onDealShowDeletedChange: (value: boolean) => void;
  onPolicyDraftReady?: (
    dealId: string,
    parsed: Record<string, unknown>,
    fileName?: string | null
  ) => void;
  handleMarkPayment: (paymentId: string) => Promise<void>;
  knowledgeDocs: KnowledgeDocument[];
  knowledgeLoading: boolean;
  knowledgeUploading: boolean;
  knowledgeError: string | null;
  handleKnowledgeUpload: (
    file: File,
    metadata: { title?: string; description?: string }
  ) => Promise<void>;
}

export const AppRoutes: React.FC<AppRoutesProps> = ({
  deals,
  clients,
  policies,
  payments,
  financialRecords,
  tasks,
  users,
  currentUser,
  selectedDealId,
  onSelectDeal,
  onUpdateStatus,
  onUpdateDeal,
  onRequestAddQuote,
  onRequestEditQuote,
  onRequestAddPolicy,
  onClientEdit,
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
  dealSearch,
  onDealSearchChange,
  dealExecutorFilter,
  onDealExecutorFilterChange,
  dealSourceFilter,
  onDealSourceFilterChange,
  dealExpectedCloseFrom,
  onDealExpectedCloseFromChange,
  dealExpectedCloseTo,
  onDealExpectedCloseToChange,
  dealShowDeleted,
  onDealShowDeletedChange,
  onPolicyDraftReady,
  handleMarkPayment,
  knowledgeDocs,
  knowledgeLoading,
  knowledgeUploading,
  knowledgeError,
  handleKnowledgeUpload,
}) => (
  <Routes>
    <Route
      path="/deals"
      element={
        <DealsView
          deals={deals}
          clients={clients}
          policies={policies}
          payments={payments}
          financialRecords={financialRecords}
          tasks={tasks}
          users={users}
          currentUser={currentUser as User}
          selectedDealId={selectedDealId}
          onSelectDeal={onSelectDeal}
          onUpdateStatus={onUpdateStatus}
          onUpdateDeal={onUpdateDeal}
          onRequestAddQuote={onRequestAddQuote}
          onRequestEditQuote={onRequestEditQuote}
          onRequestAddPolicy={onRequestAddPolicy}
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
          dealSearch={dealSearch}
          onDealSearchChange={onDealSearchChange}
          dealExecutorFilter={dealExecutorFilter}
          onDealExecutorFilterChange={onDealExecutorFilterChange}
          dealSourceFilter={dealSourceFilter}
          onDealSourceFilterChange={onDealSourceFilterChange}
          dealExpectedCloseFrom={dealExpectedCloseFrom}
          onDealExpectedCloseFromChange={onDealExpectedCloseFromChange}
          dealExpectedCloseTo={dealExpectedCloseTo}
          onDealExpectedCloseToChange={onDealExpectedCloseToChange}
          dealShowDeleted={dealShowDeleted}
          onDealShowDeletedChange={onDealShowDeletedChange}
          onPolicyDraftReady={onPolicyDraftReady}
        />
      }
    />
    <Route
      path="/clients"
      element={<ClientsView clients={clients} deals={deals} onClientEdit={onClientEdit} />}
    />
    <Route path="/policies" element={<PoliciesView policies={policies} deals={deals} />} />
    <Route
      path="/payments"
      element={<PaymentsView payments={payments} deals={deals} onMarkPaid={handleMarkPayment} />}
    />
    <Route path="/finance" element={<FinanceView financialRecords={financialRecords} payments={payments} />} />
    <Route path="/tasks" element={<TasksView tasks={tasks} deals={deals} />} />
    <Route
      path="/knowledge"
      element={
        <KnowledgeDocumentsView
          documents={knowledgeDocs}
          isLoading={knowledgeLoading}
          disabled={knowledgeUploading}
          error={knowledgeError}
          onUpload={handleKnowledgeUpload}
        />
      }
    />
    <Route path="/settings" element={<SettingsView />} />
    <Route path="*" element={<Navigate to="/deals" replace />} />
  </Routes>
);
