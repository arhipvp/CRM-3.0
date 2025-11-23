import React from 'react';
import { Modal } from '../Modal';
import { ClientForm } from '../forms/ClientForm';
import { DealForm } from '../forms/DealForm';
import { AddQuoteForm, QuoteFormValues } from '../forms/AddQuoteForm';
import { AddPolicyForm, PolicyFormValues } from '../forms/AddPolicyForm';
import { AddPaymentForm, AddPaymentFormValues } from '../forms/AddPaymentForm';
import { AddFinancialRecordForm, AddFinancialRecordFormValues } from '../forms/AddFinancialRecordForm';
import type {
  Client,
  FinancialRecord,
  Payment,
  Quote,
  SalesChannel,
  User,
} from '../../types';
import type {
  FinancialRecordModalState,
  ModalType,
  PaymentModalState,
} from './types';

interface PolicyPrefill {
  values: PolicyFormValues;
  insuranceCompanyName?: string;
  insuranceTypeName?: string;
}

interface AppModalsProps {
  modal: ModalType;
  setModal: React.Dispatch<React.SetStateAction<ModalType>>;
  editingClient: Client | null;
  setEditingClient: React.Dispatch<React.SetStateAction<Client | null>>;
  clients: Client[];
  users: User[];
  handleAddClient: (data: { name: string; phone?: string; birthDate?: string | null; notes?: string | null }) => Promise<void>;
  handleUpdateClient: (id: string, data: { name: string; phone?: string; birthDate?: string | null; notes?: string | null }) => Promise<void>;
  handleAddDeal: (data: { title: string; description?: string; clientId: string; expectedClose?: string | null; executorId?: string | null; source?: string }) => Promise<void>;
  quoteDealId: string | null;
  setQuoteDealId: React.Dispatch<React.SetStateAction<string | null>>;
  handleAddQuote: (dealId: string, values: QuoteFormValues) => Promise<void>;
  editingQuote: Quote | null;
  handleUpdateQuote: (values: QuoteFormValues) => Promise<void>;
  policyDealId: string | null;
  setPolicyDealId: React.Dispatch<React.SetStateAction<string | null>>;
  policyPrefill: PolicyPrefill | null;
  setPolicyPrefill: React.Dispatch<React.SetStateAction<PolicyPrefill | null>>;
  salesChannels: SalesChannel[];
  handleAddPolicy: (dealId: string, values: PolicyFormValues) => Promise<void>;
  paymentModal: PaymentModalState | null;
  setPaymentModal: React.Dispatch<React.SetStateAction<PaymentModalState | null>>;
  handleUpdatePayment: (paymentId: string, values: AddPaymentFormValues) => Promise<void>;
  payments: Payment[];
  financialRecordModal: FinancialRecordModalState | null;
  setFinancialRecordModal: React.Dispatch<React.SetStateAction<FinancialRecordModalState | null>>;
  handleUpdateFinancialRecord: (recordId: string, values: AddFinancialRecordFormValues) => Promise<void>;
  financialRecords: FinancialRecord[];
}

export const AppModals: React.FC<AppModalsProps> = ({
  modal,
  setModal,
  editingClient,
  setEditingClient,
  clients,
  users,
  handleAddClient,
  handleUpdateClient,
  handleAddDeal,
  quoteDealId,
  setQuoteDealId,
  handleAddQuote,
  editingQuote,
  handleUpdateQuote,
  policyDealId,
  setPolicyDealId,
  policyPrefill,
  setPolicyPrefill,
  salesChannels,
  handleAddPolicy,
  paymentModal,
  setPaymentModal,
  handleUpdatePayment,
  payments,
  financialRecordModal,
  setFinancialRecordModal,
  handleUpdateFinancialRecord,
  financialRecords,
}) => (
  <>
    {modal === 'client' && (
      <Modal title="Новый клиент" onClose={() => setModal(null)}>
        <ClientForm onSubmit={handleAddClient} />
      </Modal>
    )}

    {editingClient && (
      <Modal title="Редактировать клиента" onClose={() => setEditingClient(null)}>
        <ClientForm
          initial={{
            name: editingClient.name,
            phone: editingClient.phone ?? undefined,
            birthDate: editingClient.birthDate ?? undefined,
            notes: editingClient.notes ?? undefined,
          }}
          onSubmit={(data) => handleUpdateClient(editingClient.id, data)}
        />
      </Modal>
    )}

    {modal === 'deal' && (
      <Modal title="Новая сделка" onClose={() => setModal(null)}>
        <DealForm clients={clients} users={users} onSubmit={handleAddDeal} />
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
      <Modal title="Добавить полис" onClose={() => setPolicyDealId(null)} size="xl">
        <AddPolicyForm
          salesChannels={salesChannels}
          initialValues={policyPrefill?.values}
          initialInsuranceCompanyName={policyPrefill?.insuranceCompanyName}
          initialInsuranceTypeName={policyPrefill?.insuranceTypeName}
          onSubmit={(values) => handleAddPolicy(policyDealId, values)}
          onCancel={() => {
            setPolicyDealId(null);
            setPolicyPrefill(null);
          }}
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
