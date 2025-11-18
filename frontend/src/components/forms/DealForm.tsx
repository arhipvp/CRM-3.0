import React, { useState } from 'react';
import { Client, User } from '../../types';

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
}

export const DealForm: React.FC<DealFormProps> = ({
  clients,
  users,
  defaultExecutorId,
  onSubmit,
}) => {
  const [title, setTitle] = useState('');
  const [clientId, setClientId] = useState(clients[0]?.id ?? '');
  const [description, setDescription] = useState('');
  const [source, setSource] = useState('');
  const [expectedClose, setExpectedClose] = useState<string>('');
  const [executorId, setExecutorId] = useState(defaultExecutorId ?? '');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setSubmitting] = useState(false);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!title.trim() || !clientId) {
      setError('Название и клиент обязательны');
      return;
    }
    setError(null);
    setSubmitting(true);
    try {
      await onSubmit({
        title: title.trim(),
        clientId,
        description: description.trim() || undefined,
        expectedClose: expectedClose || null,
        executorId: executorId || undefined,
        source: source.trim() || undefined,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось создать сделку');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && <p className="text-sm text-red-500 bg-red-50 p-3 rounded-lg">{error}</p>}
      <div>
        <label className="block text-sm font-medium text-slate-700">Название*</label>
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-sky-500 focus:ring-sky-500"
          placeholder="Страхование автопарка"
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-slate-700">Клиент*</label>
        <select
          value={clientId}
          onChange={(e) => setClientId(e.target.value)}
          className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-sky-500 focus:ring-sky-500"
        >
          {clients.map((client) => (
            <option key={client.id} value={client.id}>
              {client.name}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label className="block text-sm font-medium text-slate-700">Исполнитель</label>
        <select
          value={executorId}
          onChange={(e) => setExecutorId(e.target.value)}
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
          onChange={(e) => setDescription(e.target.value)}
          rows={3}
          className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-sky-500 focus:ring-sky-500"
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-slate-700">Источник</label>
        <input
          type="text"
          value={source}
          onChange={(e) => setSource(e.target.value)}
          className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-sky-500 focus:ring-sky-500"
          placeholder="Источник сделки"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-slate-700">Ожидаемая дата закрытия</label>
        <input
          type="date"
          value={expectedClose}
          onChange={(e) => setExpectedClose(e.target.value)}
          className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-sky-500 focus:ring-sky-500"
        />
      </div>
      <button
        type="submit"
        disabled={isSubmitting || !clients.length}
        className="w-full bg-sky-600 text-white rounded-lg py-2 font-semibold text-sm disabled:opacity-60"
      >
        {isSubmitting ? 'Создаем...' : 'Создать сделку'}
      </button>
    </form>
  );
};
