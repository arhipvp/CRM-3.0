// Fix: Implemented the main App component with state management, data handlers, and mock data.
import React, { useState, useMemo, useEffect } from 'react';
import { MainLayout } from './components/MainLayout';
import { DealsView } from './components/views/DealsView';
import { ClientsView } from './components/views/ClientsView';
import { PoliciesView } from './components/views/PoliciesView';
import { PaymentsView } from './components/views/PaymentsView';
import { FinanceView } from './components/views/FinanceView';
import { TasksView } from './components/views/TasksView';
import { SettingsView } from './components/views/SettingsView';
import { AddDealForm } from './components/AddDealForm';
import { AddClientForm } from './components/AddClientForm';
import { EditClientForm } from './components/EditClientForm';
import {
  Client, Deal, Policy, Payment, FinancialTransaction, DealStatus, Quote, Task
} from './types';
import { generateMockData } from './services/mockData';

type View = 'deals' | 'clients' | 'policies' | 'payments' | 'finance' | 'tasks' | 'settings';
type Modal = 'addDeal' | 'addClient' | { type: 'editClient'; client: Client } | null;


const App: React.FC = () => {
  const [view, setView] = useState<View>('deals');
  const [modal, setModal] = useState<Modal>(null);

  const [clients, setClients] = useState<Client[]>([]);
  const [deals, setDeals] = useState<Deal[]>([]);
  const [policies, setPolicies] = useState<Policy[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [financialTransactions, setFinancialTransactions] = useState<FinancialTransaction[]>([]);
  
  const [selectedDealId, setSelectedDealId] = useState<string | null>(null);

  const ALL_USERS = useMemo(() => [...new Set(deals.map(deal => deal.owner))], [deals]);

  useEffect(() => {
    const { clients, deals, policies, payments, financialTransactions } = generateMockData();
    setClients(clients);
    setDeals(deals);
    setPolicies(policies);
    setPayments(payments);
    setFinancialTransactions(financialTransactions);
    if (deals.length > 0) {
      setSelectedDealId(deals[0].id);
    }
  }, []);
  
  const selectedDeal = useMemo(() => {
    if (!selectedDealId) return null;
    return deals.find(d => d.id === selectedDealId) || null;
  }, [selectedDealId, deals]);

  const handleSelectDeal = (deal: Deal) => setSelectedDealId(deal.id);

  const handleUpdateReviewDate = (dealId: string, newDate: string) => {
    setDeals(prevDeals => prevDeals.map(d => d.id === dealId ? { ...d, nextReviewDate: newDate } : d));
  };
  
  const handleUpdateDealStatus = (dealId: string, newStatus: DealStatus, reason?: string) => {
      setDeals(prevDeals => prevDeals.map(d => {
          if (d.id !== dealId) return d;
          const newDeal = { ...d, status: newStatus };
          if (newStatus === 'Закрыта' && reason) {
              const newNote = {
                  id: `note-${Date.now()}`,
                  content: `Сделка закрыта. Причина: ${reason}`,
                  createdAt: new Date().toLocaleDateString('ru-RU'),
                  status: 'archived' as const
              };
              newDeal.notes = [...newDeal.notes, newNote];
          }
          return newDeal;
      }));
  };
  
  const handleUpdateDealTitle = (dealId: string, newTitle: string) => {
      setDeals(prevDeals => prevDeals.map(d => d.id === dealId ? { ...d, title: newTitle } : d));
  };
  
  const handleUpdateDealClient = (dealId: string, newClientId: string) => {
      setDeals(prevDeals => prevDeals.map(d => d.id === dealId ? { ...d, clientId: newClientId } : d));
  };

  const handleAddNote = (dealId: string, content: string) => {
    setDeals(prevDeals => prevDeals.map(d => {
      if (d.id !== dealId) return d;
      const newNote = { id: `note-${Date.now()}`, content, createdAt: new Date().toLocaleDateString('ru-RU'), status: 'active' as const };
      return { ...d, notes: [...d.notes, newNote] };
    }));
  };
  
  const onUpdateNoteStatus = (dealId: string, noteId: string, status: 'active' | 'archived') => {
      setDeals(prevDeals => prevDeals.map(d => {
          if (d.id !== dealId) return d;
          return { ...d, notes: d.notes.map(n => n.id === noteId ? {...n, status} : n) };
      }));
  };

  const handleAddQuote = (dealId: string, quoteData: Omit<Quote, 'id'>) => {
    setDeals(prevDeals => prevDeals.map(d => {
        if (d.id !== dealId) return d;
        const newQuote = { ...quoteData, id: `quote-${Date.now()}` };
        return { ...d, quotes: [...d.quotes, newQuote] };
    }));
  };

  const handleDeleteQuote = (dealId: string, quoteId: string) => {
      setDeals(prevDeals => prevDeals.map(d => {
          if (d.id !== dealId) return d;
          return { ...d, quotes: d.quotes.filter(q => q.id !== quoteId) };
      }));
  };
  
  const handleAddFile = (dealId: string, file: File) => {
      setDeals(prevDeals => prevDeals.map(d => {
          if (d.id !== dealId) return d;
          const newFile = { id: `file-${Date.now()}`, name: file.name, size: file.size, url: '#' };
          return { ...d, files: [...d.files, newFile] };
      }));
  };
  
  const handleDeleteFile = (dealId: string, fileId: string) => {
       setDeals(prevDeals => prevDeals.map(d => {
          if (d.id !== dealId) return d;
          return { ...d, files: d.files.filter(f => f.id !== fileId) };
      }));
  };
  
    const handleAddPolicy = (dealId: string, policyData: Omit<Policy, 'id' | 'clientId' | 'dealId'>, installments: Array<Omit<Payment, 'id' | 'clientId' | 'policyId' | 'status'>>, policyClientId: string) => {
        const newPolicyId = `policy-${Date.now()}`;
        const newPolicy: Policy = { ...policyData, id: newPolicyId, clientId: policyClientId, dealId };
        const newPayments: Payment[] = installments.map((inst, index) => ({
            ...inst,
            id: `payment-${newPolicyId}-${index}`,
            policyId: newPolicyId,
            clientId: policyClientId,
            status: 'Ожидает'
        }));
        setPolicies(prev => [...prev, newPolicy]);
        setPayments(prev => [...prev, ...newPayments]);
    };
    
    const handleAddPayment = (policyId: string, paymentData: Omit<Payment, 'id' | 'policyId' | 'clientId'>) => {
        const policy = policies.find(p => p.id === policyId);
        if (!policy) return;
        const newPayment: Payment = {
            ...paymentData,
            id: `payment-${Date.now()}`,
            policyId,
            clientId: policy.clientId
        };
        setPayments(prev => [...prev, newPayment]);
    };
    
    const handleAddTask = (dealId: string, taskData: Omit<Task, 'id' | 'completed'>) => {
        setDeals(prev => prev.map(d => {
            if (d.id !== dealId) return d;
            const newTask: Task = { ...taskData, id: `task-${Date.now()}`, completed: false };
            return { ...d, tasks: [...d.tasks, newTask] };
        }));
    };
    
    const handleToggleTask = (dealId: string, taskId: string) => {
         setDeals(prev => prev.map(d => {
            if (d.id !== dealId) return d;
            return { ...d, tasks: d.tasks.map(t => t.id === taskId ? {...t, completed: !t.completed} : t) };
        }));
    };
    
    const handleAddFinancialTransaction = (transactionData: Omit<FinancialTransaction, 'id'>) => {
        const newTransaction = { ...transactionData, id: `fin-${Date.now()}` };
        setFinancialTransactions(prev => [...prev, newTransaction]);
    };
    
    const handleAddChatMessage = (dealId: string, text: string) => {
        setDeals(prev => prev.map(d => {
            if (d.id !== dealId) return d;
            const newMessage = { id: `chat-${Date.now()}`, text, sender: 'Пользователь', timestamp: new Date().toISOString() };
            return { ...d, chat: [...d.chat, newMessage] };
        }));
    };

    const handleMarkAsPaid = (transactionId: string, paymentDate: string) => {
        setFinancialTransactions(prev => prev.map(t => t.id === transactionId ? { ...t, paymentDate } : t));
    };

    const handleUpdateAmount = (transactionId: string, newAmount: number) => {
        setFinancialTransactions(prev => prev.map(t => t.id === transactionId ? { ...t, amount: newAmount } : t));
    };

    const handleSelectDealFromClientView = (dealId: string) => {
        setSelectedDealId(dealId);
        setView('deals');
    };

    const handleAddClient = (clientData: Omit<Client, 'id'>) => {
        const newClient: Client = { ...clientData, id: `client-${Date.now()}`};
        setClients(prev => [...prev, newClient]);
        setModal(null);
    };

    const handleUpdateClient = (clientData: Client) => {
        setClients(prev => prev.map(c => c.id === clientData.id ? clientData : c));
        setModal(null);
    };

    const handleAddDeal = (data: { title: string; clientId: string }) => {
        const newDeal: Deal = {
            id: `deal-${Date.now()}`,
            title: data.title,
            clientId: data.clientId,
            status: 'Новая',
            owner: 'Продавец 1',
            summary: 'Новая сделка, детали не заполнены.',
            nextReviewDate: new Date().toISOString().split('T')[0],
            tasks: [],
            notes: [],
            quotes: [],
            files: [],
            chat: [],
            activityLog: [],
        };
        setDeals(prev => [newDeal, ...prev]);
        setSelectedDealId(newDeal.id);
        setModal(null);
        setView('deals');
    };

  const renderView = () => {
    switch(view) {
      case 'deals':
        return <DealsView 
            deals={deals}
            clients={clients}
            policies={policies}
            payments={payments}
            financialTransactions={financialTransactions}
            selectedDeal={selectedDeal}
            allUsers={ALL_USERS}
            onSelectDeal={handleSelectDeal}
            onUpdateReviewDate={handleUpdateReviewDate}
            onUpdateDealStatus={handleUpdateDealStatus}
            onUpdateDealTitle={handleUpdateDealTitle}
            onUpdateDealClient={handleUpdateDealClient}
            onAddNote={handleAddNote}
            onUpdateNoteStatus={onUpdateNoteStatus}
            onAddQuote={handleAddQuote}
            onDeleteQuote={handleDeleteQuote}
            onAddFile={handleAddFile}
            onDeleteFile={handleDeleteFile}
            onAddPolicy={handleAddPolicy}
            onAddPayment={handleAddPayment}
            onAddTask={handleAddTask}
            onToggleTask={handleToggleTask}
            onAddFinancialTransaction={handleAddFinancialTransaction}
            onAddChatMessage={handleAddChatMessage}
        />;
      case 'clients':
        return <ClientsView clients={clients} deals={deals} onEditClient={(client) => setModal({ type: 'editClient', client })} onSelectDeal={handleSelectDealFromClientView} />;
      case 'policies':
        return <PoliciesView policies={policies} clients={clients} payments={payments} />;
      case 'payments':
        return <PaymentsView payments={payments} policies={policies} clients={clients} />;
      case 'finance':
        return <FinanceView financialTransactions={financialTransactions} policies={policies} deals={deals} clients={clients} onMarkAsPaid={handleMarkAsPaid} onUpdateAmount={handleUpdateAmount}/>;
      case 'tasks':
        return <TasksView deals={deals} clients={clients} policies={policies} />;
      case 'settings':
        return <SettingsView />;
      default:
        return <div>Not found</div>;
    }
  };

  const renderModal = () => {
      if (!modal) return null;
      if (modal === 'addDeal') return <AddDealForm clients={clients} onAddDeal={handleAddDeal} onClose={() => setModal(null)} />;
      if (modal === 'addClient') return <AddClientForm onAddClient={handleAddClient} onClose={() => setModal(null)} />;
      if (typeof modal === 'object' && modal.type === 'editClient') return <EditClientForm client={modal.client} onUpdateClient={handleUpdateClient} onClose={() => setModal(null)} />;
      return null;
  }

  return (
    <div className="h-screen bg-slate-100 font-sans">
      <MainLayout
        activeView={view}
        onNavigate={setView}
        onAddDeal={() => setModal('addDeal')}
        onAddClient={() => setModal('addClient')}
      >
        {renderView()}
      </MainLayout>
      {renderModal()}
    </div>
  );
};

export default App;
