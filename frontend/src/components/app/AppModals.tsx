import React from 'react';
import { ClientForm } from '../forms/ClientForm';
import { DealForm } from '../forms/DealForm';
import type { DealFormValues } from '../forms/DealForm';
import { AddQuoteForm, QuoteFormValues } from '../forms/AddQuoteForm';
import { AddPolicyForm } from '../forms/AddPolicyForm';
import type { AddPaymentFormValues } from '../forms/AddPaymentForm';
import { AddFinancialRecordFormValues } from '../forms/AddFinancialRecordForm';
import type {
  Client,
  FinancialRecord,
  FinancialRecordModalState,
  Payment,
  PaymentModalState,
  Policy,
  Quote,
  SalesChannel,
  User,
} from '../../types';
import type { ModalType } from './types';
import type { PolicyFormValues } from '../forms/addPolicy/types';
import { FinancialRecordModal } from '../financialRecords/FinancialRecordModal';
import { PaymentModal } from '../payments/PaymentModal';
import { FormModal } from '../common/modal/FormModal';
import { buildPolicyFormValues } from './policyFormValues';

const APP_OVERLAY_MODAL_Z_INDEX = 70;

interface PolicyPrefill {
  values: PolicyFormValues;
  insuranceCompanyName?: string;
  insuranceTypeName?: string;
}

interface AppModalsProps {
  modal: ModalType;
  setModal: React.Dispatch<React.SetStateAction<ModalType>>;
  clients: Client[];
  policies?: Policy[];
  users: User[];
  openClientModal: (afterModal?: ModalType | null) => void;
  closeClientModal: () => void;
  isClientModalOverlayOpen: boolean;
  handleAddClient: (data: {
    name: string;
    isCounterparty?: boolean;
    phone?: string;
    birthDate?: string | null;
    notes?: string | null;
    email?: string | null;
  }) => Promise<void>;
  handleAddDeal: (data: DealFormValues) => Promise<void>;
  pendingDealClientId: string | null;
  onPendingDealClientConsumed: () => void;
  quoteDealId: string | null;
  setQuoteDealId: React.Dispatch<React.SetStateAction<string | null>>;
  handleAddQuote: (dealId: string, values: QuoteFormValues) => Promise<void>;
  editingQuote: Quote | null;
  handleUpdateQuote: (values: QuoteFormValues) => Promise<void>;
  policyDealId: string | null;
  policyDefaultCounterparty?: string;
  closePolicyModal: () => void;
  policyPrefill: PolicyPrefill | null;
  editingPolicy: Policy | null;
  setEditingPolicy: React.Dispatch<React.SetStateAction<Policy | null>>;
  salesChannels: SalesChannel[];
  handleAddPolicy: (dealId: string, values: PolicyFormValues) => Promise<void>;
  handleUpdatePolicy: (policyId: string, values: PolicyFormValues) => Promise<void>;
  policyDealExecutorName?: string | null;
  editingPolicyExecutorName?: string | null;
  paymentModal: PaymentModalState | null;
  setPaymentModal: React.Dispatch<React.SetStateAction<PaymentModalState | null>>;
  handleUpdatePayment: (paymentId: string, values: AddPaymentFormValues) => Promise<void>;
  payments: Payment[];
  financialRecordModal: FinancialRecordModalState | null;
  setFinancialRecordModal: React.Dispatch<React.SetStateAction<FinancialRecordModalState | null>>;
  handleUpdateFinancialRecord: (
    recordId: string,
    values: AddFinancialRecordFormValues,
  ) => Promise<void>;
  financialRecords: FinancialRecord[];
  setEditingQuote: React.Dispatch<React.SetStateAction<Quote | null>>;
  confirm: (options: {
    title?: string;
    message: string;
    confirmText?: string;
    cancelText?: string;
    tone?: 'danger' | 'primary';
  }) => Promise<boolean>;
}

export const AppModals: React.FC<AppModalsProps> = ({
  modal,
  setModal,
  clients,
  policies = [],
  users,
  openClientModal,
  closeClientModal,
  isClientModalOverlayOpen,
  handleAddClient,
  handleAddDeal,
  pendingDealClientId,
  onPendingDealClientConsumed,
  quoteDealId,
  setQuoteDealId,
  handleAddQuote,
  editingQuote,
  handleUpdateQuote,
  policyDealId,
  policyDefaultCounterparty,
  closePolicyModal,
  policyPrefill,
  editingPolicy,
  setEditingPolicy,
  salesChannels,
  handleAddPolicy,
  handleUpdatePolicy,
  policyDealExecutorName,
  editingPolicyExecutorName,
  paymentModal,
  setPaymentModal,
  handleUpdatePayment,
  payments,
  financialRecordModal,
  setFinancialRecordModal,
  handleUpdateFinancialRecord,
  financialRecords,
  setEditingQuote,
  confirm,
}) => {
  const createPolicyCandidates = React.useMemo(
    () => policies.filter((policy) => policy.dealId === policyDealId),
    [policies, policyDealId],
  );
  const editPolicyCandidates = React.useMemo(
    () => policies.filter((policy) => policy.dealId === editingPolicy?.dealId),
    [editingPolicy?.dealId, policies],
  );
  const editingPolicyPayments = React.useMemo(
    () =>
      editingPolicy ? payments.filter((payment) => payment.policyId === editingPolicy.id) : [],
    [editingPolicy, payments],
  );
  const editingPolicyInitialValues = React.useMemo(
    () =>
      editingPolicy
        ? buildPolicyFormValues(
            editingPolicy,
            editingPolicyPayments,
            financialRecords,
            editPolicyCandidates,
          )
        : undefined,
    [editPolicyCandidates, editingPolicy, editingPolicyPayments, financialRecords],
  );
  const [isAddPolicyDirty, setIsAddPolicyDirty] = React.useState(false);
  const [isEditPolicyDirty, setIsEditPolicyDirty] = React.useState(false);

  React.useEffect(() => {
    if (!policyDealId) {
      setIsAddPolicyDirty(false);
    }
  }, [policyDealId]);

  React.useEffect(() => {
    if (!editingPolicy) {
      setIsEditPolicyDirty(false);
    }
  }, [editingPolicy]);

  const requestClosePolicyModal = async () => {
    if (isAddPolicyDirty) {
      const confirmed = await confirm({
        title: 'Закрыть форму полиса?',
        message: 'В форме есть несохранённые изменения. Закрыть без сохранения?',
        confirmText: 'Закрыть',
        cancelText: 'Остаться',
        tone: 'danger',
      });
      if (!confirmed) {
        return;
      }
    }

    setIsAddPolicyDirty(false);
    closePolicyModal();
  };

  const requestCloseEditingPolicyModal = async () => {
    if (isEditPolicyDirty) {
      const confirmed = await confirm({
        title: 'Закрыть форму полиса?',
        message: 'В форме есть несохранённые изменения. Закрыть без сохранения?',
        confirmText: 'Закрыть',
        cancelText: 'Остаться',
        tone: 'danger',
      });
      if (!confirmed) {
        return;
      }
    }

    setIsEditPolicyDirty(false);
    setEditingPolicy(null);
  };

  return (
    <>
      {modal === 'client' && (
        <FormModal isOpen title="Новый клиент" onClose={closeClientModal}>
          <ClientForm onSubmit={handleAddClient} />
        </FormModal>
      )}

      {modal === 'deal' && (
        <FormModal
          isOpen
          title="Новая сделка"
          onClose={() => setModal(null)}
          closeOnOverlayClick={false}
        >
          <DealForm
            clients={clients}
            users={users}
            onSubmit={handleAddDeal}
            preselectedClientId={pendingDealClientId}
            onPreselectedClientConsumed={onPendingDealClientConsumed}
            onRequestAddClient={() => openClientModal('deal')}
          />
        </FormModal>
      )}

      {quoteDealId && (
        <FormModal
          isOpen
          title="Добавить расчёт"
          onClose={() => setQuoteDealId(null)}
          zIndex={APP_OVERLAY_MODAL_Z_INDEX}
        >
          <AddQuoteForm
            onSubmit={(values) => handleAddQuote(quoteDealId, values)}
            onCancel={() => setQuoteDealId(null)}
          />
        </FormModal>
      )}

      {editingQuote && (
        <FormModal
          isOpen
          title="Редактировать расчёт"
          onClose={() => setEditingQuote(null)}
          zIndex={APP_OVERLAY_MODAL_Z_INDEX}
        >
          <AddQuoteForm
            initialValues={editingQuote}
            onSubmit={handleUpdateQuote}
            onCancel={() => setEditingQuote(null)}
          />
        </FormModal>
      )}

      {policyDealId && (
        <FormModal
          isOpen
          title="Добавить полис"
          onClose={() => {
            void requestClosePolicyModal();
          }}
          size="xl"
          zIndex={APP_OVERLAY_MODAL_Z_INDEX}
          closeOnOverlayClick={false}
          panelClassName="flex max-h-[92vh] flex-col overflow-hidden"
          bodyClassName="min-h-0 flex-1 overflow-hidden p-0"
        >
          <AddPolicyForm
            salesChannels={salesChannels}
            initialValues={policyPrefill?.values}
            isEditing={false}
            initialInsuranceCompanyName={policyPrefill?.insuranceCompanyName}
            initialInsuranceTypeName={policyPrefill?.insuranceTypeName}
            defaultCounterparty={policyDefaultCounterparty}
            executorName={policyDealExecutorName}
            clients={clients}
            dealPolicies={createPolicyCandidates}
            onRequestAddClient={() => openClientModal()}
            onDirtyChange={setIsAddPolicyDirty}
            onSubmit={(values) => handleAddPolicy(policyDealId, values)}
            onCancel={() => {
              void requestClosePolicyModal();
            }}
          />
        </FormModal>
      )}

      {editingPolicy && (
        <FormModal
          isOpen
          title="Редактировать полис"
          onClose={() => {
            void requestCloseEditingPolicyModal();
          }}
          size="xl"
          zIndex={APP_OVERLAY_MODAL_Z_INDEX}
          closeOnOverlayClick={false}
          panelClassName="flex max-h-[92vh] flex-col overflow-hidden"
          bodyClassName="min-h-0 flex-1 overflow-hidden p-0"
        >
          <AddPolicyForm
            salesChannels={salesChannels}
            initialValues={editingPolicyInitialValues}
            isEditing
            initialInsuranceCompanyName={editingPolicy.insuranceCompany}
            initialInsuranceTypeName={editingPolicy.insuranceType}
            executorName={editingPolicyExecutorName}
            clients={clients}
            dealPolicies={editPolicyCandidates}
            currentPolicyId={editingPolicy.id}
            onRequestAddClient={() => openClientModal()}
            onDirtyChange={setIsEditPolicyDirty}
            onSubmit={(values) => handleUpdatePolicy(editingPolicy.id, values)}
            onCancel={() => {
              void requestCloseEditingPolicyModal();
            }}
          />
        </FormModal>
      )}

      {paymentModal && (
        <PaymentModal
          isOpen
          title="Редактировать платёж"
          payment={payments.find((p) => p.id === paymentModal.paymentId)}
          zIndex={APP_OVERLAY_MODAL_Z_INDEX}
          onSubmit={(values) => handleUpdatePayment(paymentModal.paymentId!, values)}
          onClose={() => setPaymentModal(null)}
        />
      )}

      {financialRecordModal && (
        <FinancialRecordModal
          isOpen
          title="Редактировать запись"
          paymentId={financialRecordModal.paymentId!}
          record={financialRecords.find((r) => r.id === financialRecordModal.recordId)}
          zIndex={APP_OVERLAY_MODAL_Z_INDEX}
          onClose={() => setFinancialRecordModal(null)}
          onSubmit={(values) => handleUpdateFinancialRecord(financialRecordModal.recordId!, values)}
        />
      )}

      {isClientModalOverlayOpen && (
        <FormModal
          isOpen
          title="Новый клиент"
          onClose={closeClientModal}
          zIndex={APP_OVERLAY_MODAL_Z_INDEX}
        >
          <ClientForm onSubmit={handleAddClient} />
        </FormModal>
      )}
    </>
  );
};
