import { useEffect, useMemo } from 'react';

import { consumePostLoginRedirect, getPostLoginRedirect } from '../../api';
import { formatErrorMessage } from '../../utils/formatErrorMessage';

interface UseAppBootstrapNavigationArgs {
  ensureFinanceDataLoaded: (options?: { force?: boolean }) => Promise<void>;
  ensureTasksLoaded: (options?: { force?: boolean }) => Promise<void>;
  isAuthenticated: boolean;
  isCommissionsRoute: boolean;
  isDealsRoute: boolean;
  isLoginRoute: boolean;
  isPoliciesRoute: boolean;
  isTasksRoute: boolean;
  locationSearch: string;
  navigate: (to: string, options?: { replace?: boolean }) => void;
  refreshPolicies: (options?: { force?: boolean }) => Promise<void>;
  selectDealById: (dealId: string) => void;
  setError: (value: string | null) => void;
}

export const useAppBootstrapNavigation = ({
  ensureFinanceDataLoaded,
  ensureTasksLoaded,
  isAuthenticated,
  isCommissionsRoute,
  isDealsRoute,
  isLoginRoute,
  isPoliciesRoute,
  isTasksRoute,
  locationSearch,
  navigate,
  refreshPolicies,
  selectDealById,
  setError,
}: UseAppBootstrapNavigationArgs) => {
  const pendingPostLoginRedirect = useMemo(
    () => (isAuthenticated && isLoginRoute ? getPostLoginRedirect(locationSearch) : null),
    [isAuthenticated, isLoginRoute, locationSearch],
  );

  const deepLinkedDealId = useMemo(() => {
    if (!isDealsRoute) {
      return null;
    }
    return new URLSearchParams(locationSearch).get('dealId');
  }, [isDealsRoute, locationSearch]);

  useEffect(() => {
    if (!pendingPostLoginRedirect) {
      return;
    }

    const nextPath = consumePostLoginRedirect(locationSearch);
    if (!nextPath) {
      return;
    }

    navigate(nextPath, { replace: true });
  }, [locationSearch, navigate, pendingPostLoginRedirect]);

  useEffect(() => {
    if (!isAuthenticated || !deepLinkedDealId) {
      return;
    }
    selectDealById(deepLinkedDealId);
  }, [deepLinkedDealId, isAuthenticated, selectDealById]);

  useEffect(() => {
    if (!isAuthenticated) {
      return;
    }
    if (isCommissionsRoute) {
      ensureFinanceDataLoaded().catch((err) => {
        setError(formatErrorMessage(err, 'Ошибка при загрузке финансовых данных'));
      });
      refreshPolicies().catch((err) => {
        setError(formatErrorMessage(err, 'Ошибка при загрузке данных для раздела комиссий'));
      });
      return;
    }
    if (isPoliciesRoute) {
      ensureFinanceDataLoaded().catch((err) => {
        setError(formatErrorMessage(err, 'Ошибка при загрузке финансовых данных'));
      });
    }
  }, [
    ensureFinanceDataLoaded,
    isAuthenticated,
    isCommissionsRoute,
    isPoliciesRoute,
    refreshPolicies,
    setError,
  ]);

  useEffect(() => {
    if (!isAuthenticated || !isTasksRoute) {
      return;
    }
    ensureTasksLoaded().catch((err) => {
      setError(formatErrorMessage(err, 'Ошибка при загрузке задач'));
    });
  }, [ensureTasksLoaded, isAuthenticated, isTasksRoute, setError]);

  return {
    deepLinkedDealId,
    pendingPostLoginRedirect,
  };
};
