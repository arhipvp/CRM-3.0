import React from 'react';
import { Modal } from '../Modal';
import { ClientForm } from '../forms/ClientForm';
import { DealForm } from '../forms/DealForm';
import { AddQuoteForm, QuoteFormValues } from '../forms/AddQuoteForm';
import { AddPolicyForm } from '../forms/AddPolicyForm';
import { AddPaymentForm, AddPaymentFormValues } from '../forms/AddPaymentForm';
import { AddFinancialRecordForm, AddFinancialRecordFormValues } from '../forms/AddFinancialRecordForm';
import type {
  Client,
  FinancialRecord,
  Payment,
  Policy,
  Quote,
  SalesChannel,
  User,
} from '../../types';
import type {
  FinancialRecordModalState,
  ModalType,
  PaymentModalState,
} from './types';
import type { FinancialRecordDraft, PaymentDraft, PolicyFormValues } from '../forms/addPolicy/types';

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
  const records = payment.financialRecords ?? financialRecords.filter((record) => record.paymentId === payment.id);
  const { incomes, expenses } = splitFinancialRecords(records);
  return {
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
  financialRecords: FinancialRecord[]
): PolicyFormValues => ({
  number: policy.number,
  insuranceCompanyId: policy.insuranceCompanyId,
  insuranceTypeId: policy.insuranceTypeId,
  isVehicle: policy.isVehicle,
  brand: policy.brand,
  model: policy.model,
  vin: policy.vin,
  counterparty: policy.counterparty,
  salesChannelId: policy.salesChannelId,
  startDate: policy.startDate,
  endDate: policy.endDate,
  insuredClientId: policy.insuredClientId,
  insuredClientName: policy.insuredClientName ?? policy.clientName,
  payments: payments.map((payment) => buildPaymentDraft(payment, financialRecords)),
});

interface AppModalsProps {
  modal: ModalType;
  setModal: React.Dispatch<React.SetStateAction<ModalType>>;
  clients: Client[];
  users: User[];
  openClientModal: (afterModal?: ModalType | null) => void;
  closeClientModal: () => void;
  handleAddClient: (data: {
    name: string;
    phone?: string;
    birthDate?: string | null;
    notes?: string | null;
    email?: string | null;
  }) => Promise<void>;
  handleAddDeal: (data: { title: string; description?: string; clientId: string; expectedClose?: string | null; executorId?: string | null; source?: string }) => Promise<void>;
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
  handleUpdateFinancialRecord: (recordId: string, values: AddFinancialRecordFormValues) => Promise<void>;
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
  handleAddClient,
  handleAddDeal,
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
        <Modal title="Новый клиент" onClose={closeClientModal}>
          <ClientForm onSubmit={handleAddClient} />
        </Modal>
      )}

      {modal === 'deal' && (
        <Modal title="Новая сделка" onClose={() => setModal(null)} closeOnOverlayClick={false}>
          <DealForm
            clients={clients}
            users={users}
            onSubmit={handleAddDeal}
            onRequestAddClient={() => openClientModal('deal')}
          />
        </Modal>
      )}

      {quoteDealId && (
        <Modal title="Добавить расчёт" onClose={() => setQuoteDealId(null)}>
          <AddQuoteForm
            onSubmit={(values) => handleAddQuote(quoteDealId, values)}
            onCancel={() => setQuoteDealId(null)}
          />
        </Modal>
      )}

      {editingQuote && (
        <Modal title="Редактировать расчёт" onClose={() => setEditingQuote(null)}>
          <AddQuoteForm
            initialValues={editingQuote}
            onSubmit={handleUpdateQuote}
            onCancel={() => setEditingQuote(null)}
          />
        </Modal>
      )}

      {policyDealId && (
        <Modal
          title="Добавить полис"
          onClose={closePolicyModal}
          size="xl"
          closeOnOverlayClick={false}
        >
          <AddPolicyForm
            salesChannels={salesChannels}
            initialValues={policyPrefill?.values}
            initialInsuranceCompanyName={policyPrefill?.insuranceCompanyName}
            initialInsuranceTypeName={policyPrefill?.insuranceTypeName}
            defaultCounterparty={policyDefaultCounterparty}
            executorName={policyDealExecutorName}
            clients={clients}
            onRequestAddClient={() => openClientModal()}
            onSubmit={(values) => handleAddPolicy(policyDealId, values)}
            onCancel={closePolicyModal}
          />
        </Modal>
      )}

      {editingPolicy && (
        <Modal
          title="Редактировать полис"
          onClose={() => setEditingPolicy(null)}
          size="xl"
          closeOnOverlayClick={false}
        >
          <AddPolicyForm
            salesChannels={salesChannels}
            initialValues={buildPolicyFormValues(editingPolicy, editingPolicyPayments, financialRecords)}
            initialInsuranceCompanyName={editingPolicy.insuranceCompany}
            initialInsuranceTypeName={editingPolicy.insuranceType}
            executorName={editingPolicyExecutorName}
            clients={clients}
            onRequestAddClient={() => openClientModal()}
            onSubmit={(values) => handleUpdatePolicy(editingPolicy.id, values)}
            onCancel={() => setEditingPolicy(null)}
          />
        </Modal>
      )}

      {paymentModal && (
        <Modal title="Редактировать платёж" onClose={() => setPaymentModal(null)}>
          <AddPaymentForm
            payment={payments.find((p) => p.id === paymentModal.paymentId)}
            onSubmit={(values) => handleUpdatePayment(paymentModal.paymentId!, values)}
            onCancel={() => setPaymentModal(null)}
          />
        </Modal>
      )}

      {financialRecordModal && (
        <Modal title="Редактировать запись" onClose={() => setFinancialRecordModal(null)}>
          <AddFinancialRecordForm
            paymentId={financialRecordModal.paymentId!}
            record={financialRecords.find((r) => r.id === financialRecordModal.recordId)}
            onSubmit={(values) =>
              handleUpdateFinancialRecord(financialRecordModal.recordId!, values)
            }
            onCancel={() => setFinancialRecordModal(null)}
          />
        </Modal>
      )}
    </>
  );
};
