import React, { useState } from 'react';

export interface PolicyFormValues {
  number: string;
  insuranceCompany: string;
  insuranceType: string;
  vin?: string;
  startDate?: string | null;
  endDate?: string | null;
  amount: number;
  createPayment: boolean;
  paymentAmount?: number;
  paymentDescription?: string;
}

interface AddPolicyFormProps {
  onSubmit: (values: PolicyFormValues) => Promise<void>;
  onCancel: () => void;
}

export const AddPolicyForm: React.FC<AddPolicyFormProps> = ({ onSubmit, onCancel }) => {
  const [number, setNumber] = useState('');
  const [insuranceCompany, setInsuranceCompany] = useState('');
  const [insuranceType, setInsuranceType] = useState('');
  const [vin, setVin] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [amount, setAmount] = useState('');
  const [createPayment, setCreatePayment] = useState(false);
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentDescription, setPaymentDescription] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setSubmitting] = useState(false);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!number.trim() || !insuranceCompany.trim() || !insuranceType.trim() || !amount) {
      setError('Заполните номер полиса, компанию, тип и сумму');
      return;
    }
    setError(null);
    setSubmitting(true);
    try {
      await onSubmit({
        number: number.trim(),
        insuranceCompany: insuranceCompany.trim(),
        insuranceType: insuranceType.trim(),
        vin: vin.trim() || undefined,
        startDate: startDate || null,
        endDate: endDate || null,
        amount: Number(amount),
        createPayment,
        paymentAmount: createPayment ? Number(paymentAmount) : undefined,
        paymentDescription: createPayment ? paymentDescription.trim() : undefined,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось сохранить полис');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && <p className="text-sm text-red-500 bg-red-50 p-3 rounded-lg">{error}</p>}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-slate-700">Номер полиса*</label>
          <input
            type="text"
            value={number}
            onChange={(e) => setNumber(e.target.value)}
            className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-sky-500 focus:ring-sky-500"
            placeholder="001234567890"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700">Страховая компания*</label>
          <input
            type="text"
            value={insuranceCompany}
            onChange={(e) => setInsuranceCompany(e.target.value)}
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
          <label className="block text-sm font-medium text-slate-700">Сумма полиса, ₽*</label>
          <input
            type="number"
            min="0"
            step="0.01"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-sky-500 focus:ring-sky-500"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-slate-700">VIN</label>
          <input
            type="text"
            value={vin}
            onChange={(e) => setVin(e.target.value)}
            maxLength={17}
            className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-sky-500 focus:ring-sky-500"
            placeholder="Номер шасси (17 символов)"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-slate-700">Дата начала</label>
          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-sky-500 focus:ring-sky-500"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700">Дата окончания</label>
          <input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-sky-500 focus:ring-sky-500"
          />
        </div>
      </div>

      <div className="border-t border-slate-200 pt-4">
        <label className="flex items-center gap-3 cursor-pointer">
          <input
            type="checkbox"
            checked={createPayment}
            onChange={(e) => setCreatePayment(e.target.checked)}
            className="rounded border-slate-300"
          />
          <span className="text-sm font-medium text-slate-700">Создать платеж сразу</span>
        </label>

        {createPayment && (
          <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4 bg-sky-50 p-4 rounded-lg">
            <div>
              <label className="block text-sm font-medium text-slate-700">Сумма платежа, ₽*</label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={paymentAmount}
                onChange={(e) => setPaymentAmount(e.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-sky-500 focus:ring-sky-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700">Описание платежа</label>
              <input
                type="text"
                value={paymentDescription}
                onChange={(e) => setPaymentDescription(e.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-sky-500 focus:ring-sky-500"
                placeholder="Оплата по полису..."
              />
            </div>
          </div>
        )}
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
          {isSubmitting ? 'Сохраняем...' : 'Создать полис'}
        </button>
      </div>
    </form>
  );
};
