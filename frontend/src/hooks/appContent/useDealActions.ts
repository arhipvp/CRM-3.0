import { useCallback } from 'react';
import type { Dispatch, SetStateAction } from 'react';

import {
  APIError,
  checkDealMailbox,
  closeDeal,
  createChatMessage,
  createDeal,
  createDealMailbox,
  createQuote,
  createTask,
  deleteChatMessage,
  deleteDeal,
  deleteQuote,
  deleteTask,
  fetchChatMessages,
  mergeDeals,
  pinDeal,
  reopenDeal,
  restoreDeal,
  unpinDeal,
  updateDeal,
  updateQuote,
  updateTask,
} from '../../api';
import { confirmTexts } from '../../constants/confirmTexts';
import type { NotificationContextType } from '../../contexts/NotificationTypes';
import type { AddTaskFormValues } from '../../components/forms/AddTaskForm';
import type { DealFormValues } from '../../components/forms/DealForm';
import type { QuoteFormValues } from '../../components/forms/AddQuoteForm';
import type { Deal, Quote } from '../../types';
import { markQuoteAsDeleted } from '../../utils/quotes';
import { markTaskAsDeleted } from '../../utils/tasks';
import { formatErrorMessage } from '../../utils/formatErrorMessage';
import type { FilterParams } from '../../api';
import type { useAppData } from '../useAppData';
import type { useConfirm } from '../useConfirm';

type UpdateAppData = ReturnType<typeof useAppData>['updateAppData'];
type Confirm = ReturnType<typeof useConfirm>['confirm'];
type AddNotification = NotificationContextType['addNotification'];

interface UseDealActionsParams {
  deals: Deal[];
  dealsById: Map<string, Deal>;
  selectedDeal: Deal | null;
  selectedDealId: string | null;
  isDealFocusCleared: boolean;
  isDealsRoute: boolean;
  dealFilters: FilterParams;
  editingQuote: Quote | null;
  setEditingQuote: Dispatch<SetStateAction<Quote | null>>;
  setQuoteDealId: Dispatch<SetStateAction<string | null>>;
  setModal: Dispatch<SetStateAction<null | 'client' | 'deal'>>;
  confirm: Confirm;
  addNotification: AddNotification;
  setError: Dispatch<SetStateAction<string | null>>;
  setIsSyncing: Dispatch<SetStateAction<boolean>>;
  updateAppData: UpdateAppData;
  invalidateDealsCache: () => void;
  refreshDeals: ReturnType<typeof useAppData>['refreshDeals'];
  refreshDealsWithSelection: (
    filters?: FilterParams,
    options?: { force?: boolean },
  ) => Promise<Deal[]>;
  selectDealById: (dealId: string) => void;
  clearSelectedDealFocus: () => void;
  resetDealSelection: () => void;
  requestDealRowFocus: (dealId: string) => void;
  registerProtectedCreatedDeal: (deal: Deal) => void;
  invalidateDealQuotesCache: (dealId?: string | null) => void;
  invalidateDealTasksCache: (dealId?: string | null) => void;
  cacheDealQuotes: (dealId: string, quotes: Quote[]) => void;
  openDealPreview: (dealId: string) => void;
}

export const useDealActions = ({
  deals,
  dealsById,
  selectedDeal,
  selectedDealId,
  isDealFocusCleared,
  isDealsRoute,
  dealFilters,
  editingQuote,
  setEditingQuote,
  setQuoteDealId,
  setModal,
  confirm,
  addNotification,
  setError,
  setIsSyncing,
  updateAppData,
  invalidateDealsCache,
  refreshDeals,
  refreshDealsWithSelection,
  selectDealById,
  clearSelectedDealFocus,
  resetDealSelection,
  requestDealRowFocus,
  registerProtectedCreatedDeal,
  invalidateDealQuotesCache,
  invalidateDealTasksCache,
  cacheDealQuotes,
  openDealPreview,
}: UseDealActionsParams) => {
  const handleAddDeal = useCallback(
    async (data: DealFormValues) => {
      invalidateDealsCache();
      const created = await createDeal({
        title: data.title,
        clientId: data.clientId,
        description: data.description,
        expectedClose: data.expectedClose,
        executorId: data.executorId,
        source: data.source?.trim() || undefined,
        visibleUserIds: data.visibleUserIds,
      });
      updateAppData((prev) => ({ deals: [created, ...prev.deals] }));
      registerProtectedCreatedDeal(created);
      selectDealById(created.id);
      requestDealRowFocus(created.id);
      setModal(null);
    },
    [
      invalidateDealsCache,
      registerProtectedCreatedDeal,
      requestDealRowFocus,
      selectDealById,
      setModal,
      updateAppData,
    ],
  );

  const handleCloseDeal = useCallback(
    async (dealId: string, payload: { reason: string; status?: 'won' | 'lost' }) => {
      invalidateDealsCache();
      setIsSyncing(true);
      try {
        const updated = await closeDeal(dealId, payload);
        updateAppData((prev) => ({
          deals: prev.deals.map((deal) => (deal.id === updated.id ? updated : deal)),
        }));
      } catch (err) {
        const message =
          err instanceof APIError
            ? err.message
            : err instanceof Error
              ? err.message
              : 'Ошибка при закрытии сделки';
        setError(message);
      } finally {
        setIsSyncing(false);
      }
    },
    [invalidateDealsCache, setError, setIsSyncing, updateAppData],
  );

  const handleReopenDeal = useCallback(
    async (dealId: string) => {
      invalidateDealsCache();
      setIsSyncing(true);
      try {
        const updated = await reopenDeal(dealId);
        updateAppData((prev) => ({
          deals: prev.deals.map((deal) => (deal.id === updated.id ? updated : deal)),
        }));
        selectDealById(updated.id);
      } catch (err) {
        if (err instanceof APIError && err.status === 403) {
          addNotification('Ошибка доступа при восстановлении сделки', 'error', 4000);
        } else {
          setError(formatErrorMessage(err, 'Ошибка при восстановлении сделки'));
        }
      } finally {
        setIsSyncing(false);
      }
    },
    [addNotification, invalidateDealsCache, selectDealById, setError, setIsSyncing, updateAppData],
  );

  const handleUpdateDeal = useCallback(
    async (dealId: string, data: DealFormValues) => {
      invalidateDealsCache();
      setIsSyncing(true);
      try {
        const updated = await updateDeal(dealId, data);
        updateAppData((prev) => ({
          deals: prev.deals.map((deal) => (deal.id === updated.id ? updated : deal)),
        }));
        selectDealById(updated.id);
      } catch (err) {
        if (err instanceof APIError && err.status === 403) {
          addNotification('Ошибка доступа при обновлении сделки', 'error', 4000);
        } else {
          setError(formatErrorMessage(err, 'Ошибка при обновлении сделки'));
        }
        throw err;
      } finally {
        setIsSyncing(false);
      }
    },
    [addNotification, invalidateDealsCache, selectDealById, setError, setIsSyncing, updateAppData],
  );

  const handlePinDeal = useCallback(
    async (dealId: string) => {
      invalidateDealsCache();
      setIsSyncing(true);
      try {
        await pinDeal(dealId);
        await refreshDealsWithSelection(dealFilters, { force: true });
        addNotification('Сделка закреплена', 'success', 3000);
      } catch (err) {
        if (err instanceof APIError && err.status === 400) {
          addNotification(err.message || 'Нельзя закрепить больше 5 сделок', 'error', 4000);
        } else {
          setError(formatErrorMessage(err, 'Ошибка при закреплении сделки'));
        }
        throw err;
      } finally {
        setIsSyncing(false);
      }
    },
    [
      addNotification,
      dealFilters,
      invalidateDealsCache,
      refreshDealsWithSelection,
      setError,
      setIsSyncing,
    ],
  );

  const handleUnpinDeal = useCallback(
    async (dealId: string) => {
      invalidateDealsCache();
      setIsSyncing(true);
      try {
        await unpinDeal(dealId);
        await refreshDealsWithSelection(dealFilters, { force: true });
        addNotification('Сделка откреплена', 'success', 3000);
      } catch (err) {
        setError(formatErrorMessage(err, 'Ошибка при откреплении сделки'));
        throw err;
      } finally {
        setIsSyncing(false);
      }
    },
    [
      addNotification,
      dealFilters,
      invalidateDealsCache,
      refreshDealsWithSelection,
      setError,
      setIsSyncing,
    ],
  );

  const handlePostponeDeal = useCallback(
    async (dealId: string, data: DealFormValues) => {
      invalidateDealsCache();
      const previousSelection = selectedDealId;
      const previousFocusCleared = isDealFocusCleared;
      setIsSyncing(true);
      try {
        await updateDeal(dealId, data);
        await refreshDeals(dealFilters, { force: true, preserveLoadedCount: true });
        clearSelectedDealFocus();
      } catch (err) {
        if (previousSelection) {
          selectDealById(previousSelection);
        } else if (previousFocusCleared) {
          clearSelectedDealFocus();
        } else {
          resetDealSelection();
        }
        if (err instanceof APIError && err.status === 403) {
          addNotification('Ошибка доступа при обновлении сделки', 'error', 4000);
        } else {
          setError(formatErrorMessage(err, 'Не удалось обновить сделку'));
        }
        throw err;
      } finally {
        setIsSyncing(false);
      }
    },
    [
      addNotification,
      clearSelectedDealFocus,
      dealFilters,
      invalidateDealsCache,
      isDealFocusCleared,
      refreshDeals,
      resetDealSelection,
      selectedDealId,
      selectDealById,
      setError,
      setIsSyncing,
    ],
  );

  const handleDeleteDeal = useCallback(
    async (dealId: string) => {
      const confirmed = await confirm(confirmTexts.deleteDeal());
      if (!confirmed) {
        return;
      }

      setIsSyncing(true);
      try {
        await deleteDeal(dealId);
        await refreshDealsWithSelection(dealFilters, { force: true });
        setError(null);
        addNotification('Сделка удалена', 'success', 4000);
      } catch (err) {
        if (err instanceof APIError && err.status === 403) {
          addNotification('Ошибка доступа при удалении сделки', 'error', 4000);
        } else {
          setError(formatErrorMessage(err, 'Не удалось удалить сделку'));
        }
      } finally {
        setIsSyncing(false);
      }
    },
    [addNotification, confirm, dealFilters, refreshDealsWithSelection, setError, setIsSyncing],
  );

  const handleRestoreDeal = useCallback(
    async (dealId: string) => {
      setIsSyncing(true);
      try {
        const restored = await restoreDeal(dealId);
        await refreshDealsWithSelection(dealFilters, { force: true });
        selectDealById(restored.id);
        setError(null);
        addNotification('Сделка восстановлена', 'success', 4000);
      } catch (err) {
        if (err instanceof APIError && err.status === 403) {
          addNotification('Ошибка доступа при восстановлении сделки', 'error', 4000);
        } else {
          setError(formatErrorMessage(err, 'Не удалось восстановить сделку'));
        }
      } finally {
        setIsSyncing(false);
      }
    },
    [
      addNotification,
      dealFilters,
      refreshDealsWithSelection,
      selectDealById,
      setError,
      setIsSyncing,
    ],
  );

  const openSelectedDealPreview = useCallback(() => {
    if (!isDealsRoute || !selectedDeal?.id) {
      return;
    }
    openDealPreview(selectedDeal.id);
  }, [isDealsRoute, openDealPreview, selectedDeal]);

  const deleteSelectedDeal = useCallback(async () => {
    if (!isDealsRoute || !selectedDeal?.id || selectedDeal.deletedAt) {
      return;
    }
    await handleDeleteDeal(selectedDeal.id);
  }, [handleDeleteDeal, isDealsRoute, selectedDeal]);

  const restoreSelectedDeal = useCallback(async () => {
    if (!isDealsRoute || !selectedDeal?.id || !selectedDeal.deletedAt) {
      return;
    }
    await handleRestoreDeal(selectedDeal.id);
  }, [handleRestoreDeal, isDealsRoute, selectedDeal]);

  const handleMergeDeals = useCallback(
    async (
      targetDealId: string,
      sourceDealIds: string[],
      finalDeal: DealFormValues,
      previewSnapshotId?: string,
    ) => {
      invalidateDealsCache();
      setIsSyncing(true);
      try {
        const result = await mergeDeals({
          targetDealId,
          sourceDealIds,
          finalDeal,
          includeDeleted: true,
          previewSnapshotId,
        });
        updateAppData((prev) => {
          const mergedIds = new Set(result.mergedDealIds);
          const resultDealId = result.resultDeal.id;
          const resultDealTitle = result.resultDeal.title;
          const resultClientName = result.resultDeal.clientName;

          return {
            deals: [...prev.deals.filter((deal) => !mergedIds.has(deal.id)), result.resultDeal],
            policies: prev.policies.map((policy) =>
              mergedIds.has(policy.dealId)
                ? {
                    ...policy,
                    dealId: resultDealId,
                    dealTitle: resultDealTitle,
                  }
                : policy,
            ),
            payments: prev.payments.map((payment) =>
              payment.dealId && mergedIds.has(payment.dealId)
                ? {
                    ...payment,
                    dealId: resultDealId,
                    dealTitle: resultDealTitle,
                    dealClientName: resultClientName ?? payment.dealClientName,
                  }
                : payment,
            ),
            tasks: prev.tasks.map((task) =>
              task.dealId && mergedIds.has(task.dealId)
                ? {
                    ...task,
                    dealId: resultDealId,
                    dealTitle: resultDealTitle,
                    clientName: resultClientName ?? task.clientName,
                  }
                : task,
            ),
          };
        });
        selectDealById(result.resultDeal.id);
        setError(null);
        addNotification('Сделки объединены', 'success', 4000);
        (result.warnings ?? []).forEach((warning) => {
          addNotification(warning, 'warning', 7000);
        });
      } catch (err) {
        setError(formatErrorMessage(err, 'Ошибка объединения сделок'));
        throw err;
      } finally {
        setIsSyncing(false);
      }
    },
    [addNotification, invalidateDealsCache, selectDealById, setError, setIsSyncing, updateAppData],
  );

  const handleAddQuote = useCallback(
    async (dealId: string, values: QuoteFormValues) => {
      invalidateDealsCache();
      invalidateDealQuotesCache(dealId);
      try {
        const created = await createQuote({ dealId, ...values });
        const nextQuotesForDeal = [created, ...(dealsById.get(dealId)?.quotes ?? [])];
        cacheDealQuotes(dealId, nextQuotesForDeal);
        updateAppData((prev) => ({
          deals: prev.deals.map((deal) =>
            deal.id === dealId ? { ...deal, quotes: [created, ...(deal.quotes ?? [])] } : deal,
          ),
        }));
        setQuoteDealId(null);
      } catch (err) {
        setError(formatErrorMessage(err, 'Ошибка при добавлении предложения'));
        throw err;
      }
    },
    [
      cacheDealQuotes,
      dealsById,
      invalidateDealQuotesCache,
      invalidateDealsCache,
      setError,
      setQuoteDealId,
      updateAppData,
    ],
  );

  const handleUpdateQuote = useCallback(
    async (values: QuoteFormValues) => {
      if (!editingQuote) {
        return;
      }
      invalidateDealsCache();
      const { id, dealId } = editingQuote;
      invalidateDealQuotesCache(dealId);
      try {
        const updated = await updateQuote(id, values);
        const nextQuotesForDeal = (dealsById.get(dealId)?.quotes ?? []).map((quote) =>
          quote.id === id ? updated : quote,
        );
        cacheDealQuotes(dealId, nextQuotesForDeal);
        updateAppData((prev) => ({
          deals: prev.deals.map((deal) =>
            deal.id === dealId
              ? {
                  ...deal,
                  quotes: deal.quotes
                    ? deal.quotes.map((quote) => (quote.id === id ? updated : quote))
                    : [updated],
                }
              : deal,
          ),
        }));
        setEditingQuote(null);
      } catch (err) {
        setError(formatErrorMessage(err, 'Ошибка при обновлении предложения'));
        throw err;
      }
    },
    [
      cacheDealQuotes,
      dealsById,
      editingQuote,
      invalidateDealQuotesCache,
      invalidateDealsCache,
      setEditingQuote,
      setError,
      updateAppData,
    ],
  );

  const handleRequestEditQuote = useCallback(
    (quote: Quote) => {
      setEditingQuote(quote);
    },
    [setEditingQuote],
  );

  const handleDeleteQuote = useCallback(
    async (dealId: string, quoteId: string) => {
      invalidateDealsCache();
      invalidateDealQuotesCache(dealId);
      try {
        await deleteQuote(quoteId);
        const nextQuotesForDeal = markQuoteAsDeleted(dealsById.get(dealId)?.quotes ?? [], quoteId);
        cacheDealQuotes(dealId, nextQuotesForDeal);
        updateAppData((prev) => ({
          deals: prev.deals.map((deal) =>
            deal.id === dealId
              ? { ...deal, quotes: markQuoteAsDeleted(deal.quotes ?? [], quoteId) }
              : deal,
          ),
        }));
      } catch (err) {
        setError(formatErrorMessage(err, 'Ошибка при удалении предложения'));
        throw err;
      }
    },
    [
      cacheDealQuotes,
      dealsById,
      invalidateDealQuotesCache,
      invalidateDealsCache,
      setError,
      updateAppData,
    ],
  );

  const handleDriveFolderCreated = useCallback(
    (dealId: string, folderId: string) => {
      invalidateDealsCache();
      updateAppData((prev) => ({
        deals: prev.deals.map((deal) =>
          deal.id === dealId ? { ...deal, driveFolderId: folderId } : deal,
        ),
      }));
    },
    [invalidateDealsCache, updateAppData],
  );

  const handleFetchChatMessages = useCallback(
    async (dealId: string) => {
      try {
        return await fetchChatMessages(dealId);
      } catch (err) {
        setError(formatErrorMessage(err, 'Не удалось загрузить сообщения'));
        throw err;
      }
    },
    [setError],
  );

  const handleCreateDealMailbox = useCallback(
    async (dealId: string) => {
      const result = await createDealMailbox(dealId);
      updateAppData((prev) => ({
        deals: prev.deals.map((deal) => (deal.id === result.deal.id ? result.deal : deal)),
      }));
      invalidateDealsCache();
      return result;
    },
    [invalidateDealsCache, updateAppData],
  );

  const handleCheckDealMailbox = useCallback(
    async (dealId: string) => {
      const result = await checkDealMailbox(dealId);
      updateAppData((prev) => ({
        deals: prev.deals.map((deal) => (deal.id === result.deal.id ? result.deal : deal)),
      }));
      invalidateDealsCache();
      return result;
    },
    [invalidateDealsCache, updateAppData],
  );

  const handleSendChatMessage = useCallback(
    async (dealId: string, body: string) => {
      try {
        return await createChatMessage(dealId, body);
      } catch (err) {
        setError(formatErrorMessage(err, 'Не удалось отправить сообщение'));
        throw err;
      }
    },
    [setError],
  );

  const handleDeleteChatMessage = useCallback(
    async (messageId: string) => {
      try {
        await deleteChatMessage(messageId);
      } catch (err) {
        setError(formatErrorMessage(err, 'Не удалось удалить сообщение'));
        throw err;
      }
    },
    [setError],
  );

  const handleCreateTask = useCallback(
    async (dealId: string, data: AddTaskFormValues) => {
      setIsSyncing(true);
      invalidateDealTasksCache(dealId);
      try {
        const created = await createTask({ dealId, ...data });
        updateAppData((prev) => ({ tasks: [created, ...prev.tasks] }));
      } catch (err) {
        setError(formatErrorMessage(err, 'Ошибка при создании задачи'));
        throw err;
      } finally {
        setIsSyncing(false);
      }
    },
    [invalidateDealTasksCache, setError, setIsSyncing, updateAppData],
  );

  const handleUpdateTask = useCallback(
    async (taskId: string, data: Partial<AddTaskFormValues>) => {
      setIsSyncing(true);
      invalidateDealTasksCache();
      try {
        const updated = await updateTask(taskId, data);
        updateAppData((prev) => ({
          tasks: prev.tasks.map((task) => (task.id === updated.id ? updated : task)),
        }));
      } catch (err) {
        if (err instanceof APIError && err.status === 403) {
          addNotification('Ошибка доступа при обновлении задачи', 'error', 4000);
        } else {
          setError(formatErrorMessage(err, 'Ошибка при обновлении задачи'));
        }
        throw err;
      } finally {
        setIsSyncing(false);
      }
    },
    [addNotification, invalidateDealTasksCache, setError, setIsSyncing, updateAppData],
  );

  const handleDeleteTask = useCallback(
    async (taskId: string) => {
      invalidateDealTasksCache();
      try {
        await deleteTask(taskId);
        updateAppData((prev) => ({ tasks: markTaskAsDeleted(prev.tasks, taskId) }));
      } catch (err) {
        setError(formatErrorMessage(err, 'Ошибка при удалении задачи'));
        throw err;
      }
    },
    [invalidateDealTasksCache, setError, updateAppData],
  );

  const cycleSelectedDeal = useCallback(
    (direction: 1 | -1) => {
      if (!isDealsRoute || !deals.length) {
        return;
      }

      if (!selectedDealId) {
        selectDealById(deals[0].id);
        return;
      }

      const currentIndex = deals.findIndex((deal) => deal.id === selectedDealId);
      if (currentIndex < 0) {
        selectDealById(deals[0].id);
        return;
      }

      const nextIndex = (currentIndex + direction + deals.length) % deals.length;
      selectDealById(deals[nextIndex].id);
    },
    [deals, isDealsRoute, selectedDealId, selectDealById],
  );

  return {
    handleAddDeal,
    handleCloseDeal,
    handleReopenDeal,
    handleUpdateDeal,
    handlePinDeal,
    handleUnpinDeal,
    handlePostponeDeal,
    handleDeleteDeal,
    handleRestoreDeal,
    handleMergeDeals,
    handleAddQuote,
    handleUpdateQuote,
    handleRequestEditQuote,
    handleDeleteQuote,
    handleDriveFolderCreated,
    handleFetchChatMessages,
    handleCreateDealMailbox,
    handleCheckDealMailbox,
    handleSendChatMessage,
    handleDeleteChatMessage,
    handleCreateTask,
    handleUpdateTask,
    handleDeleteTask,
    cycleSelectedDeal,
    openSelectedDealPreview,
    deleteSelectedDeal,
    restoreSelectedDeal,
  };
};
