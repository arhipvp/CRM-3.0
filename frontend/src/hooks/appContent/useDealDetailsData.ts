import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Dispatch, SetStateAction } from 'react';

import {
  APIError,
  fetchDeal,
  fetchPaymentsWithPagination,
  fetchPoliciesWithPagination,
  fetchQuotesByDeal,
  fetchTasksByDeal,
} from '../../api';
import type { FilterParams } from '../../api';
import type { Deal, FinancialRecord, Payment, Policy, Quote, Task } from '../../types';
import { formatErrorMessage } from '../../utils/formatErrorMessage';
import type { useAppData } from '../useAppData';

type RefreshDeals = ReturnType<typeof useAppData>['refreshDeals'];
type InvalidateDealsCache = ReturnType<typeof useAppData>['invalidateDealsCache'];
type UpdateAppData = ReturnType<typeof useAppData>['updateAppData'];

interface UseDealDetailsDataParams {
  deals: Deal[];
  deepLinkedDealId: string | null;
  isAuthenticated: boolean;
  isDealsRoute: boolean;
  effectiveSelectedDealId: string | null;
  previewDealId: string | null;
  isDealSelectionBlocked: boolean;
  dealFilters: FilterParams;
  refreshDeals: RefreshDeals;
  invalidateDealsCache: InvalidateDealsCache;
  updateAppData: UpdateAppData;
  setError: Dispatch<SetStateAction<string | null>>;
  clearSelectedDealFocus: () => void;
  selectDealById: (dealId: string) => void;
  openDealPreviewById: (dealId: string) => void;
  setIsRefreshingDealsList: Dispatch<SetStateAction<boolean>>;
}

const DEAL_DETAILS_CACHE_TTL_MS = 60_000;

export const useDealDetailsData = ({
  deals,
  deepLinkedDealId,
  isAuthenticated,
  isDealsRoute,
  effectiveSelectedDealId,
  previewDealId,
  isDealSelectionBlocked,
  dealFilters,
  refreshDeals,
  invalidateDealsCache,
  updateAppData,
  setError,
  clearSelectedDealFocus,
  selectDealById,
  openDealPreviewById,
  setIsRefreshingDealsList,
}: UseDealDetailsDataParams) => {
  const [dealTasksLoadingIds, setDealTasksLoadingIds] = useState<Set<string>>(() => new Set());
  const [dealQuotesLoadingIds, setDealQuotesLoadingIds] = useState<Set<string>>(() => new Set());

  const dealsById = useMemo(() => {
    const map = new Map<string, Deal>();
    deals.forEach((deal) => {
      map.set(deal.id, deal);
    });
    return map;
  }, [deals]);

  const protectedCreatedDealRef = useRef<Deal | null>(null);
  const preservedDeepLinkedDealRef = useRef<Deal | null>(null);
  const skipNextMissingSelectedDealClearRef = useRef<string | null>(null);
  const deepLinkedDealLoadedRef = useRef<string | null>(null);
  const deepLinkedDealLoadingRef = useRef<string | null>(null);
  const deepLinkedDealIdRef = useRef<string | null>(deepLinkedDealId);
  const selectedDealIdRef = useRef<string | null>(null);
  const previewDealIdRef = useRef<string | null>(null);
  const dealTasksCacheRef = useRef(new Map<string, { loadedAt: number; data: Task[] }>());
  const dealQuotesCacheRef = useRef(new Map<string, { loadedAt: number; data: Quote[] }>());
  const dealPoliciesCacheRef = useRef(new Map<string, { loadedAt: number; data: Policy[] }>());
  const dealPaymentsCacheRef = useRef(new Map<string, { loadedAt: number; data: Payment[] }>());
  const dealTasksInFlightRef = useRef(new Map<string, Promise<Task[]>>());
  const dealQuotesInFlightRef = useRef(new Map<string, Promise<Quote[]>>());
  const dealPoliciesInFlightRef = useRef(new Map<string, Promise<Policy[]>>());
  const dealPaymentsInFlightRef = useRef(new Map<string, Promise<Payment[]>>());
  const rehydrateDealDetailsRef = useRef<(dealId: string) => Promise<void>>(async () => undefined);

  const isCacheFresh = useCallback(
    (loadedAt: number) => Date.now() - loadedAt < DEAL_DETAILS_CACHE_TTL_MS,
    [],
  );

  const invalidateDealTasksCache = useCallback((dealId?: string | null) => {
    if (dealId) {
      dealTasksCacheRef.current.delete(dealId);
      dealTasksInFlightRef.current.delete(dealId);
      return;
    }
    dealTasksCacheRef.current.clear();
    dealTasksInFlightRef.current.clear();
  }, []);

  const invalidateDealQuotesCache = useCallback((dealId?: string | null) => {
    if (dealId) {
      dealQuotesCacheRef.current.delete(dealId);
      dealQuotesInFlightRef.current.delete(dealId);
      return;
    }
    dealQuotesCacheRef.current.clear();
    dealQuotesInFlightRef.current.clear();
  }, []);

  const invalidateDealPoliciesCache = useCallback((dealId?: string | null) => {
    if (dealId) {
      dealPoliciesCacheRef.current.delete(dealId);
      dealPoliciesInFlightRef.current.delete(dealId);
      return;
    }
    dealPoliciesCacheRef.current.clear();
    dealPoliciesInFlightRef.current.clear();
  }, []);

  const invalidateDealPaymentsCache = useCallback((dealId?: string | null) => {
    if (dealId) {
      dealPaymentsCacheRef.current.delete(dealId);
      dealPaymentsInFlightRef.current.delete(dealId);
      return;
    }
    dealPaymentsCacheRef.current.clear();
    dealPaymentsInFlightRef.current.clear();
  }, []);

  const cacheDealQuotes = useCallback((dealId: string, quotes: Quote[]) => {
    dealQuotesCacheRef.current.set(dealId, {
      loadedAt: Date.now(),
      data: quotes,
    });
  }, []);

  const mergeDealWithHydratedQuotes = useCallback(
    (incomingDeal: Deal, existingDeal?: Deal | null): Deal => {
      if (incomingDeal.quotes.length > 0) {
        cacheDealQuotes(incomingDeal.id, incomingDeal.quotes);
        return incomingDeal;
      }

      const cachedQuotes = dealQuotesCacheRef.current.get(incomingDeal.id)?.data;
      const preservedQuotes = cachedQuotes ?? existingDeal?.quotes;
      if (preservedQuotes && preservedQuotes.length > 0) {
        return { ...incomingDeal, quotes: preservedQuotes };
      }

      return incomingDeal;
    },
    [cacheDealQuotes],
  );

  const restoreDealsQuotesFromCache = useCallback(
    (dealIds?: string[]) => {
      updateAppData((prev) => {
        let hasChanges = false;
        const targetIds = dealIds ? new Set(dealIds) : null;
        const nextDeals = prev.deals.map((deal) => {
          if (targetIds && !targetIds.has(deal.id)) {
            return deal;
          }
          if (deal.quotes.length > 0) {
            return deal;
          }

          const cachedQuotes = dealQuotesCacheRef.current.get(deal.id)?.data;
          if (!cachedQuotes || cachedQuotes.length === 0) {
            return deal;
          }

          hasChanges = true;
          return { ...deal, quotes: cachedQuotes };
        });

        if (!hasChanges) {
          return {};
        }

        return { deals: nextDeals };
      });
    },
    [updateAppData],
  );

  const loadDealPolicies = useCallback(
    async (dealId: string, options?: { force?: boolean }) => {
      const force = options?.force ?? false;
      const applyDealPolicies = (dealPolicies: Policy[]) => {
        updateAppData((prev) => ({
          policies: [
            ...prev.policies.filter((policy) => policy.dealId !== dealId),
            ...dealPolicies,
          ],
        }));
      };

      const cached = dealPoliciesCacheRef.current.get(dealId);
      if (!force && cached && isCacheFresh(cached.loadedAt)) {
        applyDealPolicies(cached.data);
        return;
      }

      const existingPromise = dealPoliciesInFlightRef.current.get(dealId);
      if (existingPromise) {
        try {
          const dealPolicies = await existingPromise;
          applyDealPolicies(dealPolicies);
        } catch (err) {
          setError(formatErrorMessage(err, 'Error loading policies for the deal'));
        }
        return;
      }

      const request = (async () => {
        const pageSize = 100;
        const retrieved: Policy[] = [];
        let page = 1;
        while (true) {
          const payload = await fetchPoliciesWithPagination({
            deal: dealId,
            page,
            page_size: pageSize,
          });
          retrieved.push(...payload.results);
          if (!payload.next) {
            break;
          }
          page += 1;
        }
        dealPoliciesCacheRef.current.set(dealId, {
          loadedAt: Date.now(),
          data: retrieved,
        });
        return retrieved;
      })().finally(() => {
        dealPoliciesInFlightRef.current.delete(dealId);
      });

      dealPoliciesInFlightRef.current.set(dealId, request);

      try {
        const dealPolicies = await request;
        applyDealPolicies(dealPolicies);
      } catch (err) {
        setError(formatErrorMessage(err, 'Error loading policies for the deal'));
      }
    },
    [isCacheFresh, setError, updateAppData],
  );

  const loadDealPayments = useCallback(
    async (dealId: string, options?: { force?: boolean }) => {
      const force = options?.force ?? false;

      const applyDealPayments = (dealPayments: Payment[]) => {
        updateAppData((prev) => {
          const dealPolicyIds = new Set(
            prev.policies.filter((policy) => policy.dealId === dealId).map((policy) => policy.id),
          );
          const paymentIdsToReplace = new Set(
            prev.payments
              .filter(
                (payment) =>
                  payment.dealId === dealId ||
                  (payment.policyId ? dealPolicyIds.has(payment.policyId) : false),
              )
              .map((payment) => payment.id),
          );
          const fetchedRecords: FinancialRecord[] = dealPayments.flatMap(
            (payment) => payment.financialRecords ?? [],
          );

          return {
            payments: [
              ...prev.payments.filter((payment) => !paymentIdsToReplace.has(payment.id)),
              ...dealPayments,
            ],
            financialRecords: [
              ...prev.financialRecords.filter(
                (record) => !paymentIdsToReplace.has(record.paymentId),
              ),
              ...fetchedRecords,
            ],
          };
        });
      };

      const cached = dealPaymentsCacheRef.current.get(dealId);
      if (!force && cached && isCacheFresh(cached.loadedAt)) {
        applyDealPayments(cached.data);
        return;
      }

      const existingPromise = dealPaymentsInFlightRef.current.get(dealId);
      if (existingPromise) {
        try {
          const dealPayments = await existingPromise;
          applyDealPayments(dealPayments);
        } catch (err) {
          setError(formatErrorMessage(err, 'Error loading payments for the deal'));
        }
        return;
      }

      const request = (async () => {
        const pageSize = 100;
        const retrieved: Payment[] = [];
        let page = 1;
        while (true) {
          const payload = await fetchPaymentsWithPagination({
            deal: dealId,
            page,
            page_size: pageSize,
          });
          retrieved.push(...payload.results);
          if (!payload.next) {
            break;
          }
          page += 1;
        }
        dealPaymentsCacheRef.current.set(dealId, {
          loadedAt: Date.now(),
          data: retrieved,
        });
        return retrieved;
      })().finally(() => {
        dealPaymentsInFlightRef.current.delete(dealId);
      });

      dealPaymentsInFlightRef.current.set(dealId, request);

      try {
        const dealPayments = await request;
        applyDealPayments(dealPayments);
      } catch (err) {
        setError(formatErrorMessage(err, 'Error loading payments for the deal'));
      }
    },
    [isCacheFresh, setError, updateAppData],
  );

  const markDealTasksLoading = useCallback((dealId: string) => {
    setDealTasksLoadingIds((prev) => {
      if (prev.has(dealId)) {
        return prev;
      }
      const next = new Set(prev);
      next.add(dealId);
      return next;
    });
  }, []);

  const unmarkDealTasksLoading = useCallback((dealId: string) => {
    setDealTasksLoadingIds((prev) => {
      if (!prev.has(dealId)) {
        return prev;
      }
      const next = new Set(prev);
      next.delete(dealId);
      return next;
    });
  }, []);

  const markDealQuotesLoading = useCallback((dealId: string) => {
    setDealQuotesLoadingIds((prev) => {
      if (prev.has(dealId)) {
        return prev;
      }
      const next = new Set(prev);
      next.add(dealId);
      return next;
    });
  }, []);

  const unmarkDealQuotesLoading = useCallback((dealId: string) => {
    setDealQuotesLoadingIds((prev) => {
      if (!prev.has(dealId)) {
        return prev;
      }
      const next = new Set(prev);
      next.delete(dealId);
      return next;
    });
  }, []);

  const refreshDealsWithSelection = useCallback(
    async (filters?: FilterParams, options?: { force?: boolean }) => {
      const dealsData = await refreshDeals(filters, options);
      restoreDealsQuotesFromCache();
      const currentSelectedDealId = selectedDealIdRef.current;
      if (!currentSelectedDealId) {
        return dealsData;
      }
      if (dealsData.some((deal) => deal.id === currentSelectedDealId)) {
        if (skipNextMissingSelectedDealClearRef.current === currentSelectedDealId) {
          skipNextMissingSelectedDealClearRef.current = null;
        }
        if (protectedCreatedDealRef.current?.id === currentSelectedDealId) {
          protectedCreatedDealRef.current = null;
        }
        return dealsData;
      }
      if (deepLinkedDealIdRef.current === currentSelectedDealId) {
        const preservedDeepLinkedDeal = preservedDeepLinkedDealRef.current;
        if (preservedDeepLinkedDeal?.id === currentSelectedDealId) {
          updateAppData((prev) => {
            if (prev.deals.some((deal) => deal.id === preservedDeepLinkedDeal.id)) {
              return {};
            }
            return { deals: [preservedDeepLinkedDeal, ...prev.deals] };
          });
        }
        return dealsData;
      }
      if (skipNextMissingSelectedDealClearRef.current === currentSelectedDealId) {
        skipNextMissingSelectedDealClearRef.current = null;
        return dealsData;
      }
      const protectedCreatedDeal = protectedCreatedDealRef.current;
      if (protectedCreatedDeal?.id === currentSelectedDealId) {
        updateAppData((prev) => {
          if (prev.deals.some((deal) => deal.id === protectedCreatedDeal.id)) {
            return {};
          }
          return { deals: [protectedCreatedDeal, ...prev.deals] };
        });
        return dealsData;
      }
      clearSelectedDealFocus();
      return dealsData;
    },
    [clearSelectedDealFocus, refreshDeals, restoreDealsQuotesFromCache, updateAppData],
  );

  const syncDealsByIds = useCallback(
    async (dealIds: (string | null | undefined)[]) => {
      const normalizedIds = Array.from(new Set(dealIds.filter((id): id is string => Boolean(id))));
      if (!normalizedIds.length) {
        return;
      }
      const fetchedDeals = await Promise.all(normalizedIds.map((dealId) => fetchDeal(dealId)));
      updateAppData((prev) => {
        const existingDealsById = new Map(prev.deals.map((deal) => [deal.id, deal]));
        const dealMap = new Map<string, Deal>(
          fetchedDeals.map((deal) => [
            deal.id,
            mergeDealWithHydratedQuotes(deal, existingDealsById.get(deal.id)),
          ]),
        );
        const existingIds = new Set(prev.deals.map((deal) => deal.id));
        const updatedDeals = prev.deals.map((deal) => dealMap.get(deal.id) ?? deal);
        const missingDeals = fetchedDeals
          .filter((deal) => !existingIds.has(deal.id))
          .map((deal) => dealMap.get(deal.id) ?? deal);
        const preservedDeepLinkedDeal = deepLinkedDealIdRef.current
          ? (dealMap.get(deepLinkedDealIdRef.current) ??
            existingDealsById.get(deepLinkedDealIdRef.current) ??
            fetchedDeals.find((deal) => deal.id === deepLinkedDealIdRef.current) ??
            null)
          : null;
        preservedDeepLinkedDealRef.current = preservedDeepLinkedDeal;
        return { deals: [...updatedDeals, ...missingDeals] };
      });
      invalidateDealsCache();
    },
    [invalidateDealsCache, mergeDealWithHydratedQuotes, updateAppData],
  );

  useEffect(() => {
    if (!isDealsRoute) {
      deepLinkedDealLoadedRef.current = null;
      deepLinkedDealLoadingRef.current = null;
      return;
    }

    if (!deepLinkedDealId) {
      deepLinkedDealLoadedRef.current = null;
      deepLinkedDealLoadingRef.current = null;
      return;
    }

    if (!isAuthenticated) {
      return;
    }

    if (dealsById.has(deepLinkedDealId)) {
      deepLinkedDealLoadedRef.current = deepLinkedDealId;
      deepLinkedDealLoadingRef.current = null;
      return;
    }

    if (
      deepLinkedDealLoadedRef.current === deepLinkedDealId ||
      deepLinkedDealLoadingRef.current === deepLinkedDealId
    ) {
      return;
    }

    deepLinkedDealLoadingRef.current = deepLinkedDealId;
    syncDealsByIds([deepLinkedDealId])
      .then(() => {
        deepLinkedDealLoadedRef.current = deepLinkedDealId;
      })
      .catch((err) => {
        deepLinkedDealLoadedRef.current = null;
        if (err instanceof APIError && err.status === 403) {
          setError('Нет доступа к сделке по ссылке.');
          return;
        }
        if (err instanceof APIError && err.status === 404) {
          setError('Сделка по ссылке не найдена.');
          return;
        }
        setError(formatErrorMessage(err, 'Не удалось открыть сделку по ссылке.'));
      })
      .finally(() => {
        if (deepLinkedDealLoadingRef.current === deepLinkedDealId) {
          deepLinkedDealLoadingRef.current = null;
        }
      });
  }, [deepLinkedDealId, dealsById, isAuthenticated, isDealsRoute, setError, syncDealsByIds]);

  const handleSelectDeal = useCallback(
    (dealId: string) => {
      if (isDealSelectionBlocked) {
        return;
      }
      selectDealById(dealId);
      if (!dealId || dealsById.has(dealId)) {
        return;
      }
      syncDealsByIds([dealId]).catch((err) => {
        setError(formatErrorMessage(err, 'Не удалось загрузить сделку'));
      });
    },
    [dealsById, isDealSelectionBlocked, selectDealById, setError, syncDealsByIds],
  );

  const handleOpenDealPreview = useCallback(
    (dealId: string) => {
      openDealPreviewById(dealId);
      handleSelectDeal(dealId);
    },
    [handleSelectDeal, openDealPreviewById],
  );

  const handleRefreshSelectedDeal = useCallback(
    async (dealId: string) => {
      await syncDealsByIds([dealId]);
      await refreshDealsWithSelection(dealFilters, { force: true });
      await rehydrateDealDetailsRef.current(dealId);
    },
    [dealFilters, refreshDealsWithSelection, syncDealsByIds],
  );

  const handleRefreshDealsList = useCallback(async () => {
    setIsRefreshingDealsList(true);
    setError(null);
    invalidateDealsCache();
    try {
      await refreshDealsWithSelection(dealFilters, { force: true });
    } catch (err) {
      setError(formatErrorMessage(err, 'Ошибка при обновлении списка сделок'));
      throw err;
    } finally {
      setIsRefreshingDealsList(false);
    }
  }, [
    dealFilters,
    invalidateDealsCache,
    refreshDealsWithSelection,
    setError,
    setIsRefreshingDealsList,
  ]);

  useEffect(() => {
    deepLinkedDealIdRef.current = deepLinkedDealId;
    if (!deepLinkedDealId) {
      preservedDeepLinkedDealRef.current = null;
      return;
    }

    if (preservedDeepLinkedDealRef.current?.id !== deepLinkedDealId) {
      preservedDeepLinkedDealRef.current = dealsById.get(deepLinkedDealId) ?? null;
      return;
    }

    const currentDeepLinkedDeal = dealsById.get(deepLinkedDealId);
    if (currentDeepLinkedDeal) {
      preservedDeepLinkedDealRef.current = currentDeepLinkedDeal;
    }
  }, [dealsById, deepLinkedDealId]);

  useEffect(() => {
    selectedDealIdRef.current = effectiveSelectedDealId;
    const protectedCreatedDeal = protectedCreatedDealRef.current;
    if (
      protectedCreatedDeal &&
      effectiveSelectedDealId &&
      effectiveSelectedDealId !== protectedCreatedDeal.id
    ) {
      protectedCreatedDealRef.current = null;
    }
  }, [effectiveSelectedDealId]);

  useEffect(() => {
    previewDealIdRef.current = previewDealId;
  }, [previewDealId]);

  const loadDealTasks = useCallback(
    async (dealId: string) => {
      const cached = dealTasksCacheRef.current.get(dealId);
      if (cached && isCacheFresh(cached.loadedAt)) {
        updateAppData((prev) => ({
          tasks: [...prev.tasks.filter((task) => task.dealId !== dealId), ...cached.data],
        }));
        return;
      }

      const existingPromise = dealTasksInFlightRef.current.get(dealId);
      if (existingPromise) {
        markDealTasksLoading(dealId);
        try {
          const dealTasks = await existingPromise;
          updateAppData((prev) => ({
            tasks: [...prev.tasks.filter((task) => task.dealId !== dealId), ...dealTasks],
          }));
        } catch (err) {
          setError(formatErrorMessage(err, 'Error loading tasks for the deal'));
        } finally {
          unmarkDealTasksLoading(dealId);
        }
        return;
      }

      const request = fetchTasksByDeal(dealId, { showDeleted: true })
        .then((dealTasks) => {
          dealTasksCacheRef.current.set(dealId, { loadedAt: Date.now(), data: dealTasks });
          return dealTasks;
        })
        .finally(() => {
          dealTasksInFlightRef.current.delete(dealId);
        });
      dealTasksInFlightRef.current.set(dealId, request);

      markDealTasksLoading(dealId);
      try {
        const dealTasks = await request;
        updateAppData((prev) => ({
          tasks: [...prev.tasks.filter((task) => task.dealId !== dealId), ...dealTasks],
        }));
      } catch (err) {
        setError(formatErrorMessage(err, 'Error loading tasks for the deal'));
      } finally {
        unmarkDealTasksLoading(dealId);
      }
    },
    [isCacheFresh, markDealTasksLoading, setError, unmarkDealTasksLoading, updateAppData],
  );

  const loadDealQuotes = useCallback(
    async (dealId: string) => {
      const cached = dealQuotesCacheRef.current.get(dealId);
      if (cached && isCacheFresh(cached.loadedAt)) {
        updateAppData((prev) => ({
          deals: prev.deals.map((deal) =>
            deal.id === dealId ? { ...deal, quotes: cached.data } : deal,
          ),
        }));
        return;
      }

      const existingPromise = dealQuotesInFlightRef.current.get(dealId);
      if (existingPromise) {
        markDealQuotesLoading(dealId);
        try {
          const dealQuotes = await existingPromise;
          updateAppData((prev) => ({
            deals: prev.deals.map((deal) =>
              deal.id === dealId ? { ...deal, quotes: dealQuotes } : deal,
            ),
          }));
        } catch (err) {
          setError(formatErrorMessage(err, 'Error loading quotes for the deal'));
        } finally {
          unmarkDealQuotesLoading(dealId);
        }
        return;
      }

      const request = fetchQuotesByDeal(dealId, { showDeleted: true })
        .then((dealQuotes) => {
          cacheDealQuotes(dealId, dealQuotes);
          return dealQuotes;
        })
        .finally(() => {
          dealQuotesInFlightRef.current.delete(dealId);
        });
      dealQuotesInFlightRef.current.set(dealId, request);

      markDealQuotesLoading(dealId);
      try {
        const dealQuotes = await request;
        updateAppData((prev) => ({
          deals: prev.deals.map((deal) =>
            deal.id === dealId ? { ...deal, quotes: dealQuotes } : deal,
          ),
        }));
      } catch (err) {
        setError(formatErrorMessage(err, 'Error loading quotes for the deal'));
      } finally {
        unmarkDealQuotesLoading(dealId);
      }
    },
    [
      cacheDealQuotes,
      isCacheFresh,
      markDealQuotesLoading,
      setError,
      unmarkDealQuotesLoading,
      updateAppData,
    ],
  );

  useEffect(() => {
    rehydrateDealDetailsRef.current = async (dealId: string) => {
      await Promise.all([loadDealTasks(dealId), loadDealQuotes(dealId), loadDealPayments(dealId)]);
    };
  }, [loadDealPayments, loadDealQuotes, loadDealTasks]);

  useEffect(() => {
    if (!effectiveSelectedDealId || !isAuthenticated) {
      return;
    }
    void loadDealTasks(effectiveSelectedDealId);
    void loadDealQuotes(effectiveSelectedDealId);
    void loadDealPayments(effectiveSelectedDealId);
  }, [effectiveSelectedDealId, isAuthenticated, loadDealPayments, loadDealQuotes, loadDealTasks]);

  useEffect(() => {
    if (!previewDealId || !isAuthenticated || previewDealId === effectiveSelectedDealId) {
      return;
    }
    void loadDealPayments(previewDealId);
  }, [effectiveSelectedDealId, isAuthenticated, loadDealPayments, previewDealId]);

  const handleRefreshSelectedDealPolicies = useCallback(
    async (options?: { force?: boolean }) => {
      const dealId = selectedDealIdRef.current;
      if (!dealId) {
        return;
      }
      await loadDealPolicies(dealId, options);
    },
    [loadDealPolicies],
  );

  const handleRefreshPreviewDealPolicies = useCallback(
    async (options?: { force?: boolean }) => {
      const dealId = previewDealIdRef.current;
      if (!dealId) {
        return;
      }
      await loadDealPolicies(dealId, options);
    },
    [loadDealPolicies],
  );

  const registerProtectedCreatedDeal = useCallback((deal: Deal) => {
    protectedCreatedDealRef.current = deal;
    skipNextMissingSelectedDealClearRef.current = deal.id;
  }, []);

  return {
    dealsById,
    mergeDealWithHydratedQuotes,
    invalidateDealTasksCache,
    invalidateDealQuotesCache,
    invalidateDealPoliciesCache,
    invalidateDealPaymentsCache,
    cacheDealQuotes,
    refreshDealsWithSelection,
    syncDealsByIds,
    handleSelectDeal,
    handleOpenDealPreview,
    handleRefreshSelectedDeal,
    handleRefreshDealsList,
    loadDealPolicies,
    loadDealPayments,
    loadDealTasks,
    loadDealQuotes,
    handleRefreshSelectedDealPolicies,
    handleRefreshPreviewDealPolicies,
    registerProtectedCreatedDeal,
    isSelectedDealTasksLoading: effectiveSelectedDealId
      ? dealTasksLoadingIds.has(effectiveSelectedDealId)
      : false,
    isSelectedDealQuotesLoading: effectiveSelectedDealId
      ? dealQuotesLoadingIds.has(effectiveSelectedDealId)
      : false,
    isPreviewDealTasksLoading: previewDealId ? dealTasksLoadingIds.has(previewDealId) : false,
    isPreviewDealQuotesLoading: previewDealId ? dealQuotesLoadingIds.has(previewDealId) : false,
  };
};
