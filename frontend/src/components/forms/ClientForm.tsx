import React, { useState } from 'react';
import { formatErrorMessage } from '../../utils/formatErrorMessage';
import { FormActions } from '../common/forms/FormActions';
import { FormError } from '../common/forms/FormError';
import { FormField } from '../common/forms/FormField';

interface ClientFormProps {
  initial?: {
    name: string;
    phone?: string;
    email?: string;
    birthDate?: string | null;
    notes?: string | null;
  };
  onSubmit: (data: {
    name: string;
    phone?: string;
    email?: string | null;
    birthDate?: string | null;
    notes?: string | null;
  }) => Promise<void>;
  submitLabel?: string;
}

export const ClientForm: React.FC<ClientFormProps> = ({
  initial,
  onSubmit,
  submitLabel = 'Сохранить',
}) => {
  const [name, setName] = useState(initial?.name ?? '');
  const [phone, setPhone] = useState(initial?.phone ?? '');
  const [email, setEmail] = useState(initial?.email ?? '');
  const [birthDate, setBirthDate] = useState(initial?.birthDate ?? '');
  const [notes, setNotes] = useState(initial?.notes ?? '');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setSubmitting] = useState(false);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!name.trim()) {
      setError('Имя клиента обязательно.');
      return;
    }
    setError(null);
    setSubmitting(true);
    try {
      await onSubmit({
        name: name.trim(),
        phone: phone.trim() || undefined,
        email: email.trim() || null,
        birthDate: birthDate || null,
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

      <FormField label="Дата рождения">
        <input
          type="date"
          value={birthDate ?? ''}
          onChange={(event) => setBirthDate(event.target.value)}
          className="field field-input"
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
        submitClassName="btn btn-primary w-full rounded-xl"
      />
    </form>
  );
};
