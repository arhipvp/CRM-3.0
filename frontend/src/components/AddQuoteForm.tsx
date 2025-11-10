import React, { useState } from 'react';
import { Quote } from '../types';

interface AddQuoteFormProps {
  onAddQuote: (quoteData: Omit<Quote, 'id'>) => void;
  onClose: () => void;
}

export const AddQuoteForm: React.FC<AddQuoteFormProps> = ({ onAddQuote, onClose }) => {
  const [insurer, setInsurer] = useState('');
  const [insuranceType, setInsuranceType] = useState('');
  const [sumInsured, setSumInsured] = useState('');
  const [premium, setPremium] = useState('');
  const [deductible, setDeductible] = useState('');
  const [comments, setComments] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!insurer || !premium || !sumInsured) {
      setError('Пожалуйста, заполните обязательные поля: Страховая компания, Страховая сумма и Премия.');
      return;
    }
    onAddQuote({
      insurer,
      insuranceType,
      sumInsured: parseFloat(sumInsured) || 0,
      premium: parseFloat(premium) || 0,
      deductible,
      comments,
    });
    onClose();
  };
  
  const inputStyle = "mt-1 block w-full rounded-md border-slate-300 shadow-sm focus:border-sky-500 focus:ring focus:ring-sky-200 focus:ring-opacity-50";

  return (
    <div className="fixed inset-0 bg-black/30 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <form onSubmit={handleSubmit} className="bg-white rounded-lg shadow-xl max-w-lg w-full p-6 space-y-4" onClick={e => e.stopPropagation()}>
        <div className="flex justify-between items-center">
          <h2 className="text-xl font-bold text-slate-800">Добавить расчет</h2>
          <button type="button" onClick={onClose} className="p-1 rounded-full text-slate-400 hover:bg-slate-100">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        {error && <p className="text-red-500 text-sm">{error}</p>}
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label htmlFor="insurer" className="block text-sm font-medium text-slate-700">Страховая компания*</label>
            <input type="text" id="insurer" value={insurer} onChange={(e) => setInsurer(e.target.value)} className={inputStyle} />
          </div>
          <div>
            <label htmlFor="insuranceType" className="block text-sm font-medium text-slate-700">Вид страхования</label>
            <input type="text" id="insuranceType" value={insuranceType} onChange={(e) => setInsuranceType(e.target.value)} className={inputStyle} />
          </div>
          <div>
            <label htmlFor="sumInsured" className="block text-sm font-medium text-slate-700">Страховая сумма*</label>
            <input type="number" id="sumInsured" placeholder="1000000" value={sumInsured} onChange={(e) => setSumInsured(e.target.value)} className={inputStyle} />
          </div>
          <div>
            <label htmlFor="premium" className="block text-sm font-medium text-slate-700">Премия*</label>
            <input type="number" id="premium" placeholder="50000" value={premium} onChange={(e) => setPremium(e.target.value)} className={inputStyle} />
          </div>
          <div className="md:col-span-2">
             <label htmlFor="deductible" className="block text-sm font-medium text-slate-700">Франшиза</label>
             <input type="text" id="deductible" placeholder="10 000 руб. или 5%" value={deductible} onChange={(e) => setDeductible(e.target.value)} className={inputStyle} />
          </div>
          <div className="md:col-span-2">
            <label htmlFor="comments" className="block text-sm font-medium text-slate-700">Комментарий</label>
            <textarea id="comments" value={comments} onChange={(e) => setComments(e.target.value)} className={inputStyle} rows={3}></textarea>
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