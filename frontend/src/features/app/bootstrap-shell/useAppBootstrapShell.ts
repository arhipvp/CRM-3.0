import { useMemo } from 'react';

import type { AppBootstrapShellArgs, AppBootstrapShellResult } from './types';
import { useAppBootstrapNavigation } from './useAppBootstrapNavigation';

export const useAppBootstrapShell = ({
  ensureCommissionsDataLoaded,
  ensureFinanceDataLoaded,
  ensureTasksLoaded,
  isAuthenticated,
  locationSearch,
  navigate,
  pathname,
  refreshPolicies,
  selectDealById,
  setError,
}: AppBootstrapShellArgs): AppBootstrapShellResult => {
  const routeFlags = useMemo(
    () => ({
      isClientsRoute: pathname.startsWith('/clients'),
      isCommissionsRoute: pathname.startsWith('/commissions'),
      isDealsRoute: pathname.startsWith('/deals'),
      isLoginRoute: pathname === '/login',
      isPoliciesRoute: pathname.startsWith('/policies'),
      isTasksRoute: pathname.startsWith('/tasks'),
    }),
    [pathname],
  );

  const { deepLinkedDealId, pendingPostLoginRedirect } = useAppBootstrapNavigation({
    ensureCommissionsDataLoaded,
    ensureFinanceDataLoaded,
    ensureTasksLoaded,
    isAuthenticated,
    isCommissionsRoute: routeFlags.isCommissionsRoute,
    isDealsRoute: routeFlags.isDealsRoute,
    isLoginRoute: routeFlags.isLoginRoute,
    isPoliciesRoute: routeFlags.isPoliciesRoute,
    isTasksRoute: routeFlags.isTasksRoute,
    locationSearch,
    navigate,
    refreshPolicies,
    selectDealById,
    setError,
  });

  return {
    ...routeFlags,
    deepLinkedDealId,
    pendingPostLoginRedirect,
  };
};
