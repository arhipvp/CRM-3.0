import React, { useState } from 'react';
import { formatErrorMessage } from '../../utils/formatErrorMessage';

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
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && <p className="app-alert app-alert-danger">{error}</p>}

      <div>
        <label className="block text-sm font-semibold text-slate-700">Имя *</label>
        <input
          type="text"
          value={name}
          onChange={(event) => setName(event.target.value)}
          className="mt-1 field field-input"
          placeholder='Например: "Иван Иванов"'
        />
      </div>

      <div>
        <label className="block text-sm font-semibold text-slate-700">E-mail</label>
        <input
          type="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          className="mt-1 field field-input"
          placeholder="client@example.ru"
        />
      </div>

      <div>
        <label className="block text-sm font-semibold text-slate-700">Телефон</label>
        <input
          type="tel"
          value={phone}
          onChange={(event) => setPhone(event.target.value)}
          className="mt-1 field field-input"
          placeholder="+7 (900) 000-00-00"
        />
      </div>

      <div>
        <label className="block text-sm font-semibold text-slate-700">Дата рождения</label>
        <input
          type="date"
          value={birthDate ?? ''}
          onChange={(event) => setBirthDate(event.target.value)}
          className="mt-1 field field-input"
        />
      </div>

      <div>
        <label className="block text-sm font-semibold text-slate-700">Примечание</label>
        <textarea
          value={notes}
          onChange={(event) => setNotes(event.target.value)}
          rows={3}
          className="mt-1 field-textarea"
          placeholder="Дополнительная информация по клиенту"
        />
      </div>

      <button type="submit" disabled={isSubmitting} className="btn btn-primary w-full rounded-xl">
        {isSubmitting ? 'Сохраняем...' : submitLabel}
      </button>
    </form>
  );
};
