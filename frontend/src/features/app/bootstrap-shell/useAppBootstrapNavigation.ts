import { useEffect, useMemo } from 'react';

import { consumePostLoginRedirect, getPostLoginRedirect } from '../../../api';
import { formatErrorMessage } from '../../../utils/formatErrorMessage';

export interface UseAppBootstrapNavigationArgs {
  ensureCommissionsDataLoaded: (options?: { force?: boolean }) => Promise<void>;
  ensureFinanceDataLoaded: (options?: { force?: boolean }) => Promise<void>;
  ensureReferenceData: (options?: { force?: boolean }) => Promise<void>;
  ensureSalesChannelsLoaded?: () => Promise<void>;
  ensureTasksLoaded: (options?: { force?: boolean }) => Promise<void>;
  isAuthenticated: boolean;
  isClientsRoute: boolean;
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
  ensureCommissionsDataLoaded,
  ensureFinanceDataLoaded,
  ensureReferenceData,
  ensureSalesChannelsLoaded,
  ensureTasksLoaded,
  isAuthenticated,
  isClientsRoute,
  isCommissionsRoute,
  isDealsRoute,
  isLoginRoute,
  isPoliciesRoute,
  isTasksRoute,
  locationSearch,
  navigate,
  selectDealById,
  setError,
}: UseAppBootstrapNavigationArgs) => {
  const pendingPostLoginRedirect = useMemo(
    () => (isAuthenticated && isLoginRoute ? getPostLoginRedirect(locationSearch) : null),
    [isAuthenticated, isLoginRoute, locationSearch],
  );
  const loadSalesChannels = useMemo(
    () => ensureSalesChannelsLoaded ?? (() => ensureReferenceData()),
    [ensureReferenceData, ensureSalesChannelsLoaded],
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
      loadSalesChannels().catch((err) => {
        setError(formatErrorMessage(err, 'Ошибка при загрузке каналов продаж'));
      });
      return;
    }
    if (isClientsRoute || isDealsRoute || isPoliciesRoute) {
      ensureReferenceData().catch((err) => {
        setError(formatErrorMessage(err, 'Ошибка при загрузке справочников'));
      });
    }
  }, [
    ensureReferenceData,
    loadSalesChannels,
    isAuthenticated,
    isClientsRoute,
    isCommissionsRoute,
    isDealsRoute,
    isPoliciesRoute,
    setError,
  ]);

  useEffect(() => {
    if (!isAuthenticated) {
      return;
    }
    if (isCommissionsRoute) {
      ensureCommissionsDataLoaded().catch((err) => {
        setError(formatErrorMessage(err, 'Ошибка при загрузке данных ведомостей'));
      });
      return;
    }
    if (isPoliciesRoute) {
      ensureFinanceDataLoaded().catch((err) => {
        setError(formatErrorMessage(err, 'Ошибка при загрузке финансовых данных'));
      });
    }
  }, [
    ensureCommissionsDataLoaded,
    ensureFinanceDataLoaded,
    isAuthenticated,
    isCommissionsRoute,
    isPoliciesRoute,
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
