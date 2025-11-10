import React, { useState, useMemo } from 'react';
import { Policy, Client, Payment } from '../../types';

// --- Helper Functions & Types ---

const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('ru-RU', { style: 'currency', currency: 'RUB', minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(amount);
};

const getClientName = (clientId: string, clients: Client[]) => {
    return clients.find(c => c.id === clientId)?.name || 'Неизвестный клиент';
}

const getPaymentStatusInfo = (policyId: string, payments: Payment[]): { text: 'Просрочен' | 'Ожидает оплаты' | 'Все оплачены' | 'Нет платежей'; className: string } => {
    const policyPayments = payments.filter(p => p.policyId === policyId);

    if (policyPayments.length === 0) {
        return { text: 'Нет платежей', className: 'bg-slate-100 text-slate-600' };
    }
    if (policyPayments.some(p => p.status === 'Просрочен')) {
        return { text: 'Просрочен', className: 'bg-red-100 text-red-800' };
    }
    if (policyPayments.some(p => p.status === 'Ожидает')) {
        return { text: 'Ожидает оплаты', className: 'bg-yellow-100 text-yellow-800' };
    }
    return { text: 'Все оплачены', className: 'bg-green-100 text-green-800' };
};

const getDaysNoun = (days: number): string => {
    const cases = [2, 0, 1, 1, 1, 2];
    const titles = ['день', 'дня', 'дней'];
    const number = Math.abs(days);
    return titles[(number % 100 > 4 && number % 100 < 20) ? 2 : cases[(number % 10 < 5) ? number % 10 : 5]];
};

const RENEWAL_REMINDER_DAYS = 30;

type EnrichedPolicy = Policy & {
    clientName: string;
    policyPremium: number;
    paymentStatusInfo: { text: string; className: string; };
    isDueForRenewal: boolean;
    daysUntilRenewal: number | null;
};
type SortKeys = keyof EnrichedPolicy | 'policyPremium';

// --- Sub-components ---

const SortIcon: React.FC<{ direction?: 'ascending' | 'descending' }> = ({ direction }) => {
    if (!direction) {
        return <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 inline-block ml-1 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 11l5-5m0 0l5 5m-5-5v12" /></svg>;
    }
    if (direction === 'ascending') {
        return <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 inline-block ml-1 text-sky-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" /></svg>;
    }
    return <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 inline-block ml-1 text-sky-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>;
};

const PaymentStatusBadge: React.FC<{ statusInfo: { text: string; className: string } }> = ({ statusInfo }) => (
    <span className={`px-2 py-1 text-xs font-medium rounded-full ${statusInfo.className}`}>{statusInfo.text}</span>
);

interface PoliciesViewProps {
  policies: Policy[];
  clients: Client[];
  payments: Payment[];
}

export const PoliciesView: React.FC<PoliciesViewProps> = ({ policies, clients, payments }) => {
    const [searchQuery, setSearchQuery] = useState('');
    const [filters, setFilters] = useState({
        type: 'all',
        startDate: '',
        endDate: '',
        paymentStatus: 'all',
    });
    const [sortConfig, setSortConfig] = useState<{ key: SortKeys; direction: 'ascending' | 'descending' } | null>({ key: 'endDate', direction: 'ascending' });

    const enrichedPolicies = useMemo<EnrichedPolicy[]>(() => {
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        return policies.map(policy => {
            const endDate = new Date(policy.endDate);
            const timeDiff = endDate.getTime() - today.getTime();
            const daysUntilRenewal = Math.ceil(timeDiff / (1000 * 3600 * 24));
            
            const isDueForRenewal = daysUntilRenewal >= 0 && daysUntilRenewal <= RENEWAL_REMINDER_DAYS;

            return {
                ...policy,
                clientName: getClientName(policy.clientId, clients),
                policyPremium: payments
                    .filter(p => p.policyId === policy.id)
                    .reduce((sum, p) => sum + p.amount, 0),
                paymentStatusInfo: getPaymentStatusInfo(policy.id, payments),
                isDueForRenewal,
                daysUntilRenewal: isDueForRenewal ? daysUntilRenewal : null,
            };
        });
    }, [policies, clients, payments]);

    const filteredAndSortedPolicies = useMemo(() => {
        let filteredData = [...enrichedPolicies];
        const lowercasedQuery = searchQuery.trim().toLowerCase();

        // Apply search query first
        if (lowercasedQuery) {
            filteredData = filteredData.filter(p => {
                const searchCorpus = `${p.policyNumber} ${p.clientName} ${p.counterparty}`.toLowerCase();
                return searchCorpus.includes(lowercasedQuery);
            });
        }

        // Apply other filters
        filteredData = filteredData.filter(p => {
            return (
                (filters.type === 'all' || p.type === filters.type) &&
                p.startDate.includes(filters.startDate) &&
                p.endDate.includes(filters.endDate) &&
                (filters.paymentStatus === 'all' || p.paymentStatusInfo.text === filters.paymentStatus)
            );
        });

        // Apply sorting
        if (sortConfig !== null) {
            filteredData.sort((a, b) => {
                const aValue = a[sortConfig.key];
                const bValue = b[sortConfig.key];
                
                let comparison = 0;
                if (sortConfig.key === 'policyPremium') {
                   comparison = a.policyPremium - b.policyPremium;
                } else if (sortConfig.key === 'startDate' || sortConfig.key === 'endDate') {
                   comparison = new Date(aValue as string).getTime() - new Date(bValue as string).getTime();
                } else {
                   comparison = (aValue as string).localeCompare(bValue as string);
                }

                return sortConfig.direction === 'ascending' ? comparison : -comparison;
            });
        }
        
        return filteredData;

    }, [enrichedPolicies, searchQuery, filters, sortConfig]);

    const handleFilterChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        const { name, value } = e.target;
        setFilters(prev => ({ ...prev, [name]: value }));
    };

    const requestSort = (key: SortKeys) => {
        let direction: 'ascending' | 'descending' = 'ascending';
        if (sortConfig && sortConfig.key === key && sortConfig.direction === 'ascending') {
            direction = 'descending';
        }
        setSortConfig({ key, direction });
    };

    const uniquePolicyTypes = useMemo(() => [...new Set(policies.map(p => p.type))], [policies]);
    const uniquePaymentStatuses = ['Все оплачены', 'Ожидает оплаты', 'Просрочен', 'Нет платежей'];

    const getSortDirection = (key: SortKeys) => {
        if (!sortConfig || sortConfig.key !== key) return undefined;
        return sortConfig.direction;
    };

    return (
        <div className="p-8 overflow-y-auto h-full">
            <div className="flex justify-between items-center mb-6">
                <h1 className="text-3xl font-bold text-slate-800">Полисы ({filteredAndSortedPolicies.length})</h1>
                <div className="w-full max-w-sm">
                    <label htmlFor="search-policies" className="sr-only">Поиск</label>
                    <div className="relative">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                            <svg className="h-5 w-5 text-slate-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                                <path fillRule="evenodd" d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z" clipRule="evenodd" />
                            </svg>
                        </div>
                        <input
                            id="search-policies"
                            type="text"
                            placeholder="Поиск по номеру, клиенту, контрагенту..."
                            value={searchQuery}
                            onChange={e => setSearchQuery(e.target.value)}
                            className="w-full bg-white border-slate-300 rounded-md text-sm p-2 pl-10 focus:ring-2 focus:ring-sky-500 focus:border-sky-500"
                        />
                    </div>
                </div>
            </div>
            <div className="bg-white rounded-lg shadow-sm border border-slate-200 overflow-x-auto">
                <table className="min-w-full divide-y divide-slate-200">
                    <thead className="bg-slate-50">
                        <tr>
                            {['Номер полиса / Контрагент', 'Клиент', 'Тип', 'Дата начала', 'Дата окончания', 'Премия', 'Статус платежей'].map((header, index) => {
                                const keys: SortKeys[] = ['policyNumber', 'clientName', 'type', 'startDate', 'endDate', 'policyPremium', 'paymentStatusInfo'];
                                const key = keys[index];
                                return (
                                <th key={header} scope="col" className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                                    <button onClick={() => requestSort(key)} className="flex items-center w-full text-left focus:outline-none">
                                        {header}
                                        <SortIcon direction={getSortDirection(key)} />
                                    </button>
                                </th>
                            )})}
                        </tr>
                        <tr className="bg-slate-100">
                            <th className="p-2 font-normal" colSpan={2}></th>
                            <th className="p-2 font-normal">
                                <select name="type" onChange={handleFilterChange} className="w-full text-sm p-1 border border-slate-300 rounded-md">
                                    <option value="all">Все</option>
                                    {uniquePolicyTypes.map(t => <option key={t} value={t}>{t}</option>)}
                                </select>
                            </th>
                            <th className="p-2 font-normal"><input type="date" name="startDate" onChange={handleFilterChange} className="w-full text-sm p-1 border border-slate-300 rounded-md"/></th>
                            <th className="p-2 font-normal"><input type="date" name="endDate" onChange={handleFilterChange} className="w-full text-sm p-1 border border-slate-300 rounded-md"/></th>
                            <th className="p-2 font-normal"></th>
                            <th className="p-2 font-normal">
                                <select name="paymentStatus" onChange={handleFilterChange} className="w-full text-sm p-1 border border-slate-300 rounded-md">
                                    <option value="all">Все</option>
                                    {uniquePaymentStatuses.map(s => <option key={s} value={s}>{s}</option>)}
                                </select>
                            </th>
                        </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-slate-200">
                        {filteredAndSortedPolicies.map(policy => (
                            <tr key={policy.id} className={policy.isDueForRenewal ? 'bg-yellow-50 hover:bg-yellow-100/70' : 'hover:bg-slate-50'}>
                                <td className="px-6 py-4 whitespace-nowrap text-sm">
                                    <div className="font-medium text-slate-900">{policy.policyNumber}</div>
                                    <div className="text-slate-500">{policy.counterparty}</div>
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-600">{policy.clientName}</td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500">{policy.type}</td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500">{policy.startDate}</td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500">
                                    {policy.endDate}
                                    {policy.isDueForRenewal && policy.daysUntilRenewal !== null && (
                                        <div className={`text-xs ${policy.daysUntilRenewal <= 7 ? 'text-red-600' : 'text-orange-600'} font-semibold mt-1 flex items-center`}>
                                            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" viewBox="0 0 20 20" fill="currentColor">
                                              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clipRule="evenodd" />
                                            </svg>
                                            {policy.daysUntilRenewal > 0 
                                                ? `Продление через ${policy.daysUntilRenewal} ${getDaysNoun(policy.daysUntilRenewal)}`
                                                : `Продление сегодня`
                                            }
                                        </div>
                                    )}
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-800 font-semibold">{formatCurrency(policy.policyPremium)}</td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm">
                                    <PaymentStatusBadge statusInfo={policy.paymentStatusInfo} />
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
                 {filteredAndSortedPolicies.length === 0 && <p className="text-center text-sm text-slate-500 py-8">Полисы, соответствующие фильтрам, не найдены.</p>}
            </div>
        </div>
    );
}