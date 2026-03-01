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
  Payment,
  Policy,
  Quote,
  SalesChannel,
  User,
  FinancialRecordModalState,
  PaymentModalState,
} from '../../types';
import type { ModalType } from './types';
import type {
  FinancialRecordDraft,
  PaymentDraft,
  PolicyFormValues,
} from '../forms/addPolicy/types';
import { FinancialRecordModal } from '../financialRecords/FinancialRecordModal';
import { PaymentModal } from '../payments/PaymentModal';
import { FormModal } from '../common/modal/FormModal';

interface PolicyPrefill {
  values: PolicyFormValues;
  insuranceCompanyName?: string;
  insuranceTypeName?: string;
}

const normalizeRecordAmount = (value?: string | null) => {
  const numeric = Number(value ?? '0');
  if (!Number.isFinite(numeric)) {
    return '0';
  }
  return String(Math.abs(numeric));
};

const toFinancialRecordDraft = (record: FinancialRecord): FinancialRecordDraft => ({
  id: record.id,
  amount: normalizeRecordAmount(record.amount),
  date: record.date ?? '',
  description: record.description ?? '',
  source: record.source ?? '',
  note: record.note ?? '',
});

const splitFinancialRecords = (records: FinancialRecord[]) => {
  const incomes: FinancialRecordDraft[] = [];
  const expenses: FinancialRecordDraft[] = [];
  for (const record of records) {
    const amount = Number(record.amount ?? '0');
    if (!Number.isFinite(amount) || amount >= 0) {
      incomes.push(toFinancialRecordDraft(record));
    } else {
      expenses.push(toFinancialRecordDraft(record));
    }
  }
  return { incomes, expenses };
};

const buildPaymentDraft = (payment: Payment, financialRecords: FinancialRecord[]): PaymentDraft => {
  const records =
    payment.financialRecords ??
    financialRecords.filter((record) => record.paymentId === payment.id);
  const { incomes, expenses } = splitFinancialRecords(records);
  return {
    id: payment.id,
    amount: payment.amount,
    description: payment.description,
    scheduledDate: payment.scheduledDate ?? '',
    actualDate: payment.actualDate ?? '',
    incomes,
    expenses,
  };
};

const buildPolicyFormValues = (
  policy: Policy,
  payments: Payment[],
  financialRecords: FinancialRecord[],
): PolicyFormValues => ({
  number: policy.number,
  insuranceCompanyId: policy.insuranceCompanyId,
  insuranceTypeId: policy.insuranceTypeId,
  isVehicle: policy.isVehicle,
  brand: policy.brand,
  model: policy.model,
  vin: policy.vin,
  counterparty: policy.counterparty,
  note: policy.note,
  salesChannelId: policy.salesChannelId,
  startDate: policy.startDate,
  endDate: policy.endDate,
  clientId: policy.clientId ?? policy.insuredClientId,
  clientName: policy.clientName ?? policy.insuredClientName,
  payments: payments.map((payment) => buildPaymentDraft(payment, financialRecords)),
});

interface AppModalsProps {
  modal: ModalType;
  setModal: React.Dispatch<React.SetStateAction<ModalType>>;
  clients: Client[];
  users: User[];
  openClientModal: (afterModal?: ModalType | null) => void;
  closeClientModal: () => void;
  isClientModalOverlayOpen: boolean;
  handleAddClient: (data: {
    name: string;
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
}

export const AppModals: React.FC<AppModalsProps> = ({
  modal,
  setModal,
  clients,
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
}) => {
  const editingPolicyPayments = editingPolicy
    ? payments.filter((payment) => payment.policyId === editingPolicy.id)
    : [];

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
        <FormModal isOpen title="Добавить расчёт" onClose={() => setQuoteDealId(null)}>
          <AddQuoteForm
            onSubmit={(values) => handleAddQuote(quoteDealId, values)}
            onCancel={() => setQuoteDealId(null)}
          />
        </FormModal>
      )}

      {editingQuote && (
        <FormModal isOpen title="Редактировать расчёт" onClose={() => setEditingQuote(null)}>
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
          onClose={closePolicyModal}
          size="xl"
          closeOnOverlayClick={false}
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
            onRequestAddClient={() => openClientModal()}
            onSubmit={(values) => handleAddPolicy(policyDealId, values)}
            onCancel={closePolicyModal}
          />
        </FormModal>
      )}

      {editingPolicy && (
        <FormModal
          isOpen
          title="Редактировать полис"
          onClose={() => setEditingPolicy(null)}
          size="xl"
          closeOnOverlayClick={false}
        >
          <AddPolicyForm
            salesChannels={salesChannels}
            initialValues={buildPolicyFormValues(
              editingPolicy,
              editingPolicyPayments,
              financialRecords,
            )}
            isEditing
            initialInsuranceCompanyName={editingPolicy.insuranceCompany}
            initialInsuranceTypeName={editingPolicy.insuranceType}
            executorName={editingPolicyExecutorName}
            clients={clients}
            onRequestAddClient={() => openClientModal()}
            onSubmit={(values) => handleUpdatePolicy(editingPolicy.id, values)}
            onCancel={() => setEditingPolicy(null)}
          />
        </FormModal>
      )}

      {paymentModal && (
        <PaymentModal
          isOpen
          title="Редактировать платёж"
          payment={payments.find((p) => p.id === paymentModal.paymentId)}
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
          onClose={() => setFinancialRecordModal(null)}
          onSubmit={(values) => handleUpdateFinancialRecord(financialRecordModal.recordId!, values)}
        />
      )}

      {isClientModalOverlayOpen && (
        <FormModal isOpen title="Новый клиент" onClose={closeClientModal} zIndex={50}>
          <ClientForm onSubmit={handleAddClient} />
        </FormModal>
      )}
    </>
  );
};
