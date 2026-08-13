import React, { Suspense, lazy } from 'react';

import { AppRoutes } from './components/app/AppRoutes';
import { AppShell } from './components/app/AppShell';
import { AppShortcutsController } from './components/app/AppShortcutsController';
import { AppOverlayShell } from './features/app/overlay-shell/AppOverlayShell';
import { useAppContentController } from './hooks/appContent/useAppContentController';

const LoginPage = lazy(async () => {
  const module = await import('./components/LoginPage');
  return { default: module.LoginPage };
});

const FullScreenStatus: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div className="min-h-screen flex items-center justify-center bg-slate-100">
    <div className="text-slate-500">{children}</div>
  </div>
);

const AppContent: React.FC = () => {
  const controller = useAppContentController();

  if (controller.authLoading) {
    return <FullScreenStatus>Загрузка...</FullScreenStatus>;
  }

  if (!controller.isAuthenticated) {
    return (
      <Suspense fallback={<FullScreenStatus>Загрузка...</FullScreenStatus>}>
        <LoginPage onLoginSuccess={controller.handleLoginSuccess} />
      </Suspense>
    );
  }

  if (controller.pendingPostLoginRedirect) {
    return <FullScreenStatus>Переход...</FullScreenStatus>;
  }

  const { ConfirmDialogRenderer } = controller;

  return (
    <AppShell {...controller.shellProps}>
      <AppRoutes
        data={controller.routeBindings.routeData}
        dealsActions={controller.routeBindings.routeDealsActions}
        financeActions={controller.routeBindings.routeFinanceActions}
        filters={controller.routeBindings.routeFilters}
        loading={controller.routeBindings.routeLoading}
      />
      <AppShortcutsController {...controller.shortcutsProps} />
      <AppOverlayShell
        {...controller.overlayProps}
        confirmDialogRenderer={<ConfirmDialogRenderer />}
      />
    </AppShell>
  );
};

export default AppContent;
