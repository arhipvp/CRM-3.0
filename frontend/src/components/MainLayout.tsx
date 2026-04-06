import type { ReactNode } from 'react';
import { NavLink } from 'react-router-dom';

import type { User } from '../types';
import {
  BTN_BLOCK_DANGER,
  BTN_BLOCK_PRIMARY,
  BTN_BLOCK_QUIET,
  BTN_BLOCK_SECONDARY,
} from './common/buttonStyles';
import { UserBadge } from './common/UserBadge';

interface MainLayoutProps {
  onAddDeal: () => void;
  onAddClient: () => void;
  onOpenCommandPalette: () => void;
  currentUser?: User;
  onLogout?: () => void;
  topSlot?: ReactNode;
  children: ReactNode;
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

const NAV_LINK_BASE_CLASS =
  'relative flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm font-semibold transition-colors before:absolute before:inset-y-1.5 before:left-1 before:w-1 before:rounded-full before:bg-blue-500 before:opacity-0 before:transition-opacity';
const NAV_LINK_ACTIVE_CLASS = 'bg-blue-50 text-blue-900 before:opacity-100';
const NAV_LINK_IDLE_CLASS = 'text-slate-700 hover:bg-slate-100';
const NAV_ICON_CLASS =
  'inline-flex h-6 w-6 items-center justify-center rounded-md border border-[var(--app-border)] bg-white text-[10px] font-bold text-slate-500';
const TOP_SLOT_CLASS =
  'rounded-2xl border border-blue-200/90 bg-gradient-to-r from-blue-50/90 via-sky-50/80 to-white px-4 py-3 shadow-sm';

const getNavLinkClassName = (isActive: boolean) =>
  `${NAV_LINK_BASE_CLASS} ${isActive ? NAV_LINK_ACTIVE_CLASS : NAV_LINK_IDLE_CLASS}`;

export function MainLayout({
  onAddDeal,
  onAddClient,
  onOpenCommandPalette,
  currentUser,
  onLogout,
  topSlot,
  children,
}: MainLayoutProps) {
  return (
    <div className="min-h-screen bg-[var(--app-bg)] text-slate-900 lg:flex">
      <aside className="border-b border-[var(--app-border)] bg-[var(--app-sidebar-bg)]/95 backdrop-blur lg:fixed lg:inset-y-0 lg:left-0 lg:flex lg:w-72 lg:flex-col lg:border-b-0 lg:border-r">
        <div className="space-y-3 border-b border-[var(--app-border)] px-5 py-4">
          <div className="flex items-end justify-between gap-3">
            <div>
              <p className="text-[11px] uppercase tracking-[0.18em] text-slate-400">CRM 3.0</p>
              <h1 className="text-2xl font-bold text-blue-700">Insure Desk</h1>
            </div>
          </div>
          <button type="button" onClick={onOpenCommandPalette} className={BTN_BLOCK_QUIET}>
            Команды
          </button>
        </div>

        <nav className="flex-1 overflow-x-auto overflow-y-visible px-3 py-3 lg:overflow-y-auto">
          <ul className="flex min-w-max gap-1 lg:min-w-0 lg:flex-col">
            {NAV_ITEMS.filter((item) => !HIDDEN_NAV_PATHS.has(item.path)).map((item) => (
              <li key={item.path}>
                <NavLink to={item.path} className={({ isActive }) => getNavLinkClassName(isActive)}>
                  <span className={NAV_ICON_CLASS}>{item.icon}</span>
                  {item.label}
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>

        <div className="space-y-3 border-t border-[var(--app-border)] bg-white/70 p-4">
          <button type="button" onClick={onAddDeal} className={BTN_BLOCK_PRIMARY}>
            + Добавить сделку
          </button>
          <button type="button" onClick={onAddClient} className={BTN_BLOCK_SECONDARY}>
            + Добавить клиента
          </button>

          {currentUser && (
            <div className="space-y-2 border-t border-[var(--app-border)] pt-2">
              <div className="space-y-1">
                <UserBadge
                  username={currentUser.username}
                  displayName={currentUser.username}
                  size="sm"
                />
                <p className="text-xs text-slate-500">
                  {currentUser.roles && currentUser.roles.length > 0
                    ? currentUser.roles.join(', ')
                    : 'Нет роли'}
                </p>
              </div>
              {onLogout && (
                <button type="button" onClick={onLogout} className={BTN_BLOCK_DANGER}>
                  Выйти
                </button>
              )}
            </div>
          )}
        </div>
      </aside>

      <main className="min-h-screen flex-1 px-3 py-4 sm:px-5 lg:ml-72 lg:px-7 lg:py-6">
        <div className="w-full space-y-4">
          {topSlot && <section className={TOP_SLOT_CLASS}>{topSlot}</section>}
          <div className="w-full">{children}</div>
        </div>
      </main>
    </div>
  );
}
