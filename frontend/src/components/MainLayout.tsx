import { useState, type ReactNode } from 'react';
import { NavLink } from 'react-router-dom';

import type { User } from '../types';
import { AppIcon, type AppIconName } from './common/AppIcon';
import { Button, IconButton } from './common/Button';
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

const NAV_ITEMS: Array<{ path: string; label: string; icon: AppIconName }> = [
  { path: '/seller-dashboard', label: 'Дашборд продавца', icon: 'dashboard' },
  { path: '/deals', label: 'Сделки', icon: 'deals' },
  { path: '/clients', label: 'Клиенты', icon: 'clients' },
  { path: '/policies', label: 'Полисы', icon: 'policies' },
  { path: '/commissions', label: 'Доходы и расходы', icon: 'finance' },
  { path: '/tasks', label: 'Задачи', icon: 'tasks' },
  { path: '/settings', label: 'Настройки', icon: 'settings' },
];

const HIDDEN_NAV_PATHS = new Set(['/knowledge', '/library']);
const SIDEBAR_COLLAPSED_STORAGE_KEY = 'crm.sidebar.collapsed';

const NAV_LINK_BASE_CLASS =
  'relative flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm font-semibold transition-colors before:absolute before:inset-y-1.5 before:left-1 before:w-1 before:rounded-full before:bg-blue-500 before:opacity-0 before:transition-opacity';
const NAV_LINK_ACTIVE_CLASS = 'bg-blue-50 text-blue-900 before:opacity-100';
const NAV_LINK_IDLE_CLASS = 'text-slate-700 hover:bg-slate-100';
const NAV_ICON_CLASS =
  'inline-flex h-6 w-6 items-center justify-center rounded-md border border-[var(--app-border)] bg-white text-slate-500';
const TOP_SLOT_CLASS = 'rounded-2xl border border-blue-100 bg-blue-50/80 px-4 py-3 shadow-sm';

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
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(() => {
    try {
      return localStorage.getItem(SIDEBAR_COLLAPSED_STORAGE_KEY) === 'true';
    } catch {
      return false;
    }
  });

  const toggleSidebar = () => {
    setIsSidebarCollapsed((currentValue) => {
      const nextValue = !currentValue;
      try {
        localStorage.setItem(SIDEBAR_COLLAPSED_STORAGE_KEY, String(nextValue));
      } catch {
        // The layout remains usable when storage is unavailable.
      }
      return nextValue;
    });
  };

  const desktopSidebarWidthClassName = isSidebarCollapsed ? 'lg:w-20' : 'lg:w-60';
  const desktopMainOffsetClassName = isSidebarCollapsed ? 'lg:ml-20' : 'lg:ml-60';
  const desktopLabelClassName = isSidebarCollapsed ? 'lg:sr-only' : '';

  return (
    <div className="min-h-screen min-w-0 bg-[var(--app-bg)] text-slate-900 lg:flex">
      <aside
        className={`border-b border-[var(--app-border)] bg-[var(--app-sidebar-bg)]/95 backdrop-blur transition-[width] duration-200 lg:fixed lg:inset-y-0 lg:left-0 lg:flex lg:flex-col lg:border-b-0 lg:border-r ${desktopSidebarWidthClassName}`}
        data-testid="main-sidebar"
      >
        <div
          className={`space-y-3 border-b border-[var(--app-border)] px-5 py-4 ${isSidebarCollapsed ? 'lg:px-3' : ''}`}
        >
          <div className="flex items-end justify-between gap-3">
            <div className={desktopLabelClassName}>
              <p className="text-[11px] uppercase tracking-[0.18em] text-slate-400">CRM 3.0</p>
              <p className="text-2xl font-bold text-blue-700">Insure Desk</p>
            </div>
            <IconButton
              onClick={toggleSidebar}
              className="hidden shrink-0 lg:inline-flex"
              icon={isSidebarCollapsed ? 'expand' : 'collapse'}
              label={isSidebarCollapsed ? 'Развернуть боковую панель' : 'Свернуть боковую панель'}
              aria-expanded={!isSidebarCollapsed}
            />
          </div>
          <Button
            onClick={onOpenCommandPalette}
            variant="quiet"
            size="block"
            icon="commands"
            className={isSidebarCollapsed ? 'lg:px-0' : ''}
            aria-label="Команды"
            title={isSidebarCollapsed ? 'Команды' : undefined}
          >
            <span className={desktopLabelClassName}>Команды</span>
          </Button>
        </div>

        <nav className="flex-1 overflow-x-auto overflow-y-visible px-3 py-3 lg:overflow-y-auto">
          <ul className="flex min-w-max gap-1 lg:min-w-0 lg:flex-col">
            {NAV_ITEMS.filter((item) => !HIDDEN_NAV_PATHS.has(item.path)).map((item) => (
              <li key={item.path}>
                <NavLink
                  to={item.path}
                  className={({ isActive }) =>
                    `${getNavLinkClassName(isActive)} ${isSidebarCollapsed ? 'lg:justify-center lg:px-2' : ''}`
                  }
                  aria-label={item.label}
                  title={isSidebarCollapsed ? item.label : undefined}
                >
                  <span className={NAV_ICON_CLASS}>
                    <AppIcon name={item.icon} size={16} />
                  </span>
                  <span className={desktopLabelClassName}>{item.label}</span>
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>

        <div
          className={`space-y-3 border-t border-[var(--app-border)] bg-white/70 p-4 ${isSidebarCollapsed ? 'lg:px-3' : ''}`}
        >
          <Button
            onClick={onAddDeal}
            variant="primary"
            size="block"
            icon="plus"
            className={isSidebarCollapsed ? 'lg:px-0' : ''}
            aria-label="Добавить сделку"
            title={isSidebarCollapsed ? 'Добавить сделку' : undefined}
          >
            <span className={desktopLabelClassName}>Добавить сделку</span>
          </Button>
          <Button
            onClick={onAddClient}
            variant="secondary"
            size="block"
            icon="plus"
            className={isSidebarCollapsed ? 'lg:px-0' : ''}
            aria-label="Добавить клиента"
            title={isSidebarCollapsed ? 'Добавить клиента' : undefined}
          >
            <span className={desktopLabelClassName}>Добавить клиента</span>
          </Button>

          {currentUser && (
            <div className="space-y-2 border-t border-[var(--app-border)] pt-2">
              <div className="space-y-1">
                <UserBadge
                  username={currentUser.username}
                  displayName={currentUser.username}
                  size="sm"
                  className={isSidebarCollapsed ? 'lg:hidden' : ''}
                />
                {isSidebarCollapsed && (
                  <span
                    className="hidden h-8 w-8 items-center justify-center rounded-full border border-[var(--app-border)] bg-white text-xs font-bold uppercase text-slate-600 lg:inline-flex"
                    aria-label={`Пользователь: ${currentUser.username}`}
                    title={currentUser.username}
                  >
                    {currentUser.username.charAt(0) || '—'}
                  </span>
                )}
                <p className={`text-xs text-slate-500 ${desktopLabelClassName}`}>
                  {currentUser.roles && currentUser.roles.length > 0
                    ? currentUser.roles.join(', ')
                    : currentUser.isStaff
                      ? 'Администратор'
                      : 'Нет роли'}
                </p>
              </div>
              {onLogout && (
                <Button
                  onClick={onLogout}
                  variant="danger"
                  size="block"
                  icon="logout"
                  className={isSidebarCollapsed ? 'lg:px-0' : ''}
                  aria-label="Выйти"
                  title={isSidebarCollapsed ? 'Выйти' : undefined}
                >
                  <span className={desktopLabelClassName}>Выйти</span>
                </Button>
              )}
            </div>
          )}
        </div>
      </aside>

      <main
        className={`min-h-screen min-w-0 flex-1 px-3 py-4 transition-[margin] duration-200 sm:px-5 lg:px-5 lg:py-5 ${desktopMainOffsetClassName}`}
        data-testid="main-content"
      >
        <div className="w-full space-y-4">
          {topSlot && <section className={TOP_SLOT_CLASS}>{topSlot}</section>}
          <div className="w-full">{children}</div>
        </div>
      </main>
    </div>
  );
}
