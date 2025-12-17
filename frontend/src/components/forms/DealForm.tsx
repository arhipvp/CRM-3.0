import React, { useEffect, useMemo, useState } from 'react';
import type { Client, User } from '../../types';
import { formatErrorMessage } from '../../utils/formatErrorMessage';

const MAX_CLIENT_SUGGESTIONS = 6;

export interface DealFormValues {
  title: string;
  clientId: string;
  description?: string;
  expectedClose?: string | null;
  executorId?: string | null;
  source?: string | null;
  sellerId?: string | null;
  nextContactDate?: string | null;
}

interface QuickNextContactOption {
  label: string;
  days: number;
}

interface DealFormProps {
  clients: Client[];
  users: User[];
  defaultExecutorId?: string | null;
  initialValues?: Partial<DealFormValues>;
  mode?: 'create' | 'edit';
  onSubmit: (data: DealFormValues) => Promise<void>;
  preselectedClientId?: string | null;
  onPreselectedClientConsumed?: () => void;
  onRequestAddClient?: () => void;
  onQuickNextContactShift?: (newNextContactDate: string) => Promise<void>;
  showAddClientButton?: boolean;
  showSellerField?: boolean;
  showNextContactField?: boolean;
  quickNextContactOptions?: QuickNextContactOption[];
  expectedCloseRequired?: boolean;
  expectedCloseLabel?: string;
  nextContactLabel?: string;
  submitLabel?: string;
  submittingLabel?: string;
  submitErrorMessage?: string;
}

const DEFAULT_QUICK_NEXT_CONTACT_OPTIONS: QuickNextContactOption[] = [
  { label: 'завтра', days: 1 },
  { label: '+2 дня', days: 2 },
  { label: '+5 дней', days: 5 },
];

const parseDateValue = (value?: string | null) => {
  if (!value) {
    return new Date();
  }
  const [year, month, day] = value.split('-').map((segment) => Number(segment));
  if ([year, month, day].some((segment) => Number.isNaN(segment))) {
    return new Date();
  }
  return new Date(year, month - 1, day);
};

const formatDateForInput = (value: Date) => {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, '0');
  const day = String(value.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const getUserFullName = (user: User) => {
  const fullName = [user.firstName, user.lastName].filter(Boolean).join(' ').trim();
  return fullName || user.username;
};

export const DealForm: React.FC<DealFormProps> = ({
  clients,
  users,
  defaultExecutorId,
  initialValues,
  mode = 'create',
  onSubmit,
  preselectedClientId,
  onPreselectedClientConsumed,
  onRequestAddClient,
  onQuickNextContactShift,
  showAddClientButton = true,
  showSellerField = false,
  showNextContactField = false,
  quickNextContactOptions,
  expectedCloseRequired = false,
  expectedCloseLabel,
  nextContactLabel = 'Следующий контакт',
  submitLabel,
  submittingLabel,
  submitErrorMessage,
}) => {
  const clientsById = useMemo(() => {
    const map = new Map<string, Client>();
    clients.forEach((client) => {
      map.set(client.id, client);
    });
    return map;
  }, [clients]);

  const initialTitle = initialValues?.title ?? '';
  const initialDescription = initialValues?.description ?? '';
  const initialSource = initialValues?.source ?? '';
  const initialExpectedClose = initialValues?.expectedClose ?? '';
  const initialExecutorId = initialValues?.executorId ?? defaultExecutorId ?? '';
  const initialSellerId = initialValues?.sellerId ?? '';
  const initialNextContactDate = initialValues?.nextContactDate ?? '';
  const initialClientId =
    initialValues?.clientId ?? preselectedClientId ?? clients[0]?.id ?? '';
  const initialClientQuery = initialClientId
    ? clientsById.get(initialClientId)?.name ?? clients[0]?.name ?? ''
    : clients[0]?.name ?? '';

  const [title, setTitle] = useState(initialTitle);
  const [clientId, setClientId] = useState(initialClientId);
  const [clientQuery, setClientQuery] = useState(initialClientQuery);
  const [description, setDescription] = useState(initialDescription);
  const [source, setSource] = useState(initialSource);
  const [expectedClose, setExpectedClose] = useState(initialExpectedClose);
  const [executorId, setExecutorId] = useState(initialExecutorId);
  const [sellerId, setSellerId] = useState(initialSellerId);
  const [nextContactDate, setNextContactDate] = useState(initialNextContactDate);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setSubmitting] = useState(false);
  const [isQuickSaving, setIsQuickSaving] = useState(false);
  const [showClientSuggestions, setShowClientSuggestions] = useState(false);

  useEffect(() => {
    setTitle(initialTitle);
  }, [initialTitle]);

  useEffect(() => {
    setDescription(initialDescription);
  }, [initialDescription]);

  useEffect(() => {
    setSource(initialSource);
  }, [initialSource]);

  useEffect(() => {
    setExpectedClose(initialExpectedClose);
  }, [initialExpectedClose]);

  useEffect(() => {
    if (initialValues?.executorId !== undefined) {
      setExecutorId(initialValues.executorId ?? '');
      return;
    }
    setExecutorId(defaultExecutorId ?? '');
  }, [initialValues?.executorId, defaultExecutorId]);

  useEffect(() => {
    setSellerId(initialSellerId);
  }, [initialSellerId]);

  useEffect(() => {
    setNextContactDate(initialNextContactDate);
  }, [initialNextContactDate]);

  useEffect(() => {
    if (!initialValues?.clientId) {
      return;
    }
    setClientId(initialValues.clientId);
    setClientQuery(clientsById.get(initialValues.clientId)?.name ?? '');
  }, [clientsById, initialValues?.clientId]);

  useEffect(() => {
    if (!preselectedClientId || initialValues?.clientId) {
      return;
    }
    const preselected = clientsById.get(preselectedClientId);
    if (!preselected) {
      return;
    }
    setClientId(preselected.id);
    setClientQuery(preselected.name);
    onPreselectedClientConsumed?.();
  }, [
    clientsById,
    initialValues?.clientId,
    onPreselectedClientConsumed,
    preselectedClientId,
  ]);

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

  const handleClientSelect = (client: Client) => {
    setClientId(client.id);
    setClientQuery(client.name);
    setShowClientSuggestions(false);
  };

  const quickDateOptions = quickNextContactOptions ?? DEFAULT_QUICK_NEXT_CONTACT_OPTIONS;

  const handleQuickNextContact = async (days: number) => {
    if (isQuickSaving) {
      return;
    }
    setError(null);
    const baseDate = parseDateValue(nextContactDate);
    const targetDate = new Date(baseDate);
    targetDate.setDate(targetDate.getDate() + days);
    const nextValue = formatDateForInput(targetDate);
    setNextContactDate(nextValue);

    if (!onQuickNextContactShift) {
      return;
    }

    setIsQuickSaving(true);
    try {
      await onQuickNextContactShift(nextValue);
    } catch (err) {
      setError(formatErrorMessage(err, 'Не удалось быстро изменить дату следующего контакта.'));
    } finally {
      setIsQuickSaving(false);
    }
  };

  const shouldShowAddClient = showAddClientButton && Boolean(onRequestAddClient);
  const submitText = submitLabel ?? (mode === 'edit' ? 'Сохранить' : 'Создать сделку');
  const submittingText = submittingLabel ?? 'Сохраняем...';

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    const trimmedTitle = title.trim();
    const resolvedClient = resolveClientFromQuery();
    const selectedClientId = resolvedClient?.id ?? clientId;

    if (!trimmedTitle) {
      setError('Название сделки обязательно.');
      return;
    }
    if (!selectedClientId) {
      setError('Клиент обязателен.');
      return;
    }

    const payload: DealFormValues = {
      title: trimmedTitle,
      clientId: selectedClientId,
      description: description.trim() || undefined,
      expectedClose: expectedClose || null,
      executorId: executorId || undefined,
      source: source.trim(),
      ...(showSellerField ? { sellerId: sellerId || null } : {}),
      ...(showNextContactField ? { nextContactDate: nextContactDate || null } : {}),
    };

    setError(null);
    setSubmitting(true);
    try {
      if (resolvedClient) {
        setClientId(resolvedClient.id);
        setClientQuery(resolvedClient.name);
      }
      await onSubmit(payload);
    } catch (err) {
      setError(
        formatErrorMessage(
          err,
          submitErrorMessage ??
            (mode === 'edit' ? 'Не удалось обновить сделку.' : 'Не удалось создать сделку.')
        )
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && (
        <p className="app-alert app-alert-danger">{error}</p>
      )}

      <div>
        <label className="block text-sm font-semibold text-slate-700">
          Название *
        </label>
        <input
          type="text"
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          className="mt-1 field field-input"
          placeholder="Например: КАСКО / ОСАГО"
        />
      </div>

      <div>
        <label className="block text-sm font-semibold text-slate-700">Клиент *</label>
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
                className="field field-input"
                placeholder="Начните вводить имя клиента"
              />
              {showClientSuggestions && (
                <div className="absolute inset-x-0 top-full z-10 mt-1 max-h-44 overflow-y-auto rounded-xl border border-slate-200 bg-white shadow-lg">
                  {filteredClients.length ? (
                    filteredClients.slice(0, MAX_CLIENT_SUGGESTIONS).map((client) => (
                      <button
                        key={client.id}
                        type="button"
                        className="w-full px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-50"
                        onMouseDown={(event) => {
                          event.preventDefault();
                          handleClientSelect(client);
                        }}
                      >
                        {client.name}
                      </button>
                    ))
                  ) : (
                    <div className="px-3 py-2 text-sm text-slate-600">
                      Клиент не найден
                    </div>
                  )}
                </div>
              )}
            </div>

            {shouldShowAddClient && (
              <button
                type="button"
                onClick={onRequestAddClient}
                className="btn btn-secondary btn-sm rounded-xl"
              >
                + Клиент
              </button>
            )}
          </div>
        </div>
      </div>

      {showSellerField && (
        <div>
          <label className="block text-sm font-semibold text-slate-700">Ответственный</label>
          <select
            value={sellerId}
            onChange={(event) => setSellerId(event.target.value)}
            className="mt-1 field field-input"
          >
            <option value="">Не выбран</option>
            {users.map((user) => (
              <option key={user.id} value={user.id}>
                {getUserFullName(user)}
              </option>
            ))}
          </select>
        </div>
      )}

      <div>
        <label className="block text-sm font-semibold text-slate-700">Исполнитель</label>
        <select
          value={executorId}
          onChange={(event) => setExecutorId(event.target.value)}
          className="mt-1 field field-input"
        >
          <option value="">Не выбран</option>
          {users.map((user) => (
            <option key={user.id} value={user.id}>
              {getUserFullName(user)}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className="block text-sm font-semibold text-slate-700">Описание</label>
        <textarea
          value={description}
          onChange={(event) => setDescription(event.target.value)}
          rows={3}
          className="mt-1 field-textarea"
        />
      </div>

      <div>
        <label className="block text-sm font-semibold text-slate-700">Источник</label>
        <input
          type="text"
          value={source}
          onChange={(event) => setSource(event.target.value)}
          className="mt-1 field field-input"
          placeholder="Источник сделки"
        />
      </div>

      {showNextContactField && (
        <div className="space-y-2">
          <label className="block text-sm font-semibold text-slate-700">{nextContactLabel}</label>
          <input
            type="date"
            value={nextContactDate}
            onChange={(event) => setNextContactDate(event.target.value)}
            className="mt-1 field field-input"
          />
          <div className="mt-2 flex flex-wrap gap-2">
            {quickDateOptions.map((option) => (
              <button
                key={option.label}
                type="button"
                onClick={() => handleQuickNextContact(option.days)}
                disabled={isQuickSaving}
                className="btn btn-quiet btn-sm rounded-full"
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>
      )}

      <div>
        <label className="block text-sm font-semibold text-slate-700">
          {expectedCloseLabel ?? (expectedCloseRequired ? 'Крайний срок *' : 'Крайний срок')}
        </label>
        <input
          type="date"
          value={expectedClose}
          onChange={(event) => setExpectedClose(event.target.value)}
          className="mt-1 field field-input"
          required={expectedCloseRequired}
        />
      </div>

      <button
        type="submit"
        disabled={isSubmitting || clients.length === 0}
        className="btn btn-primary w-full rounded-xl"
      >
        {isSubmitting ? submittingText : submitText}
      </button>
    </form>
  );
};
