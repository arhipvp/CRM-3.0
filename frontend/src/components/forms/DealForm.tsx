import React, { useEffect, useMemo, useState } from 'react';
import { Client, User } from '../../types';
import { formatErrorMessage } from '../../utils/formatErrorMessage';

const MAX_CLIENT_SUGGESTIONS = 6;

interface DealFormProps {
  clients: Client[];
  users: User[];
  defaultExecutorId?: string | null;
  onSubmit: (data: {
    title: string;
    clientId: string;
    description?: string;
    expectedClose?: string | null;
    executorId?: string | null;
    source?: string;
  }) => Promise<void>;
  onRequestAddClient: () => void;
}

export const DealForm: React.FC<DealFormProps> = ({
  clients,
  users,
  defaultExecutorId,
  onSubmit,
  onRequestAddClient,
}) => {
  const [title, setTitle] = useState('');
  const [clientId, setClientId] = useState(clients[0]?.id ?? '');
  const [clientQuery, setClientQuery] = useState(clients[0]?.name ?? '');
  const [description, setDescription] = useState('');
  const [source, setSource] = useState('');
  const [expectedClose, setExpectedClose] = useState<string>('');
  const [executorId, setExecutorId] = useState(defaultExecutorId ?? '');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setSubmitting] = useState(false);
  const [showClientSuggestions, setShowClientSuggestions] = useState(false);
  const clientsById = useMemo(() => {
    const map = new Map<string, Client>();
    clients.forEach((client) => {
      map.set(client.id, client);
    });
    return map;
  }, [clients]);

  useEffect(() => {
    if (!clients.length) {
      setClientId('');
      setClientQuery('');
      return;
    }
    const selectedClient = clientsById.get(clientId);
    if (selectedClient) {
      return;
    }
    setClientId(clients[0].id);
    setClientQuery(clients[0].name);
  }, [clients, clientsById, clientId]);

  const filteredClients = useMemo(() => {
    const normalized = clientQuery.trim().toLowerCase();
    if (!normalized) {
      return clients;
    }
    return clients.filter((client) => client.name.toLowerCase().includes(normalized));
  }, [clients, clientQuery]);

  const resolveClientFromQuery = () => {
    const trimmed = clientQuery.trim();
    if (!trimmed) {
      return null;
    }
    const exactMatch = clients.find(
      (client) => client.name.toLowerCase() === trimmed.toLowerCase()
    );
    if (exactMatch) {
      return exactMatch;
    }
    return filteredClients[0] ?? null;
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    const trimmedTitle = title.trim();
    const resolvedClient = resolveClientFromQuery();
    const selectedClientId = resolvedClient?.id ?? clientId;

    if (!trimmedTitle || !selectedClientId) {
      setError('Необходимо выбрать клиента');
      return;
    }

    setError(null);
    setSubmitting(true);
    try {
      if (resolvedClient) {
        setClientId(resolvedClient.id);
        setClientQuery(resolvedClient.name);
      }
      await onSubmit({
        title: trimmedTitle,
        clientId: selectedClientId,
        description: description.trim() || undefined,
        expectedClose: expectedClose || null,
        executorId: executorId || undefined,
        source: source.trim() || undefined,
      });
    } catch (err) {
      setError(formatErrorMessage(err, 'Не удалось создать сделку'));
    } finally {
      setSubmitting(false);
    }
  };

  const handleClientSelect = (client: Client) => {
    setClientId(client.id);
    setClientQuery(client.name);
    setShowClientSuggestions(false);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && <p className="text-sm text-red-500 bg-red-50 p-3 rounded-lg">{error}</p>}
      <div>
        <label className="block text-sm font-medium text-slate-700">Название*</label>
        <input
          type="text"
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-sky-500 focus:ring-sky-500"
          placeholder="Страхование автопарка"
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-slate-700">Клиент*</label>
        <div className="mt-1 flex flex-col gap-2">
          <div className="relative flex items-center gap-2">
            <div className="relative flex-1">
              <input
                type="text"
                value={clientQuery}
                onFocus={() => setShowClientSuggestions(true)}
                onChange={(event) => {
                  setClientQuery(event.target.value);
                  setShowClientSuggestions(true);
                }}
                onBlur={() => {
                  setTimeout(() => setShowClientSuggestions(false), 120);
                }}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-sky-500 focus:ring-sky-500"
                placeholder="Найти клиента"
              />
              {showClientSuggestions && (
                <div className="absolute inset-x-0 top-full z-10 mt-1 max-h-44 overflow-y-auto rounded-lg border border-slate-200 bg-white shadow-lg">
                  {filteredClients.length ? (
                    filteredClients.slice(0, MAX_CLIENT_SUGGESTIONS).map((client) => (
                      <button
                        key={client.id}
                        type="button"
                        className="w-full px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-100"
                        onMouseDown={(event) => {
                          event.preventDefault();
                          handleClientSelect(client);
                        }}
                      >
                        {client.name}
                      </button>
                    ))
                  ) : (
                    <div className="px-3 py-2 text-sm text-slate-500">Клиенты не найдены</div>
                  )}
                </div>
              )}
            </div>
            <button
              type="button"
              onClick={onRequestAddClient}
              className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:border-slate-400 hover:text-slate-900 focus:outline-none focus:ring-2 focus:ring-sky-500"
            >
              + Клиент
            </button>
          </div>
        </div>
      </div>
      <div>
        <label className="block text-sm font-medium text-slate-700">Исполнитель</label>
        <select
          value={executorId}
          onChange={(event) => setExecutorId(event.target.value)}
          className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-sky-500 focus:ring-sky-500"
        >
          <option value="">Не выбран</option>
          {users.map((user) => (
            <option key={user.id} value={user.id}>
              {user.firstName || user.lastName
                ? `${user.firstName ?? ''} ${user.lastName ?? ''}`.trim()
                : user.username}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label className="block text-sm font-medium text-slate-700">Краткое описание</label>
        <textarea
          value={description}
          onChange={(event) => setDescription(event.target.value)}
          rows={3}
          className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-sky-500 focus:ring-sky-500"
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-slate-700">Источник</label>
        <input
          type="text"
          value={source}
          onChange={(event) => setSource(event.target.value)}
          className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-sky-500 focus:ring-sky-500"
          placeholder="Источник сделки"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-slate-700">Ожидаемая дата закрытия</label>
        <input
          type="date"
          value={expectedClose}
          onChange={(event) => setExpectedClose(event.target.value)}
          className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-sky-500 focus:ring-sky-500"
        />
      </div>
      <button
        type="submit"
        disabled={isSubmitting || !clients.length}
        className="w-full bg-sky-600 text-white rounded-lg py-2 font-semibold text-sm disabled:opacity-60"
      >
        {isSubmitting ? 'Сохраняем...' : 'Создать сделку'}
      </button>
    </form>
  );
};
