import { useCallback, useEffect, useRef, useState } from 'react';

import { fetchNotificationSettings } from '../../../../api/notifications';
import type { Deal, Task } from '../../../../types';
import type { DealEvent } from '../eventUtils';
import { runAsyncUiAction } from '../../../../utils/uiAction';

interface UseDealDetailsPanelActionsParams {
  selectedDeal: Deal | null;
  relatedTasks: Task[];
  dealEvents: DealEvent[];
  nextDelayEventId: string | null;
  selectedDelayEvent: DealEvent | null;
  selectedDelayEventNextContact: string | null;
  isSelectedDealDeleted: boolean;
  isDealClosedStatus: boolean;
  isCurrentUserSeller: boolean;
  canReopenClosedDeal: boolean;
  onDeleteDeal: (dealId: string) => Promise<void>;
  onRestoreDeal: (dealId: string) => Promise<void>;
  onCloseDeal: (
    dealId: string,
    payload: { reason: string; status?: 'won' | 'lost' },
  ) => Promise<void>;
  onReopenDeal: (dealId: string) => Promise<void>;
  onUpdateTask: (
    taskId: string,
    data: { status: 'done'; completionComment?: string },
  ) => Promise<void>;
  onCreateDealMailbox: (dealId: string) => Promise<{
    deal: { mailboxEmail?: string | null };
    mailboxInitialPassword?: string | null;
  }>;
  onCheckDealMailbox: (dealId: string) => Promise<{
    mailboxSync: { processed: number; skipped: number; failed: number; deleted: number };
  }>;
  onRefreshDeal?: (dealId: string) => Promise<void>;
  onRefreshPolicies?: (options?: { force?: boolean }) => Promise<void>;
  onScheduleDelay: (payload: { nextContactDate: string; expectedClose: string }) => Promise<void>;
  onLoadChatMessages: () => Promise<void>;
  onLoadActivityLogs: () => Promise<void>;
  onReloadNotes: () => Promise<void>;
  onLoadDriveFiles: () => Promise<void>;
  openMergeModal: () => void;
  openSimilarModal: () => void;
}

export const useDealDetailsPanelActions = ({
  selectedDeal,
  relatedTasks,
  dealEvents,
  nextDelayEventId,
  selectedDelayEvent,
  selectedDelayEventNextContact,
  isSelectedDealDeleted,
  isDealClosedStatus,
  isCurrentUserSeller,
  canReopenClosedDeal,
  onDeleteDeal,
  onRestoreDeal,
  onCloseDeal,
  onReopenDeal,
  onUpdateTask,
  onCreateDealMailbox,
  onCheckDealMailbox,
  onRefreshDeal,
  onRefreshPolicies,
  onScheduleDelay,
  onLoadChatMessages,
  onLoadActivityLogs,
  onReloadNotes,
  onLoadDriveFiles,
  openMergeModal,
  openSimilarModal,
}: UseDealDetailsPanelActionsParams) => {
  const hasRequestedPoliciesRef = useRef(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [isDeletingDeal, setIsDeletingDeal] = useState(false);
  const [isRestoringDeal, setIsRestoringDeal] = useState(false);
  const [isClosingDeal, setIsClosingDeal] = useState(false);
  const [isCloseDealPromptOpen, setIsCloseDealPromptOpen] = useState(false);
  const [closeDealReason, setCloseDealReason] = useState('');
  const [closeDealReasonError, setCloseDealReasonError] = useState<string | null>(null);
  const [isReopeningDeal, setIsReopeningDeal] = useState(false);
  const [isDelayModalOpen, setIsDelayModalOpen] = useState(false);
  const [isSchedulingDelay, setIsSchedulingDelay] = useState(false);
  const [isDealRefreshing, setIsDealRefreshing] = useState(false);
  const [isPoliciesRefreshing, setIsPoliciesRefreshing] = useState(false);
  const [dealRefreshError, setDealRefreshError] = useState<string | null>(null);
  const [selectedDelayEventId, setSelectedDelayEventId] = useState<string | null>(null);
  const [delayLeadDays, setDelayLeadDays] = useState<number | null>(null);
  const [delayLeadDaysLoading, setDelayLeadDaysLoading] = useState(false);
  const [delayNextContactInput, setDelayNextContactInput] = useState<string | null>(null);
  const [delayValidationError, setDelayValidationError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<
    'overview' | 'tasks' | 'policies' | 'quotes' | 'files' | 'chat' | 'history'
  >('overview');
  const [isEditingDeal, setIsEditingDeal] = useState(false);
  const [isCreatingTask, setIsCreatingTask] = useState(false);
  const [isCreatingMailbox, setIsCreatingMailbox] = useState(false);
  const [isCheckingMailbox, setIsCheckingMailbox] = useState(false);
  const [mailboxActionError, setMailboxActionError] = useState<string | null>(null);
  const [mailboxActionSuccess, setMailboxActionSuccess] = useState<string | null>(null);
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
  const [completingTaskIds, setCompletingTaskIds] = useState<string[]>([]);

  useEffect(() => {
    if (activeTab !== 'policies') {
      return;
    }
    if (!onRefreshPolicies || hasRequestedPoliciesRef.current) {
      return;
    }
    hasRequestedPoliciesRef.current = true;
    setIsPoliciesRefreshing(true);
    onRefreshPolicies()
      .catch(() => undefined)
      .finally(() => setIsPoliciesRefreshing(false));
  }, [activeTab, onRefreshPolicies]);

  useEffect(() => {
    hasRequestedPoliciesRef.current = false;
  }, [selectedDeal?.id]);

  useEffect(() => {
    setActiveTab('overview');
    setActionError(null);
    setDealRefreshError(null);
  }, [selectedDeal?.id]);

  useEffect(() => {
    setMailboxActionError(null);
    setMailboxActionSuccess(null);
    setIsCreatingMailbox(false);
    setIsCheckingMailbox(false);
  }, [selectedDeal?.id]);

  useEffect(() => {
    if (!isDelayModalOpen) {
      return;
    }
    let mounted = true;
    setDelayLeadDaysLoading(true);
    setDelayValidationError(null);
    fetchNotificationSettings()
      .then((response) => {
        if (!mounted) {
          return;
        }
        const leadDays = response.settings?.next_contact_lead_days ?? 90;
        setDelayLeadDays(leadDays);
      })
      .catch(() => {
        if (mounted) {
          setDelayLeadDays(null);
        }
      })
      .finally(() => {
        if (mounted) {
          setDelayLeadDaysLoading(false);
        }
      });
    return () => {
      mounted = false;
    };
  }, [isDelayModalOpen]);

  useEffect(() => {
    if (!isDelayModalOpen) {
      return;
    }
    setDelayNextContactInput(selectedDelayEventNextContact);
    setDelayValidationError(null);
  }, [isDelayModalOpen, selectedDelayEvent?.id, selectedDelayEventNextContact]);

  useEffect(() => {
    if (!isDelayModalOpen) {
      return;
    }
    const defaultId = nextDelayEventId ?? dealEvents[0]?.id ?? null;
    setSelectedDelayEventId((prev) => prev ?? defaultId);
  }, [dealEvents, isDelayModalOpen, nextDelayEventId]);

  useEffect(() => {
    if (!isDelayModalOpen) {
      setSelectedDelayEventId(null);
      setDelayNextContactInput(null);
      setDelayValidationError(null);
    }
  }, [isDelayModalOpen]);

  const handleEditDealClick = useCallback(() => {
    if (!selectedDeal || isSelectedDealDeleted) {
      return;
    }
    setActionError(null);
    setIsEditingDeal(true);
  }, [isSelectedDealDeleted, selectedDeal]);

  const handleDeleteDealClick = useCallback(async () => {
    if (!selectedDeal || isSelectedDealDeleted) {
      return;
    }

    await runAsyncUiAction({
      action: () => onDeleteDeal(selectedDeal.id),
      debugLabel: 'Deal delete failed',
      fallbackMessage: 'Не удалось удалить сделку.',
      setPending: setIsDeletingDeal,
      setError: setActionError,
    });
  }, [isSelectedDealDeleted, onDeleteDeal, selectedDeal]);

  const handleRestoreDealClick = useCallback(async () => {
    if (!selectedDeal || !isSelectedDealDeleted) {
      return;
    }

    await runAsyncUiAction({
      action: () => onRestoreDeal(selectedDeal.id),
      debugLabel: 'Deal restore failed',
      fallbackMessage: 'Не удалось восстановить сделку.',
      setPending: setIsRestoringDeal,
      setError: setActionError,
    });
  }, [isSelectedDealDeleted, onRestoreDeal, selectedDeal]);

  const handleCloseDealClick = useCallback(() => {
    if (!selectedDeal || isSelectedDealDeleted || isDealClosedStatus || !isCurrentUserSeller) {
      return;
    }
    setActionError(null);
    setCloseDealReason('');
    setCloseDealReasonError(null);
    setIsCloseDealPromptOpen(true);
  }, [isCurrentUserSeller, isDealClosedStatus, isSelectedDealDeleted, selectedDeal]);

  const handleCloseDealConfirm = useCallback(async () => {
    if (!selectedDeal || isSelectedDealDeleted || isDealClosedStatus || !isCurrentUserSeller) {
      return;
    }

    const trimmedReason = closeDealReason.trim();
    if (!trimmedReason) {
      setCloseDealReasonError('Укажите причину закрытия сделки.');
      return;
    }

    setCloseDealReasonError(null);
    await runAsyncUiAction({
      action: () => onCloseDeal(selectedDeal.id, { reason: trimmedReason, status: 'won' }),
      debugLabel: 'Deal close failed',
      fallbackMessage: 'Не удалось закрыть сделку.',
      setPending: setIsClosingDeal,
      setError: setActionError,
      onSuccess: () => {
        setIsCloseDealPromptOpen(false);
        setCloseDealReason('');
      },
    });
  }, [
    closeDealReason,
    isCurrentUserSeller,
    isDealClosedStatus,
    isSelectedDealDeleted,
    onCloseDeal,
    selectedDeal,
  ]);

  const handleReopenDealClick = useCallback(async () => {
    if (!selectedDeal || !isDealClosedStatus || !canReopenClosedDeal) {
      return;
    }

    await runAsyncUiAction({
      action: () => onReopenDeal(selectedDeal.id),
      debugLabel: 'Deal reopen failed',
      fallbackMessage: 'Не удалось восстановить сделку.',
      setPending: setIsReopeningDeal,
      setError: setActionError,
    });
  }, [canReopenClosedDeal, isDealClosedStatus, onReopenDeal, selectedDeal]);

  const handleMergeClick = useCallback(() => {
    if (!selectedDeal || isSelectedDealDeleted) {
      return;
    }
    setActionError(null);
    openMergeModal();
  }, [isSelectedDealDeleted, openMergeModal, selectedDeal]);

  const handleSimilarClick = useCallback(() => {
    if (!selectedDeal || isSelectedDealDeleted) {
      return;
    }
    setActionError(null);
    openSimilarModal();
  }, [isSelectedDealDeleted, openSimilarModal, selectedDeal]);

  const handleMarkTaskDone = useCallback(
    async (taskId: string, completionComment = '') => {
      if (completingTaskIds.includes(taskId)) {
        return;
      }

      setCompletingTaskIds((prev) => [...prev, taskId]);
      await runAsyncUiAction({
        action: () =>
          onUpdateTask(taskId, {
            status: 'done',
            completionComment: completionComment.trim(),
          }),
        debugLabel: 'Task completion failed',
        fallbackMessage: 'Не удалось отметить задачу выполненной.',
        setError: setActionError,
        onFinally: () => {
          setCompletingTaskIds((prev) => prev.filter((id) => id !== taskId));
        },
      });
    },
    [completingTaskIds, onUpdateTask],
  );

  const handleDelayModalConfirm = useCallback(async () => {
    if (!selectedDeal || !selectedDelayEvent || !delayNextContactInput) {
      return;
    }
    setDelayValidationError(null);

    await runAsyncUiAction({
      action: () =>
        onScheduleDelay({
          nextContactDate: delayNextContactInput,
          expectedClose: selectedDelayEvent.date,
        }),
      debugLabel: 'Deal delay schedule failed',
      fallbackMessage: 'Не удалось обновить даты сделки.',
      setPending: setIsSchedulingDelay,
      setError: setActionError,
      onSuccess: () => {
        setIsDelayModalOpen(false);
      },
    });
  }, [delayNextContactInput, onScheduleDelay, selectedDeal, selectedDelayEvent]);

  const handleCreateMailbox = useCallback(async () => {
    const dealId = selectedDeal?.id;
    if (!dealId) {
      return;
    }

    await runAsyncUiAction({
      action: () => onCreateDealMailbox(dealId),
      debugLabel: 'Deal mailbox create failed',
      fallbackMessage: 'Не удалось создать почтовый ящик сделки.',
      setPending: setIsCreatingMailbox,
      setError: setMailboxActionError,
      onSuccess: (result) => {
        const passwordPart = result.mailboxInitialPassword
          ? ` Пароль: ${result.mailboxInitialPassword}`
          : '';
        setMailboxActionSuccess(`Ящик создан: ${result.deal.mailboxEmail ?? '—'}.${passwordPart}`);
      },
      onError: () => {
        setMailboxActionSuccess(null);
      },
    });
  }, [onCreateDealMailbox, selectedDeal?.id]);

  const handleCheckMailbox = useCallback(async () => {
    const dealId = selectedDeal?.id;
    if (!dealId) {
      return;
    }

    await runAsyncUiAction({
      action: () => onCheckDealMailbox(dealId),
      debugLabel: 'Deal mailbox sync failed',
      fallbackMessage: 'Не удалось проверить почту.',
      setPending: setIsCheckingMailbox,
      setError: setMailboxActionError,
      onSuccess: async (result) => {
        const sync = result.mailboxSync;
        setMailboxActionSuccess(
          `Почта проверена: обработано ${sync.processed}, пропущено ${sync.skipped}, ошибок ${sync.failed}, удалено ${sync.deleted}.`,
        );
        await Promise.all([onReloadNotes(), onLoadDriveFiles()]);
      },
      onError: () => {
        setMailboxActionSuccess(null);
      },
    });
  }, [onCheckDealMailbox, onLoadDriveFiles, onReloadNotes, selectedDeal?.id]);

  const handleRefreshDeal = useCallback(async () => {
    if (!selectedDeal?.id || isDealRefreshing) {
      return;
    }

    await runAsyncUiAction({
      action: async () => {
        await onRefreshDeal?.(selectedDeal.id);
        const operations: Promise<unknown>[] = [onReloadNotes(), onLoadDriveFiles()];
        if (onRefreshPolicies) {
          setIsPoliciesRefreshing(true);
          operations.push(
            onRefreshPolicies({ force: true }).finally(() => {
              setIsPoliciesRefreshing(false);
            }),
          );
        }
        if (activeTab === 'chat') {
          operations.push(onLoadChatMessages());
        }
        if (activeTab === 'history') {
          operations.push(onLoadActivityLogs());
        }
        await Promise.all(operations);
      },
      debugLabel: 'Deal refresh failed',
      fallbackMessage: 'Не удалось обновить данные сделки.',
      setPending: setIsDealRefreshing,
      setError: setDealRefreshError,
    });
  }, [
    activeTab,
    isDealRefreshing,
    onLoadActivityLogs,
    onLoadChatMessages,
    onLoadDriveFiles,
    onRefreshDeal,
    onRefreshPolicies,
    onReloadNotes,
    selectedDeal?.id,
  ]);

  const editingTask = editingTaskId
    ? (relatedTasks.find((task) => task.id === editingTaskId) ?? null)
    : null;

  return {
    actionError,
    activeTab,
    closeDealReason,
    closeDealReasonError,
    completingTaskIds,
    dealRefreshError,
    delayLeadDays,
    delayLeadDaysLoading,
    delayNextContactInput,
    delayValidationError,
    editingTask,
    editingTaskId,
    isCheckingMailbox,
    isCloseDealPromptOpen,
    isClosingDeal,
    isCreatingMailbox,
    isCreatingTask,
    isDealRefreshing,
    isDeletingDeal,
    isDelayModalOpen,
    isEditingDeal,
    isPoliciesRefreshing,
    isReopeningDeal,
    isRestoringDeal,
    isSchedulingDelay,
    mailboxActionError,
    mailboxActionSuccess,
    selectedDelayEventId,
    setActiveTab,
    setCloseDealReason,
    setCloseDealReasonError,
    setDelayNextContactInput,
    setDelayValidationError,
    setEditingTaskId,
    setIsCloseDealPromptOpen,
    setIsCreatingTask,
    setIsDelayModalOpen,
    setIsEditingDeal,
    setMailboxActionError,
    setMailboxActionSuccess,
    setSelectedDelayEventId,
    handleCheckMailbox,
    handleCloseDealClick,
    handleCloseDealConfirm,
    handleCreateMailbox,
    handleDeleteDealClick,
    handleDelayModalConfirm,
    handleEditDealClick,
    handleMarkTaskDone,
    handleMergeClick,
    handleRefreshDeal,
    handleReopenDealClick,
    handleRestoreDealClick,
    handleSimilarClick,
  };
};
