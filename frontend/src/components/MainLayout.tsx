import React from 'react';
import { NavLink } from 'react-router-dom';
import { User } from '../types';
import { UserBadge } from './common/UserBadge';

export type View =
  | 'deals'
  | 'clients'
  | 'policies'
  | 'finance'
  | 'tasks'
  | 'knowledge'
  | 'settings';

interface MainLayoutProps {
  onAddDeal: () => void;
  onAddClient: () => void;
  currentUser?: User;
  onLogout?: () => void;
  children: React.ReactNode;
}

const NAV_ITEMS: Array<{ path: string; label: string; icon: string }> = [
  { path: '/deals', label: 'Сделки', icon: '📝' },
  { path: '/clients', label: 'Клиенты', icon: '👥' },
  { path: '/policies', label: 'Полисы', icon: '📄' },
  { path: '/finance', label: 'Финансы', icon: '🏦' },
  { path: '/tasks', label: 'Задачи', icon: '🗂️' },
  { path: '/knowledge', label: 'Библиотека', icon: '📚' },
  { path: '/settings', label: 'Настройки', icon: '⚙️' },
];

export const MainLayout: React.FC<MainLayoutProps> = ({
  onAddDeal,
  onAddClient,
  currentUser,
  onLogout,
  children,
}) => {
  return (
    <div className="min-h-screen flex bg-slate-100 text-slate-900">
      <aside className="w-64 bg-white border-r border-slate-200 flex flex-col fixed h-full z-10">
        <div className="px-6 py-5 border-b border-slate-200">
          <p className="text-xs uppercase tracking-wide text-slate-400">CRM 3.0</p>
          <h1 className="text-2xl font-bold text-sky-600">Insure Desk</h1>
        </div>
        <nav className="flex-1 overflow-y-auto py-4">
          <ul className="space-y-1 px-3">
            {NAV_ITEMS.map((item) => (
              <li key={item.path}>
                <NavLink
                  to={item.path}
                  className={({ isActive }) =>
                    `flex items-center gap-3 w-full px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                      isActive ? 'bg-sky-100 text-sky-700' : 'text-slate-600 hover:bg-slate-100'
                    }`
                  }
                >
                  <span>{item.icon}</span>
                  {item.label}
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>
        <div className="p-4 border-t border-slate-200 space-y-3 bg-white">
          <button
            onClick={onAddDeal}
            className="w-full bg-sky-600 text-white rounded-lg py-2 text-sm font-semibold hover:bg-sky-700"
          >
            + Добавить сделку
          </button>
          <button
            onClick={onAddClient}
            className="w-full border border-slate-300 text-slate-700 rounded-lg py-2 text-sm font-semibold hover:bg-slate-50"
          >
            + Добавить клиента
          </button>
          {currentUser && (
            <div className="pt-2 border-t border-slate-200 space-y-2">
              <div className="space-y-1">
                <UserBadge username={currentUser.username} displayName={currentUser.username} size="sm" />
                <p className="text-slate-500 text-xs">
                  {currentUser.roles && currentUser.roles.length > 0
                    ? currentUser.roles.join(', ')
                    : 'Нет роли'}
                </p>
              </div>
              {onLogout && (
                <button
                  onClick={onLogout}
                  className="w-full bg-red-50 text-red-600 rounded-lg py-2 text-sm font-semibold hover:bg-red-100"
                >
                  Выйти
                </button>
              )}
            </div>
          )}
        </div>
      </aside>
      <main className="flex-1 min-h-screen ml-64 bg-slate-100 px-6 py-6">
        <div className="w-full max-w-[1550px]">{children}</div>
      </main>
    </div>
  );
};
