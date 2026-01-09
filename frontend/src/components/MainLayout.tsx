import React from 'react';
import { NavLink } from 'react-router-dom';
import { User } from '../types';
import { UserBadge } from './common/UserBadge';

export type View =
  | 'seller-dashboard'
  | 'deals'
  | 'clients'
  | 'policies'
  | 'commissions'
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
  { path: '/seller-dashboard', label: 'Дашборд продавца', icon: '📈' },
  { path: '/deals', label: 'Сделки', icon: '📝' },
  { path: '/clients', label: 'Клиенты', icon: '👥' },
  { path: '/policies', label: 'Полисы', icon: '📄' },
  { path: '/commissions', label: 'Доходы и расходы', icon: '💸' },
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
      <aside className="w-64 bg-white/90 backdrop-blur border-r border-slate-200 flex flex-col fixed h-full z-10">
        <div className="px-6 py-5 border-b border-slate-200 bg-white/80">
          <p className="text-xs uppercase tracking-wide text-slate-400">
            CRM 3.0
          </p>
          <h1 className="text-2xl font-bold text-sky-600">Insure Desk</h1>
        </div>

        <nav className="flex-1 overflow-y-auto py-4">
          <ul className="space-y-1 px-3">
            {NAV_ITEMS.map((item) => (
              <li key={item.path}>
                <NavLink
                  to={item.path}
                  className={({ isActive }) =>
                    `relative flex items-center gap-3 w-full px-3 py-2 rounded-xl text-sm font-semibold transition-colors before:absolute before:left-1 before:top-1/2 before:h-6 before:w-1 before:-translate-y-1/2 before:rounded-full before:bg-sky-500 before:opacity-0 before:transition-opacity ${
                      isActive
                        ? 'bg-sky-50 text-sky-800 before:opacity-100'
                        : 'text-slate-700 hover:bg-slate-100'
                    }`
                  }
                >
                  <span className="text-base leading-none">{item.icon}</span>
                  {item.label}
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>

        <div className="p-4 border-t border-slate-200 space-y-3 bg-white/80">
          <button
            type="button"
            onClick={onAddDeal}
            className="btn btn-primary w-full rounded-xl"
          >
            + Добавить сделку
          </button>
          <button
            type="button"
            onClick={onAddClient}
            className="btn btn-secondary w-full rounded-xl"
          >
            + Добавить клиента
          </button>

          {currentUser && (
            <div className="pt-2 border-t border-slate-200 space-y-2">
              <div className="space-y-1">
                <UserBadge
                  username={currentUser.username}
                  displayName={currentUser.username}
                  size="sm"
                />
                <p className="text-slate-500 text-xs">
                  {currentUser.roles && currentUser.roles.length > 0
                    ? currentUser.roles.join(', ')
                    : 'Нет роли'}
                </p>
              </div>

              {onLogout && (
                <button
                  type="button"
                  onClick={onLogout}
                  className="btn btn-danger w-full rounded-xl"
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

