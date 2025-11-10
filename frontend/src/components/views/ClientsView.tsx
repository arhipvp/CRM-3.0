import React, { useState, useMemo } from 'react';
import { Client, Deal } from '../../types';

const formatPhoneNumberForWhatsapp = (phone: string) => {
    return phone.replace(/[^0-9]/g, '');
};

interface ClientsViewProps {
  clients: Client[];
  deals: Deal[];
  onEditClient: (client: Client) => void;
  onSelectDeal: (dealId: string) => void;
}

export const ClientsView: React.FC<ClientsViewProps> = ({ clients, deals, onEditClient, onSelectDeal }) => {
    const [searchQuery, setSearchQuery] = useState('');

    const filteredClients = useMemo(() => {
        const lowercasedQuery = searchQuery.trim().toLowerCase();
        if (!lowercasedQuery) {
            return clients;
        }
        return clients.filter(client => {
            const searchCorpus = [
                client.name,
                client.email,
                client.phone,
                client.address,
                client.notes || '',
            ].join(' ').toLowerCase();
            return searchCorpus.includes(lowercasedQuery);
        });
    }, [clients, searchQuery]);

    return (
      <div className="p-8 overflow-y-auto h-full">
        <div className="flex justify-between items-center mb-6">
            <h1 className="text-3xl font-bold text-slate-800">Клиенты ({filteredClients.length})</h1>
            <div className="w-full max-w-sm">
              <label htmlFor="search-clients" className="sr-only">Поиск клиентов</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <svg className="h-5 w-5 text-slate-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z" clipRule="evenodd" />
                  </svg>
                </div>
                <input
                  id="search-clients"
                  type="text"
                  placeholder="Поиск по имени, email, телефону..."
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  className="w-full bg-white border-slate-300 rounded-md text-sm p-2 pl-10 focus:ring-2 focus:ring-sky-500 focus:border-sky-500"
                />
              </div>
            </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {filteredClients.map(client => {
            const clientDeals = deals.filter(deal => deal.clientId === client.id);
            return (
              <div key={client.id} className="bg-white p-5 rounded-lg shadow-sm border border-slate-200 flex flex-col transition-shadow hover:shadow-md relative">
                <div className="absolute top-2 right-2">
                    <button 
                      onClick={() => onEditClient(client)} 
                      className="p-2 rounded-full text-slate-400 hover:bg-slate-100 hover:text-sky-600 transition-colors"
                      title="Редактировать клиента"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.5L16.732 3.732z" />
                      </svg>
                    </button>
                </div>
                <div className="text-center w-full">
                  <h2 className="font-bold text-lg text-slate-800 mb-1">{client.name}</h2>
                  <p className="text-sm text-sky-600 font-medium truncate">{client.email}</p>
                   <a href={`https://wa.me/${formatPhoneNumberForWhatsapp(client.phone)}`} target="_blank" rel="noopener noreferrer" className="text-sm text-slate-500 mt-1 hover:text-sky-600 hover:underline">{client.phone}</a>
                  <p className="text-xs text-slate-400 mt-2 truncate">{client.address}</p>
                  {client.birthDate && (
                    <p className="text-sm text-slate-500 mt-2">
                      <span className="font-semibold">ДР:</span> {new Date(client.birthDate).toLocaleDateString('ru-RU')}
                    </p>
                  )}
                </div>
                {client.notes && (
                  <p className="text-xs text-slate-500 mt-4 pt-4 border-t border-slate-100 w-full text-left italic">
                    <span className="font-semibold not-italic">Примечание:</span> {client.notes}
                  </p>
                )}
                 {clientDeals.length > 0 && (
                  <div className="mt-4 pt-4 border-t border-slate-100 w-full text-left">
                    <h3 className="text-sm font-semibold text-slate-700 mb-2">Сделки ({clientDeals.length})</h3>
                    <ul className="space-y-1">
                      {clientDeals.map(deal => (
                        <li key={deal.id}>
                          <button 
                            onClick={() => onSelectDeal(deal.id)} 
                            className="text-sm text-sky-600 hover:underline text-left"
                          >
                            {deal.title}
                          </button>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            );
          })}
           {filteredClients.length === 0 && (
              <div className="md:col-span-2 lg:col-span-3 xl:col-span-4 text-center py-10">
                <p className="text-slate-500">Клиенты не найдены.</p>
              </div>
            )}
        </div>
      </div>
    );
}