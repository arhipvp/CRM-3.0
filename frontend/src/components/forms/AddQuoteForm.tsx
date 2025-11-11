import React, { useState } from "react";

export interface QuoteFormValues {
  insurer: string;
  insuranceType: string;
  sumInsured: number;
  premium: number;
  deductible?: string;
  comments?: string;
}

interface AddQuoteFormProps {
  onSubmit: (values: QuoteFormValues) => Promise<void>;
  onCancel: () => void;
}

export const AddQuoteForm: React.FC<AddQuoteFormProps> = ({ onSubmit, onCancel }) => {
  const [insurer, setInsurer] = useState("");
  const [insuranceType, setInsuranceType] = useState("");
  const [sumInsured, setSumInsured] = useState("");
  const [premium, setPremium] = useState("");
  const [deductible, setDeductible] = useState("");
  const [comments, setComments] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setSubmitting] = useState(false);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!insurer.trim() || !insuranceType.trim() || !sumInsured || !premium) {
      setError("Заполните компанию, тип, сумму и премию");
      return;
    }
    setError(null);
    setSubmitting(true);
    try {
      await onSubmit({
        insurer: insurer.trim(),
        insuranceType: insuranceType.trim(),
        sumInsured: Number(sumInsured),
        premium: Number(premium),
        deductible: deductible.trim() || undefined,
        comments: comments.trim() || undefined,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Не удалось сохранить расчет");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && <p className="text-sm text-red-500 bg-red-50 p-3 rounded-lg">{error}</p>}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-slate-700">Страховая компания*</label>
          <input
            type="text"
            value={insurer}
            onChange={(e) => setInsurer(e.target.value)}
            className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-sky-500 focus:ring-sky-500"
            placeholder="Компания"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700">Тип страхования*</label>
          <input
            type="text"
            value={insuranceType}
            onChange={(e) => setInsuranceType(e.target.value)}
            className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-sky-500 focus:ring-sky-500"
            placeholder="КАСКО, ОСАГО и т.д."
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700">Страховая сумма, ₽*</label>
          <input
            type="number"
            min="0"
            step="0.01"
            value={sumInsured}
            onChange={(e) => setSumInsured(e.target.value)}
            className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-sky-500 focus:ring-sky-500"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700">Премия, ₽*</label>
          <input
            type="number"
            min="0"
            step="0.01"
            value={premium}
            onChange={(e) => setPremium(e.target.value)}
            className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-sky-500 focus:ring-sky-500"
          />
        </div>
      </div>
      <div>
        <label className="block text-sm font-medium text-slate-700">Франшиза</label>
        <input
          type="text"
          value={deductible}
          onChange={(e) => setDeductible(e.target.value)}
          className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-sky-500 focus:ring-sky-500"
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-slate-700">Комментарий</label>
        <textarea
          value={comments}
          onChange={(e) => setComments(e.target.value)}
          rows={3}
          className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-sky-500 focus:ring-sky-500"
        />
      </div>
      <div className="flex justify-end gap-3 pt-2">
        <button
          type="button"
          onClick={onCancel}
          className="px-4 py-2 text-sm font-medium text-slate-600 bg-slate-100 rounded-lg hover:bg-slate-200"
          disabled={isSubmitting}
        >
          Отмена
        </button>
        <button
          type="submit"
          disabled={isSubmitting}
          className="px-4 py-2 text-sm font-semibold text-white bg-sky-600 rounded-lg hover:bg-sky-700 disabled:opacity-60"
        >
          {isSubmitting ? "Сохраняем..." : "Сохранить"}
        </button>
      </div>
    </form>
  );
};
