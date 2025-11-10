import React, { useState, useMemo, useEffect, useRef } from 'react';
import { Policy, FinancialTransaction, Deal, Client } from '../../types';

interface FinanceViewProps {
  financialTransactions: FinancialTransaction[];
  policies: Policy[];
  deals: Deal[];
  clients: Client[];
  onMarkAsPaid: (transactionId: string, paymentDate: string) => void;
  onUpdateAmount: (transactionId: string, newAmount: number) => void;
}

const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('ru-RU', { style: 'currency', currency: 'RUB', minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(amount);
};

const StatCard: React.FC<{ title: string; value: string; colorClass: string }> = ({ title, value, colorClass }) => (
    <div className="bg-white p-6 rounded-lg shadow-sm border border-slate-200">
        <h3 className="text-sm font-medium text-slate-500">{title}</h3>
        <p className={`mt-1 text-3xl font-semibold ${colorClass}`}>{value}</p>
    </div>
);

const MarkAsPaidModal: React.FC<{ onConfirm: (date: string) => void; onClose: () => void }> = ({ onConfirm, onClose }) => {
    const [paymentDate, setPaymentDate] = useState(new Date().toISOString().split('T')[0]);

    const handleConfirm = () => {
        if (paymentDate) {
            onConfirm(paymentDate);
        }
    };

    return (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={onClose}>
            <div className="bg-white rounded-lg shadow-xl max-w-sm w-full p-6" onClick={e => e.stopPropagation()}>
                <h3 className="text-lg font-semibold text-slate-800">Подтвердить выплату</h3>
                <p className="text-sm text-slate-500 mt-2">Укажите фактическую дату выплаты. После подтверждения операция будет считаться завершенной.</p>
                <div className="mt-4">
                    <label htmlFor="payment_date" className="block text-sm font-medium text-slate-700">Дата выплаты</label>
                    <input
                        type="date"
                        id="payment_date"
                        value={paymentDate}
                        onChange={(e) => setPaymentDate(e.target.value)}
                        className="mt-1 block w-full rounded-md border-slate-300 shadow-sm focus:border-sky-500 focus:ring-sky-500"
                    />
                </div>
                <div className="flex justify-end mt-6 space-x-3">
                    <button onClick={onClose} className="px-4 py-2 text-sm font-medium text-slate-700 bg-slate-100 rounded-lg hover:bg-slate-200">Отмена</button>
                    <button onClick={handleConfirm} className="px-4 py-2 text-sm font-medium text-white bg-sky-600 rounded-lg hover:bg-sky-700">Подтвердить</button>
                </div>
            </div>
        </div>
    );
};


export const FinanceView: React.FC<FinanceViewProps> = ({ financialTransactions, policies, deals, clients, onMarkAsPaid, onUpdateAmount }) => {
    const [activeFilter, setActiveFilter] = useState<'pending' | 'completed'>('pending');
    const [confirmPaidModal, setConfirmPaidModal] = useState<string | null>(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [editingTransaction, setEditingTransaction] = useState<{ id: string; amount: string } | null>(null);
    const editInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        if (editingTransaction && editInputRef.current) {
            editInputRef.current.focus();
        }
    }, [editingTransaction]);

    const enrichedTransactions = useMemo(() => {
        return financialTransactions.map(t => {
            const policy = policies.find(p => p.id === t.policyId);
            const deal = deals.find(d => d.id === (t.dealId || policy?.dealId));
            const client = clients.find(c => c.id === deal?.clientId);
            return {
                ...t,
                policyNumber: policy?.policyNumber || '-',
                dealTitle: deal?.title || '-',
                clientName: client?.name || '-',
            };
        });
    }, [financialTransactions, policies, deals, clients]);

    const filteredTransactions = useMemo(() => {
        const lowercasedQuery = searchQuery.trim().toLowerCase();

        if (!lowercasedQuery) {
            return enrichedTransactions;
        }

        return enrichedTransactions.filter(t => {
            const searchCorpus = [
                t.description,
                t.clientName,
                t.policyNumber,
                t.dealTitle,
            ].join(' ').toLowerCase();
            return searchCorpus.includes(lowercasedQuery);
        });
    }, [enrichedTransactions, searchQuery]);


    const pendingTransactions = filteredTransactions.filter(t => !t.paymentDate);
    const completedTransactions = filteredTransactions.filter(t => !!t.paymentDate);
    
    const transactionsToShow = activeFilter === 'pending' ? pendingTransactions : completedTransactions;

    const totalUpcomingIncome = pendingTransactions.filter(t => t.type === 'Доход').reduce((sum, t) => sum + t.amount, 0);
    const totalUpcomingExpense = pendingTransactions.filter(t => t.type === 'Расход').reduce((sum, t) => sum + t.amount, 0);

    const handleSaveEdit = () => {
        if (editingTransaction) {
            const newAmount = parseFloat(editingTransaction.amount);
            if (!isNaN(newAmount)) {
                onUpdateAmount(editingTransaction.id, newAmount);
            }
            setEditingTransaction(null);
        }
    };
    
    const handleEditKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Enter') {
            handleSaveEdit();
        } else if (e.key === 'Escape') {
            setEditingTransaction(null);
        }
    };


    return (
        <>
        <div className="p-8 overflow-y-auto h-full">
            <div className="flex justify-between items-center mb-6">
                <h1 className="text-3xl font-bold text-slate-800">Финансовые операции</h1>
                <div className="w-full max-w-sm">
                    <label htmlFor="search-finance" className="sr-only">Поиск</label>
                    <div className="relative">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                            <svg className="h-5 w-5 text-slate-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                                <path fillRule="evenodd" d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z" clipRule="evenodd" />
                            </svg>
                        </div>
                        <input
                            id="search-finance"
                            type="text"
                            placeholder="Поиск по описанию, клиенту, полису..."
                            value={searchQuery}
                            onChange={e => setSearchQuery(e.target.value)}
                            className="w-full bg-white border-slate-300 rounded-md text-sm p-2 pl-10 focus:ring-2 focus:ring-sky-500 focus:border-sky-500"
                        />
                    </div>
                </div>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                <StatCard title="Ожидаемый доход" value={formatCurrency(totalUpcomingIncome)} colorClass="text-green-600" />
                <StatCard title="Ожидаемый расход" value={formatCurrency(totalUpcomingExpense)} colorClass="text-red-600" />
                <StatCard title="Ожидаемая прибыль" value={formatCurrency(totalUpcomingIncome - totalUpcomingExpense)} colorClass="text-sky-600" />
            </div>

            <div className="mb-4">
                 <div className="flex border-b border-slate-200">
                    <button onClick={() => setActiveFilter('pending')} className={`px-4 py-2 text-sm font-medium ${activeFilter === 'pending' ? 'text-sky-600 border-b-2 border-sky-600' : 'text-slate-500 hover:text-slate-700'}`}>
                        Предстоящие ({pendingTransactions.length})
                    </button>
                    <button onClick={() => setActiveFilter('completed')} className={`px-4 py-2 text-sm font-medium ${activeFilter === 'completed' ? 'text-sky-600 border-b-2 border-sky-600' : 'text-slate-500 hover:text-slate-700'}`}>
                        Завершенные ({completedTransactions.length})
                    </button>
                 </div>
            </div>

             <div className="bg-white rounded-lg shadow-sm border border-slate-200 overflow-hidden">
                <table className="min-w-full divide-y divide-slate-200">
                     <thead className="bg-slate-50">
                        <tr>
                            <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">Плановая дата</th>
                            {activeFilter === 'completed' && <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">Дата выплаты</th>}
                            <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">Описание</th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">Клиент</th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">Полис / Сделка</th>
                            <th className="px-4 py-3 text-right text-xs font-medium text-slate-500 uppercase">Сумма</th>
                            <th className="relative px-4 py-3"><span className="sr-only">Действия</span></th>
                        </tr>
                    </thead>
                     <tbody className="bg-white divide-y divide-slate-200">
                        {transactionsToShow.map(t => (
                            <tr key={t.id} className="hover:bg-slate-50">
                                <td className="px-4 py-4 text-sm text-slate-600">{t.date}</td>
                                {activeFilter === 'completed' && <td className="px-4 py-4 text-sm text-slate-600 font-semibold">{t.paymentDate}</td>}
                                <td className="px-4 py-4 text-sm font-medium text-slate-800">{t.description}</td>
                                <td className="px-4 py-4 text-sm text-slate-600">{t.clientName}</td>
                                <td className="px-4 py-4 text-sm text-slate-500">
                                    <div>{t.policyNumber}</div>
                                    <div className="text-xs text-slate-400">{t.dealTitle}</div>
                                </td>
                                <td className={`px-4 py-4 text-sm font-semibold text-right ${t.type === 'Доход' ? 'text-green-700' : 'text-red-700'}`}>
                                    {editingTransaction?.id === t.id ? (
                                        <input
                                            ref={editInputRef}
                                            type="number"
                                            value={editingTransaction.amount}
                                            onChange={(e) => setEditingTransaction({...editingTransaction, amount: e.target.value})}
                                            onBlur={handleSaveEdit}
                                            onKeyDown={handleEditKeyDown}
                                            className="w-28 text-right bg-white border border-sky-500 rounded-md p-1 shadow-sm"
                                        />
                                    ) : (
                                        <div onClick={() => setEditingTransaction({ id: t.id, amount: t.amount.toString() })} className="cursor-pointer p-1 rounded-md hover:bg-slate-200/50">
                                            {t.type === 'Расход' && '- '}{formatCurrency(t.amount)}
                                        </div>
                                    )}
                                </td>
                                <td className="px-4 py-4 text-right">
                                    {!t.paymentDate && (
                                        <button onClick={() => setConfirmPaidModal(t.id)} className="text-sm text-sky-600 hover:text-sky-800 font-semibold">Отметить как выплаченный</button>
                                    )}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
                {transactionsToShow.length === 0 && <p className="text-center text-sm text-slate-500 py-10">Нет операций, соответствующих фильтру.</p>}
            </div>
        </div>

        {confirmPaidModal && (
            <MarkAsPaidModal 
                onClose={() => setConfirmPaidModal(null)}
                onConfirm={(date) => {
                    onMarkAsPaid(confirmPaidModal, date);
                    setConfirmPaidModal(null);
                }}
            />
        )}
        </>
    );
}