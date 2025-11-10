import React, { useState, useRef, useEffect } from 'react';
import { Client } from '../types';

interface AddDealFormProps {
  clients: Client[];
  onAddDeal: (data: { title: string; clientId: string }) => void;
  onClose: () => void;
}

const HighlightMatch: React.FC<{ text: string; highlight: string }> = ({ text, highlight }) => {
  if (!highlight.trim()) {
    return <span>{text}</span>;
  }
  const regex = new RegExp(`(${highlight})`, 'gi');
  const parts = text.split(regex);
  return (
    <span>
      {parts.map((part, i) =>
        regex.test(part) ? (
          <span key={i} className="font-bold bg-yellow-200">
            {part}
          </span>
        ) : (
          <span key={i}>{part}</span>
        )
      )}
    </span>
  );
};

export const AddDealForm: React.FC<AddDealFormProps> = ({ clients, onAddDeal, onClose }) => {
  const [title, setTitle] = useState('');
  const [clientId, setClientId] = useState<string>(clients[0]?.id || '');
  const [error, setError] = useState('');

  const [isClientSelectorOpen, setClientSelectorOpen] = useState(false);
  const [clientSearchQuery, setClientSearchQuery] = useState('');
  const clientSelectorRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
        if (clientSelectorRef.current && !clientSelectorRef.current.contains(event.target as Node)) {
            setClientSelectorOpen(false);
            setClientSearchQuery('');
        }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleClientSelect = (id: string) => {
    setClientId(id);
    setClientSelectorOpen(false);
    setClientSearchQuery('');
  };

  const selectedClientName = clients.find(c => c.id === clientId)?.name || 'Выберите клиента';

  const filteredClients = clients.filter(c =>
    c.name.toLowerCase().includes(clientSearchQuery.toLowerCase())
  );


  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !clientId) {
      setError('Пожалуйста, заполните все поля.');
      return;
    }
    onAddDeal({ title, clientId });
  };

  return (
    <form onSubmit={handleSubmit} className="p-6 space-y-4">
        <div className="flex justify-between items-center">
            <h2 className="text-xl font-bold text-slate-800">Создать новую сделку</h2>
            <button type="button" onClick={onClose} className="p-1 rounded-full text-slate-400 hover:bg-slate-100">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
            </button>
        </div>
        {error && <p className="text-red-500 text-sm">{error}</p>}
      <div>
        <label htmlFor="title" className="block text-sm font-medium text-slate-700">
          Название сделки
        </label>
        <input
          type="text"
          id="title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="mt-1 block w-full rounded-md border-slate-300 shadow-sm focus:border-sky-500 focus:ring focus:ring-sky-200 focus:ring-opacity-50"
          placeholder="напр., Ежегодное продление страхования автопарка"
        />
      </div>
      <div>
        <label htmlFor="client" className="block text-sm font-medium text-slate-700">
          Клиент
        </label>
        <div className="relative" ref={clientSelectorRef}>
            <button
                type="button"
                onClick={() => setClientSelectorOpen(!isClientSelectorOpen)}
                className="mt-1 block w-full rounded-md border border-slate-300 shadow-sm bg-white text-left p-2 focus:border-sky-500 focus:ring focus:ring-sky-200 focus:ring-opacity-50"
                aria-haspopup="listbox"
                aria-expanded={isClientSelectorOpen}
            >
                <span className="truncate">{selectedClientName}</span>
            </button>
            {isClientSelectorOpen && (
                <div className="absolute z-10 mt-1 w-full bg-white rounded-md shadow-lg border border-slate-200">
                    <div className="p-2 border-b border-slate-200">
                        <input
                            type="text"
                            placeholder="Поиск клиента..."
                            autoFocus
                            value={clientSearchQuery}
                            onChange={(e) => setClientSearchQuery(e.target.value)}
                            className="w-full bg-slate-50 border-slate-200 rounded-md text-sm p-2 focus:ring-2 focus:ring-sky-500 focus:border-sky-500"
                        />
                    </div>
                    <ul className="max-h-40 overflow-auto text-sm py-1" role="listbox">
                        {filteredClients.length > 0 ? (
                          filteredClients.map(client => (
                            <li
                                key={client.id}
                                onClick={() => handleClientSelect(client.id)}
                                className={`cursor-pointer select-none relative py-2 pl-3 pr-9 transition-colors ${
                                    client.id === clientId
                                        ? 'text-white bg-sky-600'
                                        : 'text-slate-900 hover:bg-slate-100'
                                }`}
                                role="option"
                                aria-selected={client.id === clientId}
                            >
                                <span className="font-normal block">
                                  <HighlightMatch text={client.name} highlight={clientSearchQuery} />
                                </span>
                                {client.id === clientId && (
                                    <span className="text-white absolute inset-y-0 right-0 flex items-center pr-4">
                                        <svg className="h-5 w-5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                                            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                        </svg>
                                    </span>
                                )}
                            </li>
                        ))) : (
                          <li className="px-3 py-2 text-sm text-slate-500">Клиенты не найдены.</li>
                        )}
                    </ul>
                </div>
            )}
        </div>
      </div>
      <div className="flex justify-end pt-4 space-x-2">
        <button
          type="button"
          onClick={onClose}
          className="px-4 py-2 text-sm font-medium text-slate-700 bg-slate-100 rounded-lg hover:bg-slate-200"
        >
          Отмена
        </button>
        <button
          type="submit"
          className="px-4 py-2 text-sm font-medium text-white bg-sky-600 rounded-lg hover:bg-sky-700"
        >
          Создать сделку
        </button>
      </div>
    </form>
  );
};