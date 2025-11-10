import React, { useState, useMemo } from 'react';
import { Client, Deal, DealStatus } from '../types';

interface DealListProps {
  deals: Deal[];
  clients: Client[];
  selectedDealId: string | null;
  onSelectDeal: (deal: Deal) => void;
  onUpdateReviewDate: (dealId: string, newDate: string) => void;
}

const getFutureDate = (days: number): string => {
  const futureDate = new Date();
  futureDate.setDate(futureDate.getDate() + days);
  return futureDate.toISOString().split('T')[0];
};

const getClient = (clientId: string, clients: Client[]) => {
    return clients.find(c => c.id === clientId);
};

const StatusBadge: React.FC<{ status: DealStatus }> = ({ status }) => {
  const statusClasses: Record<DealStatus, string> = {
    'Новая': 'bg-blue-100 text-blue-800',
    'Расчет': 'bg-purple-100 text-purple-800',
    'Переговоры': 'bg-yellow-100 text-yellow-800',
    'Оформление': 'bg-orange-100 text-orange-800',
    'Ожидает продления': 'bg-green-100 text-green-800',
    'Закрыта': 'bg-red-100 text-red-800',
  };
  return <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${statusClasses[status]}`}>{status}</span>;
};

const DateButton: React.FC<{ onClick: () => void; children: React.ReactNode }> = ({ onClick, children }) => (
    <button
        type="button"
        onClick={(e) => {
            e.stopPropagation();
            onClick();
        }}
        className="px-2 py-0.5 border border-slate-200 bg-slate-50 rounded-md text-slate-600 hover:bg-slate-100 hover:border-slate-300 text-[10px] font-medium transition-colors"
    >
        {children}
    </button>
);

const ALL_STATUSES: DealStatus[] = [
  'Новая',
  'Расчет',
  'Переговоры',
  'Оформление',
  'Ожидает продления',
  'Закрыта',
];

export const DealList: React.FC<DealListProps> = ({ deals, clients, selectedDealId, onSelectDeal, onUpdateReviewDate }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [ownerFilter, setOwnerFilter] = useState('all');
  const [sortBy, setSortBy] = useState('date-desc');

  const uniqueOwners = useMemo(() => [...new Set(deals.map(deal => deal.owner))].sort(), [deals]);

  const filteredAndSortedDeals = useMemo(() => {
    let processedDeals = [...deals];
    const lowercasedQuery = searchQuery.trim().toLowerCase();

    // Apply search filter
    if (lowercasedQuery) {
        processedDeals = processedDeals.filter(deal => {
            const client = getClient(deal.clientId, clients);
            const searchCorpus = [
                deal.title,
                deal.summary,
                client?.name,
                client?.email,
                client?.phone,
                ...deal.tasks.map(t => t.description),
                ...deal.notes.map(n => n.content),
                ...deal.quotes.map(q => `${q.insurer} ${q.comments}`),
                ...deal.files.map(f => f.name),
                ...deal.chat.map(c => c.text),
            ].filter(Boolean).join(' ').toLowerCase();

            return searchCorpus.includes(lowercasedQuery);
        });
    }

    // Apply status filters
    if (statusFilter !== 'all') {
      processedDeals = processedDeals.filter(d => d.status === statusFilter);
    }
    if (ownerFilter !== 'all') {
      processedDeals = processedDeals.filter(d => d.owner === ownerFilter);
    }

    // Apply sorting
    processedDeals.sort((a, b) => {
      const dateA = new Date(a.nextReviewDate).getTime();
      const dateB = new Date(b.nextReviewDate).getTime();
      if (sortBy === 'date-desc') {
        return dateB - dateA;
      } else {
        return dateA - dateB;
      }
    });

    return processedDeals;
  }, [deals, clients, searchQuery, statusFilter, ownerFilter, sortBy]);


  return (
    <div className="bg-white h-full overflow-y-auto">
      <div className="p-4 border-b border-slate-200 sticky top-0 bg-white z-10">
        <h2 className="text-xl font-bold text-slate-800">Сделки ({filteredAndSortedDeals.length})</h2>
        <div className="mt-4">
            <label htmlFor="search-deals" className="sr-only">Поиск по сделкам</label>
            <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <svg className="h-5 w-5 text-slate-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z" clipRule="evenodd" />
                    </svg>
                </div>
                <input
                    id="search-deals"
                    type="text"
                    placeholder="Поиск по названию, клиенту, заметкам..."
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    className="w-full bg-slate-100 border-transparent rounded-md text-sm p-2 pl-10 focus:ring-2 focus:ring-sky-500 focus:border-sky-500"
                />
            </div>
        </div>
        <div className="mt-2 grid grid-cols-1 sm:grid-cols-3 gap-2 text-sm">
            <div>
              <label htmlFor="status-filter" className="sr-only">Статус</label>
              <select id="status-filter" value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className="w-full bg-slate-100 border-transparent rounded-md text-sm p-2 focus:ring-2 focus:ring-sky-500 focus:border-sky-500">
                <option value="all">Все статусы</option>
                {ALL_STATUSES.map(status => <option key={status} value={status}>{status}</option>)}
              </select>
            </div>
            <div>
              <label htmlFor="owner-filter" className="sr-only">Ответственный</label>
              <select id="owner-filter" value={ownerFilter} onChange={e => setOwnerFilter(e.target.value)} className="w-full bg-slate-100 border-transparent rounded-md text-sm p-2 focus:ring-2 focus:ring-sky-500 focus:border-sky-500">
                <option value="all">Все ответственные</option>
                {uniqueOwners.map(owner => <option key={owner} value={owner}>{owner}</option>)}
              </select>
            </div>
            <div>
              <label htmlFor="sort-by" className="sr-only">Сортировка</label>
              <select id="sort-by" value={sortBy} onChange={e => setSortBy(e.target.value)} className="w-full bg-slate-100 border-transparent rounded-md text-sm p-2 focus:ring-2 focus:ring-sky-500 focus:border-sky-500">
                <option value="date-desc">Сначала новые</option>
                <option value="date-asc">Сначала старые</option>
              </select>
            </div>
        </div>
      </div>
      <div className="p-2">
        <ul className="space-y-1">
          {filteredAndSortedDeals.map(deal => {
            const client = getClient(deal.clientId, clients);
            return (
              <li key={deal.id}>
                <button
                  onClick={() => onSelectDeal(deal)}
                  className={`w-full text-left p-3 rounded-lg flex items-start transition-colors duration-150 ${
                    selectedDealId === deal.id
                      ? 'bg-sky-100'
                      : 'hover:bg-slate-100'
                  }`}
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between items-start">
                        <p className={`font-semibold ${selectedDealId === deal.id ? 'text-sky-800' : 'text-slate-800'}`}>{deal.title}</p>
                    </div>
                    <p className="text-sm text-slate-500 truncate">{client?.name}</p>
                    <div className="mt-2 flex items-center justify-between">
                        <StatusBadge status={deal.status} />
                        <div className="text-right">
                            <div className="flex items-center space-x-1 text-xs text-slate-500 justify-end">
                               <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                 <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                               </svg>
                               <input
                                  type="date"
                                  value={deal.nextReviewDate}
                                  onChange={(e) => {
                                    e.stopPropagation();
                                    onUpdateReviewDate(deal.id, e.target.value);
                                  }}
                                  onClick={(e) => e.stopPropagation()}
                                  className="bg-transparent border-0 rounded p-1 text-xs text-slate-500 w-[115px] focus:outline-none focus:ring-1 focus:ring-sky-500 hover:bg-slate-200/50 cursor-pointer"
                                  aria-label="Дата следующего просмотра"
                               />
                            </div>
                            <div className="flex items-center space-x-1 mt-1.5 justify-end">
                                <DateButton onClick={() => onUpdateReviewDate(deal.id, getFutureDate(1))}>На завтра</DateButton>
                                <DateButton onClick={() => onUpdateReviewDate(deal.id, getFutureDate(2))}>+2 дня</DateButton>
                                <DateButton onClick={() => onUpdateReviewDate(deal.id, getFutureDate(5))}>+5 дней</DateButton>
                            </div>
                        </div>
                    </div>
                  </div>
                </button>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
};