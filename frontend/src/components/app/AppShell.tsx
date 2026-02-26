import React from 'react';

import type { LastRefreshAtByResource, LastRefreshErrorByResource } from '../../hooks/useAppData';
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
  isBackgroundRefreshingAny?: boolean;
  lastRefreshAtByResource?: LastRefreshAtByResource;
  lastRefreshErrorByResource?: LastRefreshErrorByResource;
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
  isBackgroundRefreshingAny = false,
  lastRefreshAtByResource,
  lastRefreshErrorByResource,
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
              <p className="text-sm font-semibold">{'\u041e\u0448\u0438\u0431\u043a\u0430'}</p>
              <p className="text-sm leading-relaxed">{error}</p>
            </div>
            <button
              type="button"
              onClick={onClearError}
              className="icon-btn h-8 w-8 text-rose-700 hover:bg-rose-100"
              aria-label={
                '\u0421\u043a\u0440\u044b\u0442\u044c \u043e\u0448\u0438\u0431\u043a\u0443'
              }
              title={'\u0421\u043a\u0440\u044b\u0442\u044c'}
            >
              &times;
            </button>
          </div>
        </div>
      </div>
    )}
    <AppDataSyncController
      isMutationSyncing={isSyncing}
      isBackgroundRefreshingAny={isBackgroundRefreshingAny}
      lastRefreshAtByResource={lastRefreshAtByResource}
      lastRefreshErrorByResource={lastRefreshErrorByResource}
    />
  </MainLayout>
);
