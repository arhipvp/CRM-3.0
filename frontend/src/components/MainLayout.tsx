import React from 'react';
import { NavLink } from 'react-router-dom';

import { formatShortcut } from '../hotkeys/formatShortcut';
import type { User } from '../types';
import { BTN_DANGER, BTN_PRIMARY, BTN_QUIET, BTN_SECONDARY } from './common/buttonStyles';
import { UserBadge } from './common/UserBadge';

interface MainLayoutProps {
  onAddDeal: () => void;
  onAddClient: () => void;
  onOpenCommandPalette: () => void;
  currentUser?: User;
  onLogout?: () => void;
  children: React.ReactNode;
}

const NAV_ITEMS: Array<{ path: string; label: string; icon: string }> = [
  { path: '/seller-dashboard', label: 'Дашборд продавца', icon: 'DB' },
  { path: '/deals', label: 'Сделки', icon: 'DL' },
  { path: '/clients', label: 'Клиенты', icon: 'CL' },
  { path: '/policies', label: 'Полисы', icon: 'PL' },
  { path: '/commissions', label: 'Доходы и расходы', icon: 'CM' },
  { path: '/tasks', label: 'Задачи', icon: 'TS' },
  { path: '/settings', label: 'Настройки', icon: 'ST' },
];

const HIDDEN_NAV_PATHS = new Set(['/knowledge', '/library']);

const HOTKEY_ADD_DEAL = formatShortcut('mod+shift+d');
const HOTKEY_ADD_CLIENT = formatShortcut('mod+shift+c');
const HOTKEY_OPEN_PALETTE = formatShortcut('mod+k');

export const MainLayout: React.FC<MainLayoutProps> = ({
  onAddDeal,
  onAddClient,
  onOpenCommandPalette,
  currentUser,
  onLogout,
  children,
}) => {
  return (
    <div className="min-h-screen flex bg-slate-100 text-slate-900">
      <aside className="w-64 bg-white/90 backdrop-blur border-r border-slate-200 flex flex-col fixed h-full z-10">
        <div className="px-6 py-5 border-b border-slate-200 bg-white/80 space-y-3">
          <div>
            <p className="text-xs uppercase tracking-wide text-slate-400">CRM 3.0</p>
            <h1 className="text-2xl font-bold text-sky-600">Insure Desk</h1>
          </div>
          <button
            type="button"
            onClick={onOpenCommandPalette}
            className={`${BTN_QUIET} w-full rounded-xl justify-between`}
          >
            Команды
            <span className="rounded-md border border-slate-300 px-2 py-0.5 text-xs text-slate-600">
              {HOTKEY_OPEN_PALETTE}
            </span>
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto py-4">
          <ul className="space-y-1 px-3">
            {NAV_ITEMS.filter((item) => !HIDDEN_NAV_PATHS.has(item.path)).map((item) => (
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
                  <span className="inline-flex h-6 w-6 items-center justify-center rounded-md border border-slate-200 bg-white text-[10px] font-bold text-slate-500">
                    {item.icon}
                  </span>
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
            className={`${BTN_PRIMARY} w-full rounded-xl justify-between`}
          >
            <span>+ Добавить сделку</span>
            <span className="rounded-md border border-white/40 px-2 py-0.5 text-xs">
              {HOTKEY_ADD_DEAL}
            </span>
          </button>
          <button
            type="button"
            onClick={onAddClient}
            className={`${BTN_SECONDARY} w-full rounded-xl justify-between`}
          >
            <span>+ Добавить клиента</span>
            <span className="rounded-md border border-slate-300 px-2 py-0.5 text-xs text-slate-600">
              {HOTKEY_ADD_CLIENT}
            </span>
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
                  className={`${BTN_DANGER} w-full rounded-xl`}
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
