import React, { useState } from 'react';
import { Payment } from '../types';

interface AddPaymentFormProps {
  policyId: string;
  onAddPayment: (paymentData: Omit<Payment, 'id' | 'clientId' | 'policyId'>) => void;
  onClose: () => void;
}

const PAYMENT_STATUSES: Payment['status'][] = ['Ожидает', 'Оплачен', 'Просрочен'];

export const AddPaymentForm: React.FC<AddPaymentFormProps> = ({ policyId, onAddPayment, onClose }) => {
  const [amount, setAmount] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [status, setStatus] = useState<Payment['status']>('Ожидает');
  const [error, setError] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!amount || !dueDate) {
      setError('Пожалуйста, заполните все обязательные поля: Сумма и Срок оплаты.');
      return;
    }
    onAddPayment({
      amount: parseFloat(amount) || 0,
      dueDate,
      status,
    });
    onClose();
  };
  
  const inputStyle = "mt-1 block w-full rounded-md border-slate-300 shadow-sm focus:border-sky-500 focus:ring focus:ring-sky-200 focus:ring-opacity-50 text-sm";
  const labelStyle = "block text-sm font-medium text-slate-700";

  return (
    <div className="fixed inset-0 bg-black/30 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <form onSubmit={handleSubmit} className="bg-white rounded-lg shadow-xl max-w-md w-full p-6 space-y-4" onClick={e => e.stopPropagation()}>
        <div className="flex justify-between items-center">
          <h2 className="text-xl font-bold text-slate-800">Добавить платеж</h2>
          <button type="button" onClick={onClose} className="p-1 rounded-full text-slate-400 hover:bg-slate-100">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <p className="text-sm text-slate-500">ID полиса: {policyId}</p>
        {error && <p className="text-red-500 text-sm">{error}</p>}
        
        <div className="space-y-4">
          <div>
            <label htmlFor="amount" className={labelStyle}>Сумма*</label>
            <input type="number" id="amount" placeholder="10000" value={amount} onChange={(e) => setAmount(e.target.value)} className={inputStyle} />
          </div>
          <div>
            <label htmlFor="dueDate" className={labelStyle}>Срок оплаты*</label>
            <input type="date" id="dueDate" value={dueDate} onChange={(e) => setDueDate(e.target.value)} className={inputStyle} />
          </div>
          <div>
            <label htmlFor="status" className={labelStyle}>Статус</label>
            <select id="status" value={status} onChange={(e) => setStatus(e.target.value as Payment['status'])} className={inputStyle}>
              {PAYMENT_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
        </div>

        <div className="flex justify-end pt-4 space-x-2">
          <button type="button" onClick={onClose} className="px-4 py-2 text-sm font-medium text-slate-700 bg-slate-100 rounded-lg hover:bg-slate-200">Отмена</button>
          <button type="submit" className="px-4 py-2 text-sm font-medium text-white bg-sky-600 rounded-lg hover:bg-sky-700">Добавить</button>
        </div>
      </form>
    </div>
  );
};
