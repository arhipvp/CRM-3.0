import React, { useState, useRef, useEffect } from 'react';
import { Policy, Quote, Payment, Client } from '../types';

interface AddPolicyFormProps {
  sourceQuote?: Quote;
  dealClientId: string;
  clients: Client[];
  onAddPolicy: (dealId: string, policyData: Omit<Policy, 'id' | 'clientId' | 'dealId'>, installments: Array<Omit<Payment, 'id' | 'clientId' | 'policyId' | 'status'>>, policyClientId: string) => void;
  onClose: () => void;
}

const POLICY_TYPES: Policy['type'][] = ['Авто', 'Имущество', 'Жизнь', 'Здоровье'];

export const AddPolicyForm: React.FC<AddPolicyFormProps> = ({ sourceQuote, dealClientId, clients, onAddPolicy, onClose }) => {
  const [policyNumber, setPolicyNumber] = useState('');
  const [type, setType] = useState<Policy['type']>(sourceQuote?.insuranceType === 'КАСКО' ? 'Авто' : 'Имущество');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [counterparty, setCounterparty] = useState(sourceQuote?.insurer || '');
  const [salesChannel, setSalesChannel] = useState('');
  const [carBrand, setCarBrand] = useState('');
  const [carModel, setCarModel] = useState('');
  const [vin, setVin] = useState('');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState('');

  const [installments, setInstallments] = useState([{ amount: sourceQuote?.premium.toString() || '', dueDate: '' }]);
  
  const [policyClientId, setPolicyClientId] = useState(dealClientId);
  const [isClientSelectorOpen, setClientSelectorOpen] = useState(false);
  const [clientSearchQuery, setClientSearchQuery] = useState('');
  const clientSelectorRef = useRef<HTMLDivElement>(null);
  
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
        if (clientSelectorRef.current && !clientSelectorRef.current.contains(event.target as Node)) {
            setClientSelectorOpen(false);
            setClientSearchQuery('');
        }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleClientSelect = (id: string) => {
    setPolicyClientId(id);
    setClientSelectorOpen(false);
    setClientSearchQuery('');
  };

  const selectedClientName = clients.find(c => c.id === policyClientId)?.name || 'Выберите клиента';

  const filteredClients = clients.filter(c =>
    c.name.toLowerCase().includes(clientSearchQuery.toLowerCase())
  );

  const handleInstallmentChange = (index: number, field: 'amount' | 'dueDate', value: string) => {
    const newInstallments = [...installments];
    newInstallments[index][field] = value;
    setInstallments(newInstallments);
  };

  const handleAddInstallment = () => {
    setInstallments([...installments, { amount: '', dueDate: '' }]);
  };

  const handleRemoveInstallment = (index: number) => {
    const newInstallments = installments.filter((_, i) => i !== index);
    setInstallments(newInstallments);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!policyClientId || !policyNumber.trim() || !counterparty.trim() || !salesChannel.trim() || !startDate || !endDate) {
      setError('Пожалуйста, заполните обязательные поля: Клиент, Номер полиса, Контрагент, Канал продажи и Период действия.');
      return;
    }

    const cleanedInstallments = installments
        .map(inst => ({...inst, amount: parseFloat(inst.amount) || 0}))
        .filter(inst => inst.amount > 0 && inst.dueDate);

    onAddPolicy('', { // dealId is handled by the parent component
      policyNumber,
      type,
      startDate,
      endDate,
      counterparty,
      salesChannel,
      carBrand: type === 'Авто' ? carBrand : undefined,
      carModel: type === 'Авто' ? carModel : undefined,
      vin: type === 'Авто' ? vin : undefined,
      notes,
    }, cleanedInstallments, policyClientId);
    onClose();
  };
  
  const inputStyle = "block w-full rounded-md border-slate-300 shadow-sm focus:border-sky-500 focus:ring focus:ring-sky-200 focus:ring-opacity-50 text-sm disabled:bg-slate-100 disabled:text-slate-500";
  const labelStyle = "text-sm font-medium text-slate-600";

  return (
    <div className="fixed inset-0 bg-black/30 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <form onSubmit={handleSubmit} className="bg-white rounded-lg shadow-xl max-w-2xl w-full p-6" onClick={e => e.stopPropagation()}>
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold text-slate-800">Добавить новый полис</h2>
          <button type="button" onClick={onClose} className="p-1 rounded-full text-slate-400 hover:bg-slate-100">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        
        <div className="max-h-[75vh] overflow-y-auto pr-2 space-y-4">
            {error && <p className="text-red-500 text-sm bg-red-50 p-3 rounded-md">{error}</p>}
            
            <div className="space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-3 items-center gap-x-4 gap-y-1">
                    <label htmlFor="policyClient" className={labelStyle}>Клиент (Страхователь)*</label>
                    <div className="relative sm:col-span-2" ref={clientSelectorRef}>
                        <button
                            type="button"
                            id="policyClient"
                            onClick={() => setClientSelectorOpen(!isClientSelectorOpen)}
                            className={`${inputStyle} text-left`}
                            aria-haspopup="listbox"
                            aria-expanded={isClientSelectorOpen}
                        >
                            <span className="truncate">{selectedClientName}</span>
                        </button>
                        {isClientSelectorOpen && (
                            <div className="absolute z-10 mt-1 w-full bg-white rounded-md shadow-lg border border-slate-200 max-h-60 overflow-auto">
                                <div className="p-2 border-b border-slate-200">
                                    <input
                                        type="text"
                                        placeholder="Поиск клиента..."
                                        autoFocus
                                        value={clientSearchQuery}
                                        onChange={(e) => setClientSearchQuery(e.target.value)}
                                        className="w-full bg-slate-50 border-slate-200 rounded-md text-sm p-2 focus:ring-2 focus:ring-sky-500 focus:border-sky-500"
                                    />
                                </div>
                                <ul className="text-sm py-1" role="listbox">
                                    {filteredClients.length > 0 ? (
                                      filteredClients.map(client => (
                                        <li
                                            key={client.id}
                                            onClick={() => handleClientSelect(client.id)}
                                            className={`cursor-pointer select-none relative py-2 pl-3 pr-9 transition-colors ${
                                                client.id === policyClientId
                                                    ? 'text-white bg-sky-600'
                                                    : 'text-slate-900 hover:bg-slate-100'
                                            }`}
                                            role="option"
                                            aria-selected={client.id === policyClientId}
                                        >
                                            <span className="font-normal block truncate">{client.name}</span>
                                            {client.id === policyClientId && (
                                                <span className="text-white absolute inset-y-0 right-0 flex items-center pr-4">
                                                    <svg className="h-5 w-5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                                                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                                    </svg>
                                                </span>
                                            )}
                                        </li>
                                    ))) : (
                                      <li className="px-3 py-2 text-sm text-slate-500">Клиенты не найдены.</li>
                                    )}
                                </ul>
                            </div>
                        )}
                    </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 items-center gap-x-4 gap-y-1">
                    <label htmlFor="policyNumber" className={labelStyle}>Номер полиса*</label>
                    <input type="text" id="policyNumber" value={policyNumber} onChange={(e) => setPolicyNumber(e.target.value)} className={`${inputStyle} sm:col-span-2`} />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 items-center gap-x-4 gap-y-1">
                    <label htmlFor="type" className={labelStyle}>Тип</label>
                    <select id="type" value={type} onChange={(e) => setType(e.target.value as Policy['type'])} className={`${inputStyle} sm:col-span-2`}>
                        {POLICY_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                    </select>
                </div>
                 <div className="grid grid-cols-1 sm:grid-cols-3 items-center gap-x-4 gap-y-1">
                    <label htmlFor="startDate" className={labelStyle}>Период действия*</label>
                    <div className="grid grid-cols-2 gap-2 sm:col-span-2">
                        <input type="date" id="startDate" value={startDate} onChange={(e) => setStartDate(e.target.value)} className={inputStyle} />
                        <input type="date" id="endDate" value={endDate} onChange={(e) => setEndDate(e.target.value)} className={inputStyle} />
                    </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 items-center gap-x-4 gap-y-1">
                    <label htmlFor="counterparty" className={labelStyle}>Контрагент*</label>
                    <input type="text" id="counterparty" value={counterparty} onChange={(e) => setCounterparty(e.target.value)} className={`${inputStyle} sm:col-span-2`} readOnly={!!sourceQuote} placeholder="напр., Ингосстрах" />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 items-center gap-x-4 gap-y-1">
                    <label htmlFor="salesChannel" className={labelStyle}>Канал продажи*</label>
                    <input type="text" id="salesChannel" value={salesChannel} onChange={(e) => setSalesChannel(e.target.value)} className={`${inputStyle} sm:col-span-2`} placeholder="напр., Прямые продажи" />
                </div>
            </div>

            {type === 'Авто' && (
                <div className="pt-4 mt-4 border-t border-slate-200">
                    <h3 className="text-md font-semibold text-slate-700 mb-3">Данные по автомобилю</h3>
                     <div className="space-y-3">
                        <div className="grid grid-cols-1 sm:grid-cols-3 items-center gap-x-4 gap-y-1">
                           <label htmlFor="carBrand" className={labelStyle}>Марка</label>
                           <input type="text" id="carBrand" value={carBrand} onChange={(e) => setCarBrand(e.target.value)} className={`${inputStyle} sm:col-span-2`} />
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-3 items-center gap-x-4 gap-y-1">
                           <label htmlFor="carModel" className={labelStyle}>Модель</label>
                           <input type="text" id="carModel" value={carModel} onChange={(e) => setCarModel(e.target.value)} className={`${inputStyle} sm:col-span-2`} />
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-3 items-center gap-x-4 gap-y-1">
                           <label htmlFor="vin" className={labelStyle}>VIN</label>
                           <input type="text" id="vin" value={vin} onChange={(e) => setVin(e.target.value)} className={`${inputStyle} sm:col-span-2`} />
                        </div>
                     </div>
                </div>
            )}

            <div className="pt-4 mt-4 border-t border-slate-200">
                <h3 className="text-md font-semibold text-slate-700 mb-3">График платежей</h3>
                <div className="space-y-2">
                    {installments.map((inst, index) => (
                        <div key={index} className="flex items-center gap-2">
                            <input type="number" value={inst.amount} onChange={e => handleInstallmentChange(index, 'amount', e.target.value)} placeholder="Сумма" className={inputStyle} />
                            <input type="date" value={inst.dueDate} onChange={e => handleInstallmentChange(index, 'dueDate', e.target.value)} className={inputStyle} />
                            <button type="button" onClick={() => handleRemoveInstallment(index)} className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-100 rounded-full flex-shrink-0" title="Удалить платеж">
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                            </button>
                        </div>
                    ))}
                </div>
                <button type="button" onClick={handleAddInstallment} className="mt-2 text-sm text-sky-600 font-semibold hover:text-sky-800">+ Добавить платеж</button>
            </div>
            
            <div className="pt-4 mt-4 border-t border-slate-200">
                 <div className="grid grid-cols-1 sm:grid-cols-3 gap-x-4">
                    <label htmlFor="policy-notes" className={`${labelStyle} pt-1`}>Примечание</label>
                    <textarea id="policy-notes" value={notes} onChange={(e) => setNotes(e.target.value)} className={`${inputStyle} sm:col-span-2`} rows={3} placeholder="Любая дополнительная информация по полису..."></textarea>
                 </div>
            </div>
        </div>

        <div className="flex justify-end pt-4 space-x-2 border-t border-slate-200 mt-4">
          <button type="button" onClick={onClose} className="px-4 py-2 text-sm font-medium text-slate-700 bg-slate-100 rounded-lg hover:bg-slate-200">Отмена</button>
          <button type="submit" className="px-4 py-2 text-sm font-medium text-white bg-sky-600 rounded-lg hover:bg-sky-700">Сохранить полис</button>
        </div>
      </form>
    </div>
  );
};