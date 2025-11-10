// Fix: Implemented the MainLayout component.
import React from 'react';
import { UserProfileDropdown } from './UserProfileDropdown';

type View = 'deals' | 'clients' | 'policies' | 'payments' | 'finance' | 'tasks' | 'settings';

interface MainLayoutProps {
  children: React.ReactNode;
  activeView: View;
  onNavigate: (view: View) => void;
  onAddDeal: () => void;
  onAddClient: () => void;
}

const NavItem: React.FC<{
  view: View;
  activeView: View;
  onNavigate: (view: View) => void;
  // Fix: Changed JSX.Element to React.ReactElement to resolve "Cannot find namespace 'JSX'" error.
  icon: React.ReactElement;
  label: string;
}> = ({ view, activeView, onNavigate, icon, label }) => (
  <li>
    <button
      onClick={() => onNavigate(view)}
      className={`flex items-center p-2 text-base font-normal rounded-lg w-full text-left
        ${activeView === view
          ? 'bg-sky-100 text-sky-700'
          : 'text-slate-600 hover:bg-slate-200'
        }`
      }
    >
      {icon}
      <span className="ml-3">{label}</span>
    </button>
  </li>
);

export const MainLayout: React.FC<MainLayoutProps> = ({ children, activeView, onNavigate, onAddDeal, onAddClient }) => {
  return (
    <div className="flex h-full">
      <aside className="w-64 bg-white border-r border-slate-200 flex flex-col">
        <div className="px-6 py-4 border-b border-slate-200">
          <h1 className="text-2xl font-bold text-sky-600">CRM Insure</h1>
        </div>
        <div className="flex-1 overflow-y-auto py-4 px-3">
          <ul className="space-y-2">
            <NavItem view="deals" activeView={activeView} onNavigate={onNavigate} label="Сделки" icon={<svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" /></svg>} />
            <NavItem view="clients" activeView={activeView} onNavigate={onNavigate} label="Клиенты" icon={<svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.653-.124-1.282-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.653.124-1.282.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" /></svg>} />
            <NavItem view="policies" activeView={activeView} onNavigate={onNavigate} label="Полисы" icon={<svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>} />
            <NavItem view="payments" activeView={activeView} onNavigate={onNavigate} label="Платежи" icon={<svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" /></svg>} />
            <NavItem view="finance" activeView={activeView} onNavigate={onNavigate} label="Финансы" icon={<svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 17h8m0 0V9m0 8l-8-8-4 4-6-6" /></svg>} />
            <NavItem view="tasks" activeView={activeView} onNavigate={onNavigate} label="Задачи" icon={<svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" /></svg>} />
            <NavItem view="settings" activeView={activeView} onNavigate={onNavigate} label="Настройки" icon={<svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>} />
          </ul>
           <div className="pt-4 mt-4 space-y-2 border-t border-slate-200">
               <button onClick={onAddDeal} className="w-full text-left flex items-center p-2 text-base font-normal text-slate-600 rounded-lg hover:bg-slate-200">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
                  <span className="ml-3">Новая сделка</span>
               </button>
               <button onClick={onAddClient} className="w-full text-left flex items-center p-2 text-base font-normal text-slate-600 rounded-lg hover:bg-slate-200">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" /></svg>
                  <span className="ml-3">Новый клиент</span>
               </button>
            </div>
        </div>
        <div className="p-4 mt-auto border-t border-slate-200">
            <UserProfileDropdown />
        </div>
      </aside>
      <main className="flex-1 h-full overflow-hidden">
          {children}
      </main>
    </div>
  );
};