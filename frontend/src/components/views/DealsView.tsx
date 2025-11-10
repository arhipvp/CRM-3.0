// Fix: Implemented the DealsView component.
// This component organizes the layout for viewing deals, with a list on one side and details on the other.
import React from 'react';
import { Client, Deal, DealStatus, Quote, Policy, Task, Payment, FinancialTransaction } from '../../types';
import { DealList } from '../ClientList';
import { ClientDetails } from '../ClientDetails';

interface DealsViewProps {
  deals: Deal[];
  clients: Client[];
  policies: Policy[];
  payments: Payment[];
  financialTransactions: FinancialTransaction[];
  selectedDeal: Deal | null;
  allUsers: string[];
  onSelectDeal: (deal: Deal) => void;
  onUpdateReviewDate: (dealId: string, newDate: string) => void;
  onUpdateDealStatus: (dealId: string, newStatus: DealStatus, reason?: string) => void;
  onUpdateDealTitle: (dealId: string, newTitle: string) => void;
  onUpdateDealClient: (dealId: string, newClientId: string) => void;
  onAddNote: (dealId: string, content: string) => void;
  onUpdateNoteStatus: (dealId: string, noteId: string, status: 'active' | 'archived') => void;
  onAddQuote: (dealId: string, quoteData: Omit<Quote, 'id'>) => void;
  onDeleteQuote: (dealId: string, quoteId: string) => void;
  onAddFile: (dealId: string, file: File) => void;
  onDeleteFile: (dealId: string, fileId: string) => void;
  onAddPolicy: (dealId: string, policyData: Omit<Policy, 'id' | 'clientId' | 'dealId'>, installments: Array<Omit<Payment, 'id' | 'clientId' | 'policyId' | 'status'>>, policyClientId: string) => void;
  onAddPayment: (policyId: string, paymentData: Omit<Payment, 'id' | 'policyId' | 'clientId'>) => void;
  onAddTask: (dealId: string, taskData: Omit<Task, 'id' | 'completed'>) => void;
  onToggleTask: (dealId: string, taskId: string) => void;
  onAddFinancialTransaction: (transactionData: Omit<FinancialTransaction, 'id'>) => void;
  onAddChatMessage: (dealId: string, text: string) => void;
}

export const DealsView: React.FC<DealsViewProps> = (props) => {
  const {
    deals,
    clients,
    policies,
    selectedDeal,
    onSelectDeal,
    onUpdateReviewDate,
  } = props;
  
  const selectedClient = selectedDeal ? clients.find(c => c.id === selectedDeal.clientId) || null : null;
  const dealPolicies = selectedDeal ? policies.filter(p => p.dealId === selectedDeal.id) : [];

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 xl:grid-cols-4 h-full">
      <div className="md:col-span-1 xl:col-span-1 border-r border-slate-200">
        <DealList
          deals={deals}
          clients={clients}
          selectedDealId={selectedDeal?.id || null}
          onSelectDeal={onSelectDeal}
          onUpdateReviewDate={onUpdateReviewDate}
        />
      </div>
      <div className="md:col-span-2 xl:col-span-3">
        <ClientDetails
          {...props}
          deal={selectedDeal}
          client={selectedClient}
          policies={dealPolicies}
          allClients={clients}
        />
      </div>
    </div>
  );
};
