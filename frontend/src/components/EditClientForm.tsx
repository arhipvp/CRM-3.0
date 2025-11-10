import React, { useState, useEffect } from 'react';
import { Client } from '../types';

interface EditClientFormProps {
  client: Client;
  onUpdateClient: (clientData: Client) => void;
  onClose: () => void;
}

const ConfirmationModal: React.FC<{ onConfirm: () => void; onCancel: () => void; }> = ({ onConfirm, onCancel }) => (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-lg shadow-xl max-w-sm w-full p-6 text-center">
            <h3 className="text-lg font-semibold text-slate-800">Подтвердите изменения</h3>
            <p className="text-sm text-slate-500 mt-2">Вы уверены, что хотите сохранить внесенные изменения?</p>
            <div className="flex justify-center mt-6 space-x-3">
                <button
                    onClick={onCancel}
                    className="px-4 py-2 text-sm font-medium text-slate-700 bg-slate-100 rounded-lg hover:bg-slate-200 w-24"
                >
                    Отмена
                </button>
                <button
                    onClick={onConfirm}
                    className="px-4 py-2 text-sm font-medium text-white bg-sky-600 rounded-lg hover:bg-sky-700 w-24"
                >
                    Сохранить
                </button>
            </div>
        </div>
    </div>
);


export const EditClientForm: React.FC<EditClientFormProps> = ({ client, onUpdateClient, onClose }) => {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [notes, setNotes] = useState('');
  const [birthDate, setBirthDate] = useState('');
  const [error, setError] = useState('');
  const [isConfirmOpen, setConfirmOpen] = useState(false);

  useEffect(() => {
    if (client) {
      setName(client.name);
      setEmail(client.email);
      setPhone(client.phone);
      setAddress(client.address);
      setNotes(client.notes || '');
      setBirthDate(client.birthDate || '');
    }
  }, [client]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!name.trim() || !email.trim()) {
      setError('Имя и Email обязательны для заполнения.');
      return;
    }
    setConfirmOpen(true);
  };

  const handleConfirmUpdate = () => {
     onUpdateClient({
      ...client,
      name,
      email,
      phone,
      address,
      notes,
      birthDate,
    });
    setConfirmOpen(false);
  };

  const inputStyle = "mt-1 block w-full rounded-md border-slate-300 shadow-sm focus:border-sky-500 focus:ring focus:ring-sky-200 focus:ring-opacity-50";

  return (
    <>
      <div className="fixed inset-0 bg-black/30 z-40 flex items-center justify-center p-4" onClick={onClose}>
        <form onSubmit={handleSubmit} className="bg-white rounded-lg shadow-xl max-w-lg w-full p-6 space-y-4" onClick={e => e.stopPropagation()}>
          <div className="flex justify-between items-center">
            <h2 className="text-xl font-bold text-slate-800">Редактировать клиента</h2>
            <button type="button" onClick={onClose} className="p-1 rounded-full text-slate-400 hover:bg-slate-100">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          {error && <p className="text-red-500 text-sm">{error}</p>}
          
          <div>
            <label htmlFor="client-name" className="block text-sm font-medium text-slate-700">Имя</label>
            <input type="text" id="client-name" value={name} onChange={(e) => setName(e.target.value)} className={inputStyle} />
          </div>
          <div>
            <label htmlFor="client-email" className="block text-sm font-medium text-slate-700">Email</label>
            <input type="email" id="client-email" value={email} onChange={(e) => setEmail(e.target.value)} className={inputStyle} />
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
            <button type="submit" className="px-4 py-2 text-sm font-medium text-white bg-sky-600 rounded-lg hover:bg-sky-700">Сохранить изменения</button>
          </div>
        </form>
      </div>
      {isConfirmOpen && <ConfirmationModal onConfirm={handleConfirmUpdate} onCancel={() => setConfirmOpen(false)} />}
    </>
  );
};