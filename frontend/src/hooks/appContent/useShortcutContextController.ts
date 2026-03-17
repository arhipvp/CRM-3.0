import { useCallback, useEffect, useMemo, useState } from 'react';

import type { Client, Deal, Policy, Task } from '../../types';

interface ShortcutContextLabel {
  title: string;
  label: string;
}

interface UseShortcutContextControllerParams {
  clients: Client[];
  clientsById: Map<string, Client>;
  policies: Policy[];
  tasks: Task[];
  selectedDeal: Deal | null;
  isDealsRoute: boolean;
  isClientsRoute: boolean;
  isPoliciesRoute: boolean;
  isTasksRoute: boolean;
  handleClientEditRequest: (client: Client) => void;
  handleClientDeleteRequest: (client: Client) => void;
  handleRequestEditPolicy: (policy: Policy) => void;
  handleOpenDealPreview: (dealId: string) => void;
  handleUpdateTask: (taskId: string, data: Partial<Task>) => Promise<void>;
  cycleSelectedDeal: (direction: 1 | -1) => void;
  openSelectedDealPreview: () => void;
  deleteSelectedDeal: () => Promise<void>;
}

export const useShortcutContextController = ({
  clients,
  clientsById,
  policies,
  tasks,
  selectedDeal,
  isDealsRoute,
  isClientsRoute,
  isPoliciesRoute,
  isTasksRoute,
  handleClientEditRequest,
  handleClientDeleteRequest,
  handleRequestEditPolicy,
  handleOpenDealPreview,
  handleUpdateTask,
  cycleSelectedDeal,
  openSelectedDealPreview,
  deleteSelectedDeal,
}: UseShortcutContextControllerParams) => {
  const [selectedClientShortcutId, setSelectedClientShortcutId] = useState<string | null>(null);
  const [selectedPolicyShortcutId, setSelectedPolicyShortcutId] = useState<string | null>(null);
  const [selectedTaskShortcutId, setSelectedTaskShortcutId] = useState<string | null>(null);

  const sortedClientsForShortcuts = useMemo(
    () =>
      [...clients].sort((left, right) => {
        const dateDiff =
          Date.parse(right.updatedAt ?? right.createdAt ?? '') -
          Date.parse(left.updatedAt ?? left.createdAt ?? '');
        if (Number.isFinite(dateDiff) && dateDiff !== 0) {
          return dateDiff;
        }
        return (left.name ?? '').localeCompare(right.name ?? '');
      }),
    [clients],
  );

  const selectedClientShortcut = selectedClientShortcutId
    ? (clientsById.get(selectedClientShortcutId) ?? null)
    : null;

  const sortedPoliciesForShortcuts = useMemo(
    () =>
      [...policies].sort((left, right) => {
        const dateDiff =
          Date.parse(right.updatedAt ?? right.createdAt ?? '') -
          Date.parse(left.updatedAt ?? left.createdAt ?? '');
        if (Number.isFinite(dateDiff) && dateDiff !== 0) {
          return dateDiff;
        }
        return (left.number ?? '').localeCompare(right.number ?? '');
      }),
    [policies],
  );

  const selectedPolicyShortcut = selectedPolicyShortcutId
    ? (sortedPoliciesForShortcuts.find((policy) => policy.id === selectedPolicyShortcutId) ?? null)
    : null;

  const sortedTasksForShortcuts = useMemo(
    () =>
      [...tasks].sort((left, right) => {
        const leftDue = left.dueAt ? Date.parse(left.dueAt) : Number.MAX_SAFE_INTEGER;
        const rightDue = right.dueAt ? Date.parse(right.dueAt) : Number.MAX_SAFE_INTEGER;
        if (leftDue !== rightDue) {
          return leftDue - rightDue;
        }
        return Date.parse(right.createdAt ?? '') - Date.parse(left.createdAt ?? '');
      }),
    [tasks],
  );

  const selectedTaskShortcut = selectedTaskShortcutId
    ? (sortedTasksForShortcuts.find((task) => task.id === selectedTaskShortcutId) ?? null)
    : null;

  const activeShortcutContext = useMemo<ShortcutContextLabel | null>(() => {
    if (isDealsRoute && selectedDeal) {
      return {
        title: 'Сделки',
        label: selectedDeal.title,
      };
    }
    if (isClientsRoute && selectedClientShortcut) {
      return {
        title: 'Клиенты',
        label: selectedClientShortcut.name,
      };
    }
    if (isPoliciesRoute && selectedPolicyShortcut) {
      return {
        title: 'Полисы',
        label: selectedPolicyShortcut.number,
      };
    }
    if (isTasksRoute && selectedTaskShortcut) {
      return {
        title: 'Задачи',
        label: selectedTaskShortcut.title,
      };
    }
    return null;
  }, [
    isClientsRoute,
    isDealsRoute,
    isPoliciesRoute,
    isTasksRoute,
    selectedClientShortcut,
    selectedDeal,
    selectedPolicyShortcut,
    selectedTaskShortcut,
  ]);

  useEffect(() => {
    if (!isClientsRoute) {
      return;
    }
    if (!sortedClientsForShortcuts.length) {
      setSelectedClientShortcutId(null);
      return;
    }
    setSelectedClientShortcutId((prev) =>
      prev && sortedClientsForShortcuts.some((client) => client.id === prev)
        ? prev
        : sortedClientsForShortcuts[0].id,
    );
  }, [isClientsRoute, sortedClientsForShortcuts]);

  useEffect(() => {
    if (!isPoliciesRoute) {
      return;
    }
    if (!sortedPoliciesForShortcuts.length) {
      setSelectedPolicyShortcutId(null);
      return;
    }
    setSelectedPolicyShortcutId((prev) =>
      prev && sortedPoliciesForShortcuts.some((policy) => policy.id === prev)
        ? prev
        : sortedPoliciesForShortcuts[0].id,
    );
  }, [isPoliciesRoute, sortedPoliciesForShortcuts]);

  useEffect(() => {
    if (!isTasksRoute) {
      return;
    }
    if (!sortedTasksForShortcuts.length) {
      setSelectedTaskShortcutId(null);
      return;
    }
    setSelectedTaskShortcutId((prev) =>
      prev && sortedTasksForShortcuts.some((task) => task.id === prev)
        ? prev
        : sortedTasksForShortcuts[0].id,
    );
  }, [isTasksRoute, sortedTasksForShortcuts]);

  const cycleSelectedClient = useCallback(
    (direction: 1 | -1) => {
      if (!isClientsRoute || !sortedClientsForShortcuts.length) {
        return;
      }
      if (!selectedClientShortcutId) {
        setSelectedClientShortcutId(sortedClientsForShortcuts[0].id);
        return;
      }
      const currentIndex = sortedClientsForShortcuts.findIndex(
        (client) => client.id === selectedClientShortcutId,
      );
      if (currentIndex < 0) {
        setSelectedClientShortcutId(sortedClientsForShortcuts[0].id);
        return;
      }
      const nextIndex =
        (currentIndex + direction + sortedClientsForShortcuts.length) %
        sortedClientsForShortcuts.length;
      setSelectedClientShortcutId(sortedClientsForShortcuts[nextIndex].id);
    },
    [isClientsRoute, selectedClientShortcutId, sortedClientsForShortcuts],
  );

  const cycleSelectedPolicy = useCallback(
    (direction: 1 | -1) => {
      if (!isPoliciesRoute || !sortedPoliciesForShortcuts.length) {
        return;
      }
      if (!selectedPolicyShortcutId) {
        setSelectedPolicyShortcutId(sortedPoliciesForShortcuts[0].id);
        return;
      }
      const currentIndex = sortedPoliciesForShortcuts.findIndex(
        (policy) => policy.id === selectedPolicyShortcutId,
      );
      if (currentIndex < 0) {
        setSelectedPolicyShortcutId(sortedPoliciesForShortcuts[0].id);
        return;
      }
      const nextIndex =
        (currentIndex + direction + sortedPoliciesForShortcuts.length) %
        sortedPoliciesForShortcuts.length;
      setSelectedPolicyShortcutId(sortedPoliciesForShortcuts[nextIndex].id);
    },
    [isPoliciesRoute, selectedPolicyShortcutId, sortedPoliciesForShortcuts],
  );

  const cycleSelectedTask = useCallback(
    (direction: 1 | -1) => {
      if (!isTasksRoute || !sortedTasksForShortcuts.length) {
        return;
      }
      if (!selectedTaskShortcutId) {
        setSelectedTaskShortcutId(sortedTasksForShortcuts[0].id);
        return;
      }
      const currentIndex = sortedTasksForShortcuts.findIndex(
        (task) => task.id === selectedTaskShortcutId,
      );
      if (currentIndex < 0) {
        setSelectedTaskShortcutId(sortedTasksForShortcuts[0].id);
        return;
      }
      const nextIndex =
        (currentIndex + direction + sortedTasksForShortcuts.length) %
        sortedTasksForShortcuts.length;
      setSelectedTaskShortcutId(sortedTasksForShortcuts[nextIndex].id);
    },
    [isTasksRoute, selectedTaskShortcutId, sortedTasksForShortcuts],
  );

  const openSelectedClient = useCallback(() => {
    if (!isClientsRoute || !selectedClientShortcut) {
      return;
    }
    handleClientEditRequest(selectedClientShortcut);
  }, [handleClientEditRequest, isClientsRoute, selectedClientShortcut]);

  const deleteSelectedClient = useCallback(() => {
    if (!isClientsRoute || !selectedClientShortcut) {
      return;
    }
    handleClientDeleteRequest(selectedClientShortcut);
  }, [handleClientDeleteRequest, isClientsRoute, selectedClientShortcut]);

  const openSelectedPolicy = useCallback(() => {
    if (!isPoliciesRoute || !selectedPolicyShortcut) {
      return;
    }
    handleRequestEditPolicy(selectedPolicyShortcut);
  }, [handleRequestEditPolicy, isPoliciesRoute, selectedPolicyShortcut]);

  const openSelectedTaskDealPreview = useCallback(() => {
    if (!isTasksRoute || !selectedTaskShortcut?.dealId) {
      return;
    }
    handleOpenDealPreview(selectedTaskShortcut.dealId);
  }, [handleOpenDealPreview, isTasksRoute, selectedTaskShortcut?.dealId]);

  const markSelectedTaskDone = useCallback(async () => {
    if (!isTasksRoute || !selectedTaskShortcut || selectedTaskShortcut.status === 'done') {
      return;
    }
    await handleUpdateTask(selectedTaskShortcut.id, { status: 'done' });
  }, [handleUpdateTask, isTasksRoute, selectedTaskShortcut]);

  const cycleActiveContextSelection = useCallback(
    (direction: 1 | -1) => {
      if (isDealsRoute) {
        cycleSelectedDeal(direction);
        return;
      }
      if (isClientsRoute) {
        cycleSelectedClient(direction);
        return;
      }
      if (isPoliciesRoute) {
        cycleSelectedPolicy(direction);
        return;
      }
      if (isTasksRoute) {
        cycleSelectedTask(direction);
      }
    },
    [
      cycleSelectedClient,
      cycleSelectedDeal,
      cycleSelectedPolicy,
      cycleSelectedTask,
      isClientsRoute,
      isDealsRoute,
      isPoliciesRoute,
      isTasksRoute,
    ],
  );

  const openPrimaryContextAction = useCallback(() => {
    if (isDealsRoute) {
      openSelectedDealPreview();
      return;
    }
    if (isClientsRoute) {
      openSelectedClient();
      return;
    }
    if (isPoliciesRoute) {
      openSelectedPolicy();
      return;
    }
    if (isTasksRoute) {
      openSelectedTaskDealPreview();
    }
  }, [
    isDealsRoute,
    isClientsRoute,
    isPoliciesRoute,
    isTasksRoute,
    openSelectedDealPreview,
    openSelectedClient,
    openSelectedPolicy,
    openSelectedTaskDealPreview,
  ]);

  const deletePrimaryContextAction = useCallback(async () => {
    if (isDealsRoute) {
      await deleteSelectedDeal();
      return;
    }
    if (isClientsRoute) {
      deleteSelectedClient();
    }
  }, [deleteSelectedClient, deleteSelectedDeal, isClientsRoute, isDealsRoute]);

  return {
    activeShortcutContext,
    cycleActiveContextSelection,
    deletePrimaryContextAction,
    deleteSelectedClient,
    markSelectedTaskDone,
    openPrimaryContextAction,
    openSelectedClient,
    openSelectedPolicy,
    openSelectedTaskDealPreview,
    selectedClientShortcut,
    selectedPolicyShortcut,
    selectedTaskShortcut,
    sortedClientsForShortcuts,
    sortedPoliciesForShortcuts,
    sortedTasksForShortcuts,
  };
};
