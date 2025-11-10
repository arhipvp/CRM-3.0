// Fix: Implemented the SettingsView component.
import React, { useState } from 'react';
import { ToggleSwitch } from '../ToggleSwitch';

export const SettingsView: React.FC = () => {
    const [notificationsEnabled, setNotificationsEnabled] = useState(true);
    const [darkMode, setDarkMode] = useState(false);
    const [emailSignature, setEmailSignature] = useState('С уважением,\nМария Иванова\nСтарший менеджер');

  return (
    <div className="p-8 h-full overflow-y-auto bg-white">
      <h1 className="text-3xl font-bold text-slate-800 mb-8">Настройки</h1>
      
      <div className="max-w-2xl space-y-8">
        <div className="p-6 border border-slate-200 rounded-lg">
            <h2 className="text-xl font-semibold text-slate-700 mb-4">Уведомления</h2>
            <div className="flex items-center justify-between">
                <div>
                    <h3 className="font-medium text-slate-800">Email-уведомления</h3>
                    <p className="text-sm text-slate-500">Получать уведомления о новых задачах и событиях.</p>
                </div>
                <ToggleSwitch enabled={notificationsEnabled} onChange={setNotificationsEnabled} />
            </div>
        </div>

        <div className="p-6 border border-slate-200 rounded-lg">
            <h2 className="text-xl font-semibold text-slate-700 mb-4">Внешний вид</h2>
            <div className="flex items-center justify-between">
                <div>
                    <h3 className="font-medium text-slate-800">Темная тема</h3>
                    <p className="text-sm text-slate-500">Переключить интерфейс в темный режим.</p>
                </div>
                <ToggleSwitch enabled={darkMode} onChange={setDarkMode} />
            </div>
        </div>

        <div className="p-6 border border-slate-200 rounded-lg">
            <h2 className="text-xl font-semibold text-slate-700 mb-4">Подпись в email</h2>
            <div>
                 <label htmlFor="email_signature" className="sr-only">Подпись</label>
                 <textarea 
                    id="email_signature" 
                    rows={4} 
                    className="w-full border-slate-300 rounded-md text-sm"
                    value={emailSignature}
                    onChange={(e) => setEmailSignature(e.target.value)}
                />
            </div>
        </div>
        
        <div className="flex justify-end">
            <button className="px-5 py-2.5 text-sm font-medium text-white bg-sky-600 rounded-lg hover:bg-sky-700">
                Сохранить изменения
            </button>
        </div>
      </div>
    </div>
  );
};
