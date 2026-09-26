import React, { useState } from 'react';
import type { Client } from '../../types';
import { useClientLookup } from '../../hooks/useClientLookup';
import { formatErrorMessage } from '../../utils/formatErrorMessage';
import { Combobox } from '../common/forms/Combobox';
import { DateInput } from '../common/forms/DateInput';
import { FormActions } from '../common/forms/FormActions';
import { FormError } from '../common/forms/FormError';
import { FormField } from '../common/forms/FormField';

interface ClientFormProps {
  clients?: Client[];
  initial?: {
    id?: string;
    name: string;
    isCounterparty?: boolean;
    referredBy?: string | null;
    referredByName?: string | null;
    referredByDeleted?: boolean;
    phone?: string;
    email?: string | null;
    birthDate?: string | null;
    sex?: string;
    birthPlace?: string;
    registrationAddress?: string;
    notes?: string | null;
  };
  onSubmit: (data: {
    name: string;
    isCounterparty?: boolean;
    referredBy?: string | null;
    phone?: string;
    email?: string | null;
    birthDate?: string | null;
    sex?: string;
    birthPlace?: string;
    registrationAddress?: string;
    notes?: string | null;
  }) => Promise<void>;
  submitLabel?: string;
}

export const ClientForm: React.FC<ClientFormProps> = ({
  initial,
  clients = [],
  onSubmit,
  submitLabel = 'Сохранить',
}) => {
  const [name, setName] = useState(initial?.name ?? '');
  const [isCounterparty, setIsCounterparty] = useState(initial?.isCounterparty ?? false);
  const [referredBy, setReferredBy] = useState(initial?.referredBy ?? null);
  const [referrerQuery, setReferrerQuery] = useState(initial?.referredByName ?? '');
  const [showReferrers, setShowReferrers] = useState(false);
  const referrerCandidates = useClientLookup(referrerQuery, clients).filter(
    (client) =>
      client.id !== initial?.id &&
      !client.deletedAt &&
      client.name.toLocaleLowerCase().includes(referrerQuery.trim().toLocaleLowerCase()),
  );
  const [phone, setPhone] = useState(initial?.phone ?? '');
  const [email, setEmail] = useState(initial?.email ?? '');
  const [birthDate, setBirthDate] = useState(initial?.birthDate ?? '');
  const [sex, setSex] = useState(initial?.sex ?? '');
  const [birthPlace, setBirthPlace] = useState(initial?.birthPlace ?? '');
  const [registrationAddress, setRegistrationAddress] = useState(
    initial?.registrationAddress ?? '',
  );
  const [notes, setNotes] = useState(initial?.notes ?? '');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setSubmitting] = useState(false);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!name.trim()) {
      setError('Имя клиента обязательно.');
      return;
    }
    if (referrerQuery.trim() && !referredBy) {
      setError('Выберите рекомендателя из списка или очистите поле «Клиент от…».');
      return;
    }
    setError(null);
    setSubmitting(true);
    try {
      await onSubmit({
        name: name.trim(),
        isCounterparty,
        referredBy,
        phone: phone.trim() || undefined,
        email: email.trim() || null,
        birthDate: birthDate || null,
        sex,
        birthPlace,
        registrationAddress,
        notes: notes.trim() || undefined,
      });
    } catch (err) {
      setError(formatErrorMessage(err, 'Не удалось сохранить клиента.'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="app-panel p-6 shadow-none space-y-6">
      <FormError message={error} />

      <FormField label="Имя" required>
        <input
          type="text"
          value={name}
          onChange={(event) => setName(event.target.value)}
          className="field field-input"
          placeholder='Например: "Иван Иванов"'
        />
      </FormField>

      <FormField label="E-mail">
        <input
          type="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          className="field field-input"
          placeholder="client@example.ru"
        />
      </FormField>

      <FormField label="Телефон">
        <input
          type="tel"
          value={phone}
          onChange={(event) => setPhone(event.target.value)}
          className="field field-input"
          placeholder="+7 (900) 000-00-00"
        />
      </FormField>

      <FormField label="Статус">
        <label className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
          <input
            type="checkbox"
            checked={isCounterparty}
            onChange={(event) => setIsCounterparty(event.target.checked)}
            className="h-4 w-4 rounded border-slate-300 text-sky-600 focus:ring-sky-500"
          />
          <span>Клиент является контрагентом</span>
        </label>
      </FormField>

      <FormField label="Клиент от…" htmlFor="client-referrer">
        <div className="flex items-center gap-2">
          <Combobox
            id="client-referrer"
            value={referrerQuery}
            options={referrerCandidates.slice(0, 20)}
            isOpen={showReferrers}
            onOpen={() => setShowReferrers(true)}
            onClose={() => setShowReferrers(false)}
            onChange={(value) => {
              setReferrerQuery(value);
              setReferredBy(null);
            }}
            onSelect={(client) => {
              setReferredBy(client.id);
              setReferrerQuery(client.name);
              setShowReferrers(false);
            }}
            getOptionKey={(client) => client.id}
            getOptionLabel={(client) => client.name}
            placeholder="Начните вводить имя рекомендателя"
            emptyMessage="Клиент не найден"
          />
          {(referredBy || referrerQuery) && (
            <button
              type="button"
              className="text-sm text-slate-600 hover:text-slate-900"
              onClick={() => {
                setReferredBy(null);
                setReferrerQuery('');
              }}
            >
              Очистить рекомендателя
            </button>
          )}
        </div>
        {referredBy && referredBy === initial?.referredBy && initial.referredByDeleted && (
          <p className="mt-2 text-sm text-amber-700">
            Рекомендатель удалён. Вознаграждение по новым полисам не создаётся.
          </p>
        )}
      </FormField>

      <FormField label="Дата рождения">
        <DateInput
          value={birthDate ?? ''}
          onChange={(event) => setBirthDate(event.target.value)}
          className="field field-input"
        />
      </FormField>

      <FormField label="Пол" htmlFor="client-sex">
        <select
          id="client-sex"
          className="field field-input"
          value={sex}
          onChange={(e) => setSex(e.target.value)}
        >
          <option value="">Не указан</option>
          <option value="male">Мужской</option>
          <option value="female">Женский</option>
        </select>
      </FormField>
      <FormField label="Место рождения" htmlFor="client-birth-place">
        <input
          id="client-birth-place"
          className="field field-input"
          value={birthPlace}
          onChange={(e) => setBirthPlace(e.target.value)}
        />
      </FormField>
      <FormField label="Адрес прописки" htmlFor="client-registration-address">
        <input
          id="client-registration-address"
          className="field field-input"
          value={registrationAddress}
          onChange={(e) => setRegistrationAddress(e.target.value)}
        />
      </FormField>
      <FormField label="Примечание">
        <textarea
          value={notes}
          onChange={(event) => setNotes(event.target.value)}
          rows={3}
          className="field-textarea"
          placeholder="Дополнительная информация по клиенту"
        />
      </FormField>

      <FormActions
        isSubmitting={isSubmitting}
        submitLabel={submitLabel}
        submitVariant="primary"
        submitSize="block"
      />
    </form>
  );
};
