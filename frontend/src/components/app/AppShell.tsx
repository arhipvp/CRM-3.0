import React from 'react';

import type { User } from '../../types';
import { MainLayout } from '../MainLayout';
import { NotificationDisplay } from '../NotificationDisplay';
import { AppDataSyncController } from './AppDataSyncController';

type AppShellProps = {
  children: React.ReactNode;
  currentUser?: User | null;
  onAddDeal: () => void;
  onAddClient: () => void;
  onOpenCommandPalette: () => void;
  onLogout: () => void;
  error: string | null;
  onClearError: () => void;
  isSyncing: boolean;
};

export const AppShell: React.FC<AppShellProps> = ({
  children,
  currentUser,
  onAddDeal,
  onAddClient,
  onOpenCommandPalette,
  onLogout,
  error,
  onClearError,
  isSyncing,
}) => (
  <MainLayout
    onAddDeal={onAddDeal}
    onAddClient={onAddClient}
    onOpenCommandPalette={onOpenCommandPalette}
    currentUser={currentUser ?? undefined}
    onLogout={onLogout}
  >
    {children}
    <NotificationDisplay />
    {error && (
      <div className="fixed bottom-4 left-4 z-50 w-[min(420px,calc(100vw-2rem))]">
        <div className="rounded-2xl border border-rose-200 border-l-4 border-l-rose-500 bg-rose-50 text-rose-900 shadow-md">
          <div className="flex items-start justify-between gap-3 p-4">
            <div className="space-y-1">
              <p className="text-sm font-semibold">Ошибка</p>
              <p className="text-sm leading-relaxed">{error}</p>
            </div>
            <button
              type="button"
              onClick={onClearError}
              className="icon-btn h-8 w-8 text-rose-700 hover:bg-rose-100"
              aria-label="Скрыть ошибку"
              title="Скрыть"
            >
              &times;
            </button>
          </div>
        </div>
      </div>
    )}
    <AppDataSyncController isSyncing={isSyncing} />
  </MainLayout>
);
