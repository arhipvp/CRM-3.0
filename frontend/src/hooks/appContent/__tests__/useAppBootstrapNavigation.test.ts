import { renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { useAppBootstrapNavigation } from '../useAppBootstrapNavigation';

vi.mock('../../../api', () => ({
  consumePostLoginRedirect: vi.fn(),
  getPostLoginRedirect: vi.fn(),
}));

describe('useAppBootstrapNavigation', () => {
  const ensureCommissionsDataLoaded = vi.fn().mockResolvedValue(undefined);
  const ensureFinanceDataLoaded = vi.fn().mockResolvedValue(undefined);
  const ensureReferenceData = vi.fn().mockResolvedValue(undefined);
  const ensureTasksLoaded = vi.fn().mockResolvedValue(undefined);
  const navigate = vi.fn();
  const refreshPolicies = vi.fn().mockResolvedValue(undefined);
  const selectDealById = vi.fn();
  const setError = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('does not preload full finance snapshot on deals route', async () => {
    renderHook(() =>
      useAppBootstrapNavigation({
        ensureCommissionsDataLoaded,
        ensureFinanceDataLoaded,
        ensureReferenceData,
        ensureTasksLoaded,
        isAuthenticated: true,
        isClientsRoute: false,
        isCommissionsRoute: false,
        isDealsRoute: true,
        isLoginRoute: false,
        isPoliciesRoute: false,
        isTasksRoute: false,
        locationSearch: '',
        navigate,
        refreshPolicies,
        selectDealById,
        setError,
      }),
    );

    await waitFor(() => {
      expect(ensureFinanceDataLoaded).not.toHaveBeenCalled();
      expect(ensureReferenceData).toHaveBeenCalledTimes(1);
    });
  });

  it('still preloads finance snapshot on policies route', async () => {
    renderHook(() =>
      useAppBootstrapNavigation({
        ensureCommissionsDataLoaded,
        ensureFinanceDataLoaded,
        ensureReferenceData,
        ensureTasksLoaded,
        isAuthenticated: true,
        isClientsRoute: false,
        isCommissionsRoute: false,
        isDealsRoute: false,
        isLoginRoute: false,
        isPoliciesRoute: true,
        isTasksRoute: false,
        locationSearch: '',
        navigate,
        refreshPolicies,
        selectDealById,
        setError,
      }),
    );

    await waitFor(() => {
      expect(ensureFinanceDataLoaded).toHaveBeenCalledTimes(1);
      expect(ensureReferenceData).toHaveBeenCalledTimes(1);
    });
  });

  it('loads only commissions snapshot on commissions route', async () => {
    renderHook(() =>
      useAppBootstrapNavigation({
        ensureCommissionsDataLoaded,
        ensureFinanceDataLoaded,
        ensureReferenceData,
        ensureTasksLoaded,
        isAuthenticated: true,
        isClientsRoute: false,
        isCommissionsRoute: true,
        isDealsRoute: false,
        isLoginRoute: false,
        isPoliciesRoute: false,
        isTasksRoute: false,
        locationSearch: '',
        navigate,
        refreshPolicies,
        selectDealById,
        setError,
      }),
    );

    await waitFor(() => {
      expect(ensureCommissionsDataLoaded).toHaveBeenCalledTimes(1);
      expect(ensureFinanceDataLoaded).not.toHaveBeenCalled();
      expect(ensureReferenceData).toHaveBeenCalledTimes(1);
      expect(refreshPolicies).not.toHaveBeenCalled();
    });
  });
});
