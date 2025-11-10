import React, { useState } from 'react';
import { Client } from '../types';

interface AddClientFormProps {
  onAddClient: (clientData: Omit<Client, 'id'>) => void;
  onClose: () => void;
}

export const AddClientForm: React.FC<AddClientFormProps> = ({ onAddClient, onClose }) => {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [notes, setNotes] = useState('');
  const [birthDate, setBirthDate] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !email.trim()) {
      setError('Имя и Email обязательны для заполнения.');
      return;
    }
    onAddClient({
      name,
      email,
      phone,
      address,
      notes,
      birthDate,
    });
  };

  const inputStyle = "mt-1 block w-full rounded-md border-slate-300 shadow-sm focus:border-sky-500 focus:ring focus:ring-sky-200 focus:ring-opacity-50";

  return (
    <form onSubmit={handleSubmit} className="p-6 space-y-4">
        <div className="flex justify-between items-center">
            <h2 className="text-xl font-bold text-slate-800">Добавить нового клиента</h2>
            <button type="button" onClick={onClose} className="p-1 rounded-full text-slate-400 hover:bg-slate-100">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
            </button>
        </div>
        {error && <p className="text-red-500 text-sm bg-red-50 p-3 rounded-md">{error}</p>}
        
        <div>
            <label htmlFor="client-name" className="block text-sm font-medium text-slate-700">Имя*</label>
            <input type="text" id="client-name" value={name} onChange={(e) => setName(e.target.value)} className={inputStyle} placeholder="ООО 'Ромашка' или Иван Иванов" />
        </div>
        <div>
            <label htmlFor="client-email" className="block text-sm font-medium text-slate-700">Email*</label>
            <input type="email" id="client-email" value={email} onChange={(e) => setEmail(e.target.value)} className={inputStyle} placeholder="contact@romashka.ru" />
        </div>
        <div>
            <label htmlFor="client-phone" className="block text-sm font-medium text-slate-700">Телефон</label>
            <input type="tel" id="client-phone" value={phone} onChange={(e) => setPhone(e.target.value)} className={inputStyle} />
        </div>
        <div>
            <label htmlFor="client-birthdate" className="block text-sm font-medium text-slate-700">Дата рождения (для физ. лиц)</label>
            <input type="date" id="client-birthdate" value={birthDate} onChange={(e) => setBirthDate(e.target.value)} className={inputStyle} />
        </div>
        <div>
            <label htmlFor="client-address" className="block text-sm font-medium text-slate-700">Адрес</label>
            <input type="text" id="client-address" value={address} onChange={(e) => setAddress(e.target.value)} className={inputStyle} />
        </div>
        <div>
            <label htmlFor="client-notes" className="block text-sm font-medium text-slate-700">Примечание</label>
            <textarea id="client-notes" value={notes} onChange={(e) => setNotes(e.target.value)} className={inputStyle} rows={3}></textarea>
        </div>

        <div className="flex justify-end pt-4 space-x-2">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm font-medium text-slate-700 bg-slate-100 rounded-lg hover:bg-slate-200">Отмена</button>
            <button type="submit" className="px-4 py-2 text-sm font-medium text-white bg-sky-600 rounded-lg hover:bg-sky-700">Добавить клиента</button>
        </div>
    </form>
  );
};