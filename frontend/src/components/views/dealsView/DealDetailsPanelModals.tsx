import React from 'react';

import type { Client, Deal, FinancialRecord, Payment, Policy, Task, User } from '../../../types';
import type { AddFinancialRecordFormValues } from '../../forms/AddFinancialRecordForm';
import type { AddPaymentFormValues } from '../../forms/AddPaymentForm';
import { AddTaskForm } from '../../forms/AddTaskForm';
import type { AddTaskFormValues } from '../../forms/AddTaskForm';
import { DealForm } from '../../forms/DealForm';
import type { DealFormValues } from '../../forms/DealForm';
import { FinancialRecordModal } from '../../financialRecords/FinancialRecordModal';
import { Modal } from '../../Modal';
import { PaymentModal } from '../../payments/PaymentModal';
import { PromptDialog } from '../../common/modal/PromptDialog';
import { BTN_SECONDARY } from '../../common/buttonStyles';
import { DealDelayModal, DealMergeModal, DealSimilarModal } from './DealDetailsModals';
import type { DealEvent } from './eventUtils';

const DEAL_CHILD_MODAL_Z_INDEX = 70;

interface DealDetailsPanelModalsProps {
  clients: Client[];
  users: User[];
  selectedDeal: Deal | null;
  relatedPolicies: Policy[];
  selectedClientDisplayName: string;
  pendingDealClientId?: string | null;
  onPendingDealClientConsumed?: () => void;
  onRequestAddClient: () => void;
  onUpdateDeal: (dealId: string, data: DealFormValues) => Promise<void>;
  onCreateTask: (dealId: string, data: AddTaskFormValues) => Promise<void>;
  onUpdateTask: (taskId: string, data: Partial<AddTaskFormValues>) => Promise<void>;
  onAddPayment: (values: AddPaymentFormValues) => Promise<void>;
  onUpdatePayment: (paymentId: string, values: AddPaymentFormValues) => Promise<void>;
  onAddFinancialRecord: (values: AddFinancialRecordFormValues) => Promise<void>;
  onUpdateFinancialRecord: (
    recordId: string,
    values: AddFinancialRecordFormValues,
  ) => Promise<void>;
  isEditingDeal: boolean;
  setIsEditingDeal: (value: boolean) => void;
  isCreatingTask: boolean;
  setIsCreatingTask: (value: boolean) => void;
  editingTaskId: string | null;
  editingTask: Task | null;
  setEditingTaskId: (value: string | null) => void;
  isPaymentModalOpen: boolean;
  editingPaymentId: string | null;
  editingPayment?: Payment;
  paymentFixedPolicyId?: string;
  closePaymentModal: () => void;
  isFinancialRecordModalOpen: boolean;
  editingFinancialRecordId: string | null;
  editingFinancialRecord?: FinancialRecord;
  financialRecordPaymentId: string;
  financialRecordDefaultRecordType?: 'income' | 'expense';
  closeFinancialRecordModal: () => void;
  isDelayModalOpen: boolean;
  setIsDelayModalOpen: (value: boolean) => void;
  selectedDelayEvent: DealEvent | null;
  selectedEventNextContact: string | null;
  nextContactValue: string | null;
  upcomingEvents: DealEvent[];
  pastEvents: DealEvent[];
  isSchedulingDelay: boolean;
  isLeadDaysLoading: boolean;
  validationError: string | null;
  onEventSelect: (value: string | null) => void;
  onNextContactChange: (value: string | null) => void;
  onConfirmDelay: () => Promise<void>;
  isMergeModalOpen: boolean;
  mergeSearch: string;
  setMergeSearch: (value: string) => void;
  mergeList: Deal[];
  mergeSources: string[];
  toggleMergeSource: (dealId: string) => void;
  mergeError: string | null;
  mergePreviewWarnings: string[];
  mergeStep: 'select' | 'preview';
  setMergeStep: (value: 'select' | 'preview') => void;
  mergeFinalDraft: DealFormValues | null;
  requestMergePreview: () => void;
  isMergePreviewLoading: boolean;
  isMergePreviewConfirmed: boolean;
  isMergeSearchLoading: boolean;
  isMergeSearchActive: boolean;
  mergeQuery: string;
  isMerging: boolean;
  closeMergeModal: () => void;
  handleMergeSubmit: (payload: DealFormValues) => Promise<void>;
  isSimilarModalOpen: boolean;
  similarCandidates: React.ComponentProps<typeof DealSimilarModal>['candidates'];
  selectedSimilarIds: string[];
  similarIncludeClosed: boolean;
  isSimilarLoading: boolean;
  similarError: string | null;
  setSimilarIncludeClosed: (value: boolean) => void;
  toggleSimilarCandidate: (dealId: string) => void;
  continueFromSimilarToMerge: () => Promise<void>;
  closeSimilarModal: () => void;
  isCloseDealPromptOpen: boolean;
  setIsCloseDealPromptOpen: (value: boolean) => void;
  closeDealReason: string;
  setCloseDealReason: (value: string) => void;
  closeDealReasonError: string | null;
  handleCloseDealConfirm: () => Promise<void>;
  isClosingDeal: boolean;
  quickInlineDateOptions: Array<{ label: string; days: number }>;
  handleQuickNextContactShift: (value: string) => Promise<void>;
}

export const DealDetailsPanelModals: React.FC<DealDetailsPanelModalsProps> = ({
  clients,
  users,
  selectedDeal,
  relatedPolicies,
  selectedClientDisplayName,
  pendingDealClientId,
  onPendingDealClientConsumed,
  onRequestAddClient,
  onUpdateDeal,
  onCreateTask,
  onUpdateTask,
  onAddPayment,
  onUpdatePayment,
  onAddFinancialRecord,
  onUpdateFinancialRecord,
  isEditingDeal,
  setIsEditingDeal,
  isCreatingTask,
  setIsCreatingTask,
  editingTaskId,
  editingTask,
  setEditingTaskId,
  isPaymentModalOpen,
  editingPaymentId,
  editingPayment,
  paymentFixedPolicyId,
  closePaymentModal,
  isFinancialRecordModalOpen,
  editingFinancialRecordId,
  editingFinancialRecord,
  financialRecordPaymentId,
  financialRecordDefaultRecordType,
  closeFinancialRecordModal,
  isDelayModalOpen,
  setIsDelayModalOpen,
  selectedDelayEvent,
  selectedEventNextContact,
  nextContactValue,
  upcomingEvents,
  pastEvents,
  isSchedulingDelay,
  isLeadDaysLoading,
  validationError,
  onEventSelect,
  onNextContactChange,
  onConfirmDelay,
  isMergeModalOpen,
  mergeSearch,
  setMergeSearch,
  mergeList,
  mergeSources,
  toggleMergeSource,
  mergeError,
  mergePreviewWarnings,
  mergeStep,
  setMergeStep,
  mergeFinalDraft,
  requestMergePreview,
  isMergePreviewLoading,
  isMergePreviewConfirmed,
  isMergeSearchLoading,
  isMergeSearchActive,
  mergeQuery,
  isMerging,
  closeMergeModal,
  handleMergeSubmit,
  isSimilarModalOpen,
  similarCandidates,
  selectedSimilarIds,
  similarIncludeClosed,
  isSimilarLoading,
  similarError,
  setSimilarIncludeClosed,
  toggleSimilarCandidate,
  continueFromSimilarToMerge,
  closeSimilarModal,
  isCloseDealPromptOpen,
  setIsCloseDealPromptOpen,
  closeDealReason,
  setCloseDealReason,
  closeDealReasonError,
  handleCloseDealConfirm,
  isClosingDeal,
  quickInlineDateOptions,
  handleQuickNextContactShift,
}) => (
  <>
    {isEditingDeal && selectedDeal && (
      <Modal
        title="Редактировать сделку"
        onClose={() => setIsEditingDeal(false)}
        size="sm"
        zIndex={DEAL_CHILD_MODAL_Z_INDEX}
        closeOnOverlayClick={false}
      >
        <div className="space-y-3">
          <DealForm
            key={selectedDeal.id}
            clients={clients}
            users={users}
            initialValues={{
              title: selectedDeal.title,
              description: selectedDeal.description ?? '',
              clientId: selectedDeal.clientId,
              executorId: selectedDeal.executor ?? null,
              sellerId: selectedDeal.seller ?? null,
              source: selectedDeal.source ?? '',
              nextContactDate: selectedDeal.nextContactDate ?? null,
              expectedClose: selectedDeal.expectedClose ?? null,
              visibleUserIds: selectedDeal.visibleUsers ?? [],
            }}
            mode="edit"
            showSellerField
            showNextContactField
            quickNextContactOptions={quickInlineDateOptions}
            onQuickNextContactShift={handleQuickNextContactShift}
            onRequestAddClient={onRequestAddClient}
            preselectedClientId={pendingDealClientId}
            onPreselectedClientConsumed={onPendingDealClientConsumed}
            onSubmit={async (data) => {
              await onUpdateDeal(selectedDeal.id, data);
              setIsEditingDeal(false);
            }}
          />
          <button
            type="button"
            onClick={() => setIsEditingDeal(false)}
            className={`${BTN_SECONDARY} w-full`}
          >
            Отмена
          </button>
        </div>
      </Modal>
    )}
    {isCreatingTask && selectedDeal && (
      <Modal
        title="Новая задача"
        onClose={() => setIsCreatingTask(false)}
        size="sm"
        zIndex={DEAL_CHILD_MODAL_Z_INDEX}
        closeOnOverlayClick={false}
      >
        <AddTaskForm
          dealId={selectedDeal.id}
          users={users}
          defaultAssigneeId={selectedDeal.executor ?? null}
          onSubmit={async (data) => {
            await onCreateTask(selectedDeal.id, data);
            setIsCreatingTask(false);
          }}
          onCancel={() => setIsCreatingTask(false)}
        />
      </Modal>
    )}
    {editingTaskId && selectedDeal && editingTask && (
      <Modal
        title="Редактировать задачу"
        onClose={() => setEditingTaskId(null)}
        size="sm"
        zIndex={DEAL_CHILD_MODAL_Z_INDEX}
        closeOnOverlayClick={false}
      >
        <AddTaskForm
          dealId={selectedDeal.id}
          task={editingTask}
          users={users}
          defaultAssigneeId={selectedDeal.executor ?? null}
          onSubmit={async (data) => {
            await onUpdateTask(editingTaskId, data);
            setEditingTaskId(null);
          }}
          onCancel={() => setEditingTaskId(null)}
        />
      </Modal>
    )}
    {isPaymentModalOpen && selectedDeal && (
      <PaymentModal
        isOpen
        title={editingPaymentId === 'new' ? 'Создать платеж' : 'Редактировать платеж'}
        payment={editingPayment}
        dealId={selectedDeal.id}
        dealTitle={selectedDeal.title}
        policies={relatedPolicies}
        fixedPolicyId={paymentFixedPolicyId}
        zIndex={DEAL_CHILD_MODAL_Z_INDEX}
        onClose={closePaymentModal}
        onSubmit={async (data) => {
          if (editingPaymentId === 'new') {
            await onAddPayment(data);
          } else if (editingPaymentId) {
            await onUpdatePayment(editingPaymentId, data);
          }
          closePaymentModal();
        }}
      />
    )}
    {isFinancialRecordModalOpen && selectedDeal && (
      <FinancialRecordModal
        isOpen
        title={editingFinancialRecordId ? 'Редактировать запись' : 'Новая финансовая запись'}
        onClose={closeFinancialRecordModal}
        paymentId={financialRecordPaymentId}
        defaultRecordType={financialRecordDefaultRecordType}
        record={editingFinancialRecord}
        zIndex={DEAL_CHILD_MODAL_Z_INDEX}
        onSubmit={async (data) => {
          if (editingFinancialRecordId) {
            await onUpdateFinancialRecord(editingFinancialRecordId, data);
          } else {
            await onAddFinancialRecord(data);
          }
          closeFinancialRecordModal();
        }}
      />
    )}
    {isDelayModalOpen && selectedDeal && (
      <DealDelayModal
        deal={selectedDeal}
        selectedEvent={selectedDelayEvent}
        selectedEventNextContact={selectedEventNextContact}
        nextContactValue={nextContactValue}
        upcomingEvents={upcomingEvents}
        pastEvents={pastEvents}
        isSchedulingDelay={isSchedulingDelay}
        isLeadDaysLoading={isLeadDaysLoading}
        validationError={validationError}
        zIndex={DEAL_CHILD_MODAL_Z_INDEX}
        onClose={() => setIsDelayModalOpen(false)}
        onEventSelect={onEventSelect}
        onNextContactChange={onNextContactChange}
        onConfirm={onConfirmDelay}
      />
    )}
    {isMergeModalOpen && selectedDeal && (
      <DealMergeModal
        targetDeal={selectedDeal}
        selectedClientName={selectedClientDisplayName}
        clients={clients}
        users={users}
        mergeSearch={mergeSearch}
        onMergeSearchChange={setMergeSearch}
        mergeList={mergeList}
        mergeSources={mergeSources}
        toggleMergeSource={toggleMergeSource}
        mergeError={mergeError}
        mergePreviewWarnings={mergePreviewWarnings}
        mergeStep={mergeStep}
        onBackToSelection={() => setMergeStep('select')}
        mergeFinalDraft={mergeFinalDraft}
        onPreview={requestMergePreview}
        isPreviewLoading={isMergePreviewLoading}
        isPreviewConfirmed={isMergePreviewConfirmed}
        isLoading={isMergeSearchLoading}
        isActiveSearch={isMergeSearchActive}
        searchQuery={mergeQuery}
        isMerging={isMerging}
        onClose={closeMergeModal}
        onSubmit={handleMergeSubmit}
        onRequestAddClient={onRequestAddClient}
        zIndex={DEAL_CHILD_MODAL_Z_INDEX}
      />
    )}
    {isSimilarModalOpen && selectedDeal && (
      <DealSimilarModal
        targetDeal={selectedDeal}
        candidates={similarCandidates}
        selectedIds={selectedSimilarIds}
        includeClosed={similarIncludeClosed}
        isLoading={isSimilarLoading}
        error={similarError}
        onToggleIncludeClosed={setSimilarIncludeClosed}
        onToggleCandidate={toggleSimilarCandidate}
        onContinue={() => {
          void continueFromSimilarToMerge();
        }}
        onClose={closeSimilarModal}
        zIndex={DEAL_CHILD_MODAL_Z_INDEX}
      />
    )}
    <PromptDialog
      isOpen={isCloseDealPromptOpen}
      title="Закрыть сделку"
      label="Причина закрытия"
      value={closeDealReason}
      onChange={setCloseDealReason}
      error={closeDealReasonError}
      confirmLabel={isClosingDeal ? 'Закрытие...' : 'Закрыть сделку'}
      isSubmitting={isClosingDeal}
      zIndex={DEAL_CHILD_MODAL_Z_INDEX}
      onConfirm={handleCloseDealConfirm}
      onCancel={() => setIsCloseDealPromptOpen(false)}
    />
  </>
);
