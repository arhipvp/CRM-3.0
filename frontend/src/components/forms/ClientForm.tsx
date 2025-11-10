import React, { useState } from "react";

interface ClientFormProps {
  initial?: { name: string; phone?: string; birthDate?: string | null };
  onSubmit: (data: { name: string; phone?: string; birthDate?: string | null }) => Promise<void>;
  submitLabel?: string;
}

export const ClientForm: React.FC<ClientFormProps> = ({ initial, onSubmit, submitLabel = "Сохранить" }) => {
  const [name, setName] = useState(initial?.name ?? "");
  const [phone, setPhone] = useState(initial?.phone ?? "");
  const [birthDate, setBirthDate] = useState(initial?.birthDate ?? "");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setSubmitting] = useState(false);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!name.trim()) {
      setError("Имя обязательно");
      return;
    }
    setError(null);
    setSubmitting(true);
    try {
      await onSubmit({ name: name.trim(), phone: phone.trim() || undefined, birthDate: birthDate || null });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Не удалось сохранить клиента");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && <p className="text-sm text-red-500 bg-red-50 p-3 rounded-lg">{error}</p>}
      <div>
        <label className="block text-sm font-medium text-slate-700">Имя*</label>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-sky-500 focus:ring-sky-500"
          placeholder="ООО «Ромашка»"
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-slate-700">Телефон</label>
        <input
          type="tel"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-sky-500 focus:ring-sky-500"
          placeholder="+7 (900) 000-00-00"
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-slate-700">Дата рождения</label>
        <input
          type="date"
          value={birthDate ?? ""}
          onChange={(e) => setBirthDate(e.target.value)}
          className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-sky-500 focus:ring-sky-500"
        />
      </div>
      <button
        type="submit"
        disabled={isSubmitting}
        className="w-full bg-sky-600 text-white rounded-lg py-2 font-semibold text-sm disabled:opacity-60"
      >
        {isSubmitting ? "Сохраняем..." : submitLabel}
      </button>
    </form>
  );
};
