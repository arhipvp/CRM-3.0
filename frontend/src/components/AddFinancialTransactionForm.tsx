import React, { useState } from 'react';
import { FinancialTransaction, FinancialTransactionType, Policy } from '../types';

interface AddFinancialTransactionFormProps {
  dealId?: string; // Optional, if adding from a specific deal
  policies: Policy[];
  onAddTransaction: (transactionData: Omit<FinancialTransaction, 'id'>) => void;
  onClose: () => void;
}

export const AddFinancialTransactionForm: React.FC<AddFinancialTransactionFormProps> = ({ dealId, policies, onAddTransaction, onClose }) => {
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [type, setType] = useState<FinancialTransactionType>('Доход');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [policyId, setPolicyId] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!description.trim() || !amount || !date) {
      setError('Пожалуйста, заполните все обязательные поля.');
      return;
    }
    onAddTransaction({
      description,
      amount: parseFloat(amount) || 0,
      type,
      date,
      dealId: policyId ? policies.find(p => p.id === policyId)?.dealId : dealId,
      policyId: policyId || undefined,
    });
    onClose();
  };
  
  const inputStyle = "mt-1 block w-full rounded-md border-slate-300 shadow-sm focus:border-sky-500 focus:ring focus:ring-sky-200 focus:ring-opacity-50 text-sm";
  const labelStyle = "block text-sm font-medium text-slate-700";

  return (
    <div className="fixed inset-0 bg-black/30 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <form onSubmit={handleSubmit} className="bg-white rounded-lg shadow-xl max-w-md w-full p-6 space-y-4" onClick={e => e.stopPropagation()}>
        <div className="flex justify-between items-center">
          <h2 className="text-xl font-bold text-slate-800">Добавить фин. операцию</h2>
          <button type="button" onClick={onClose} className="p-1 rounded-full text-slate-400 hover:bg-slate-100">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        {error && <p className="text-red-500 text-sm">{error}</p>}
        
        <div className="space-y-4">
          <div>
            <label className={labelStyle}>Тип операции</label>
            <div className="mt-2 flex rounded-md shadow-sm">
                <button type="button" onClick={() => setType('Доход')} className={`px-4 py-2 text-sm font-medium border border-slate-300 rounded-l-md w-full ${type === 'Доход' ? 'bg-sky-600 text-white border-sky-600 z-10' : 'bg-white hover:bg-slate-50'}`}>Доход</button>
                <button type="button" onClick={() => setType('Расход')} className={`-ml-px px-4 py-2 text-sm font-medium border border-slate-300 rounded-r-md w-full ${type === 'Расход' ? 'bg-sky-600 text-white border-sky-600 z-10' : 'bg-white hover:bg-slate-50'}`}>Расход</button>
            </div>
          </div>
          <div>
            <label htmlFor="description" className={labelStyle}>Описание*</label>
            <input type="text" id="description" value={description} onChange={(e) => setDescription(e.target.value)} className={inputStyle} placeholder="напр., Комиссия от страховой" />
          </div>
          <div className="grid grid-cols-2 gap-4">
             <div>
                <label htmlFor="amount" className={labelStyle}>Сумма*</label>
                <input type="number" id="amount" placeholder="10000" value={amount} onChange={(e) => setAmount(e.target.value)} className={inputStyle} />
             </div>
             <div>
                <label htmlFor="date" className={labelStyle}>Плановая дата*</label>
                <input type="date" id="date" value={date} onChange={(e) => setDate(e.target.value)} className={inputStyle} />
              </div>
          </div>
          <div>
            <label htmlFor="policyId" className={labelStyle}>Привязать к полису (опционально)</label>
            <select id="policyId" value={policyId} onChange={(e) => setPolicyId(e.target.value)} className={inputStyle}>
                <option value="">Без привязки</option>
                {policies.map(p => <option key={p.id} value={p.id}>{p.policyNumber} ({p.counterparty})</option>)}
            </select>
          </div>
        </div>

        <div className="flex justify-end pt-4 space-x-2">
          <button type="button" onClick={onClose} className="px-4 py-2 text-sm font-medium text-slate-700 bg-slate-100 rounded-lg hover:bg-slate-200">Отмена</button>
          <button type="submit" className="px-4 py-2 text-sm font-medium text-white bg-sky-600 rounded-lg hover:bg-sky-700">Сохранить</button>
        </div>
      </form>
    </div>
  );
};