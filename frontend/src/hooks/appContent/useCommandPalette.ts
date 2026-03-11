import { useCallback, useEffect, useMemo, useState } from 'react';

import type { CommandPaletteItem } from '../../components/common/modal/CommandPalette';
import type { Client, Deal, Policy, Task } from '../../types';
import { formatShortcut } from '../../hotkeys/formatShortcut';
import { useGlobalHotkeys } from '../../hotkeys/useGlobalHotkeys';

export type PaletteMode = null | 'commands' | 'help' | 'taskDeal';

const NAVIGATION_COMMANDS: Array<{ path: string; label: string }> = [
  { path: '/seller-dashboard', label: 'Дашборд продавца' },
  { path: '/deals', label: 'Сделки' },
  { path: '/clients', label: 'Клиенты' },
  { path: '/policies', label: 'Полисы' },
  { path: '/commissions', label: 'Доходы и расходы' },
  { path: '/tasks', label: 'Задачи' },
  { path: '/settings', label: 'Настройки' },
];

const PALETTE_HINT_SESSION_KEY = 'crm_hotkeys_palette_hint_seen';

interface UseCommandPaletteParams {
  isAuthenticated: boolean;
  deals: Deal[];
  selectedDeal: Deal | null;
  selectedClientShortcut: Client | null;
  selectedPolicyShortcut: Policy | null;
  selectedTaskShortcut: Task | null;
  isDealsRoute: boolean;
  isClientsRoute: boolean;
  isPoliciesRoute: boolean;
  isTasksRoute: boolean;
  sortedClientsCount: number;
  sortedPoliciesCount: number;
  sortedTasksCount: number;
  selectedDealId: string | null;
  selectedDealExists: boolean;
  navigate: (path: string) => void;
  addNotification: (
    message: string,
    type?: 'error' | 'success' | 'info' | 'warning',
    duration?: number,
  ) => void;
  selectDealById: (dealId: string) => void;
  setQuickTaskDealId: React.Dispatch<React.SetStateAction<string | null>>;
  openDealCreateModal: () => void;
  openClientCreateModal: () => void;
  openSelectedDealPreview: () => void;
  deleteSelectedDeal: () => Promise<void>;
  restoreSelectedDeal: () => Promise<void>;
  openSelectedClient: () => void;
  deleteSelectedClient: () => void;
  openSelectedPolicy: () => void;
  openSelectedTaskDealPreview: () => void;
  markSelectedTaskDone: () => Promise<void>;
  cycleActiveContextSelection: (direction: 1 | -1) => void;
  openPrimaryContextAction: () => void;
  deletePrimaryContextAction: () => Promise<void>;
}

export const useCommandPalette = ({
  isAuthenticated,
  deals,
  selectedDeal,
  selectedClientShortcut,
  selectedPolicyShortcut,
  selectedTaskShortcut,
  isDealsRoute,
  isClientsRoute,
  isPoliciesRoute,
  isTasksRoute,
  sortedClientsCount,
  sortedPoliciesCount,
  sortedTasksCount,
  selectedDealId,
  selectedDealExists,
  navigate,
  addNotification,
  selectDealById,
  setQuickTaskDealId,
  openDealCreateModal,
  openClientCreateModal,
  openSelectedDealPreview,
  deleteSelectedDeal,
  restoreSelectedDeal,
  openSelectedClient,
  deleteSelectedClient,
  openSelectedPolicy,
  openSelectedTaskDealPreview,
  markSelectedTaskDone,
  cycleActiveContextSelection,
  openPrimaryContextAction,
  deletePrimaryContextAction,
}: UseCommandPaletteParams) => {
  const [paletteMode, setPaletteMode] = useState<PaletteMode>(null);

  const openCommandsPalette = useCallback(() => {
    setPaletteMode((prev) => (prev === 'commands' ? null : 'commands'));
  }, []);

  const openHelpPalette = useCallback(() => {
    setPaletteMode((prev) => (prev === 'help' ? null : 'help'));
  }, []);

  const openTaskCreateFlow = useCallback(() => {
    if (selectedDealId && selectedDealExists) {
      setQuickTaskDealId(selectedDealId);
      return;
    }
    setPaletteMode('taskDeal');
  }, [selectedDealExists, selectedDealId, setQuickTaskDealId]);

  const closePalette = useCallback(() => {
    setPaletteMode(null);
  }, []);

  useEffect(() => {
    if (!isAuthenticated) {
      return;
    }
    if (typeof window === 'undefined') {
      return;
    }
    if (window.sessionStorage.getItem(PALETTE_HINT_SESSION_KEY) === '1') {
      return;
    }

    addNotification(
      `Откройте командную палитру: ${formatShortcut('mod+k')} (справка: ${formatShortcut('mod+/')})`,
      'success',
      7000,
    );
    window.sessionStorage.setItem(PALETTE_HINT_SESSION_KEY, '1');
  }, [addNotification, isAuthenticated]);

  const commandItems = useMemo<CommandPaletteItem[]>(
    () => [
      ...NAVIGATION_COMMANDS.map((item) => ({
        id: `nav-${item.path}`,
        title: item.label,
        subtitle: 'Перейти в раздел',
        keywords: [item.path, 'раздел', 'навигация'],
        onSelect: () => navigate(item.path),
      })),
      {
        id: 'create-deal',
        title: 'Новая сделка',
        subtitle: 'Создание',
        shortcut: formatShortcut('mod+shift+d'),
        keywords: ['сделка', 'создать'],
        onSelect: openDealCreateModal,
      },
      {
        id: 'create-client',
        title: 'Новый клиент',
        subtitle: 'Создание',
        shortcut: formatShortcut('mod+shift+c'),
        keywords: ['клиент', 'создать'],
        onSelect: openClientCreateModal,
      },
      {
        id: 'create-task',
        title: 'Новая задача',
        subtitle: 'Создание',
        shortcut: formatShortcut('mod+shift+t'),
        keywords: ['задача', 'создать'],
        onSelect: openTaskCreateFlow,
      },
      {
        id: 'show-hotkeys-help',
        title: 'Справка по горячим клавишам',
        subtitle: 'Помощь',
        shortcut: formatShortcut('mod+/'),
        keywords: ['шорткаты', 'горячие клавиши', 'помощь'],
        onSelect: () => {
          setPaletteMode('help');
          return false;
        },
      },
      ...(isDealsRoute && selectedDeal
        ? [
            {
              id: 'deal-open-preview',
              title: `Открыть сделку: ${selectedDeal.title}`,
              subtitle: 'Контекст сделки',
              shortcut: formatShortcut('mod+o'),
              keywords: ['сделка', 'открыть', 'превью'],
              onSelect: openSelectedDealPreview,
            },
            {
              id: 'deal-delete',
              title: `Удалить сделку: ${selectedDeal.title}`,
              subtitle: 'Контекст сделки',
              shortcut: formatShortcut('mod+backspace'),
              keywords: ['сделка', 'удалить'],
              disabled: Boolean(selectedDeal.deletedAt),
              onSelect: deleteSelectedDeal,
            },
            {
              id: 'deal-restore',
              title: `Восстановить сделку: ${selectedDeal.title}`,
              subtitle: 'Контекст сделки',
              shortcut: formatShortcut('mod+shift+r'),
              keywords: ['сделка', 'восстановить'],
              disabled: !selectedDeal.deletedAt,
              onSelect: restoreSelectedDeal,
            },
          ]
        : []),
      ...(isClientsRoute && selectedClientShortcut
        ? [
            {
              id: 'client-open-edit',
              title: `Открыть клиента: ${selectedClientShortcut.name}`,
              subtitle: 'Контекст клиентов',
              shortcut: formatShortcut('mod+o'),
              keywords: ['клиент', 'открыть', 'редактировать'],
              onSelect: openSelectedClient,
            },
            {
              id: 'client-delete',
              title: `Удалить клиента: ${selectedClientShortcut.name}`,
              subtitle: 'Контекст клиентов',
              shortcut: formatShortcut('mod+backspace'),
              keywords: ['клиент', 'удалить'],
              onSelect: deleteSelectedClient,
            },
          ]
        : []),
      ...(isPoliciesRoute && selectedPolicyShortcut
        ? [
            {
              id: 'policy-open-edit',
              title: `Открыть полис: ${selectedPolicyShortcut.number}`,
              subtitle: 'Контекст полисов',
              shortcut: formatShortcut('mod+o'),
              keywords: ['полис', 'открыть', 'редактировать'],
              onSelect: openSelectedPolicy,
            },
          ]
        : []),
      ...(isTasksRoute && selectedTaskShortcut
        ? [
            {
              id: 'task-open-deal-preview',
              title: `Открыть сделку задачи: ${selectedTaskShortcut.title}`,
              subtitle: 'Контекст задач',
              shortcut: formatShortcut('mod+o'),
              keywords: ['задача', 'сделка', 'открыть'],
              disabled: !selectedTaskShortcut.dealId,
              onSelect: openSelectedTaskDealPreview,
            },
            {
              id: 'task-mark-done',
              title: `Отметить выполненной: ${selectedTaskShortcut.title}`,
              subtitle: 'Контекст задач',
              shortcut: formatShortcut('mod+enter'),
              keywords: ['задача', 'выполнено', 'done'],
              disabled: selectedTaskShortcut.status === 'done',
              onSelect: markSelectedTaskDone,
            },
          ]
        : []),
    ],
    [
      deleteSelectedClient,
      deleteSelectedDeal,
      isClientsRoute,
      isDealsRoute,
      isPoliciesRoute,
      isTasksRoute,
      markSelectedTaskDone,
      navigate,
      openClientCreateModal,
      openDealCreateModal,
      openSelectedClient,
      openSelectedDealPreview,
      openSelectedPolicy,
      openSelectedTaskDealPreview,
      openTaskCreateFlow,
      restoreSelectedDeal,
      selectedClientShortcut,
      selectedDeal,
      selectedPolicyShortcut,
      selectedTaskShortcut,
      selectedDealId,
      selectedDealExists,
    ],
  );

  const taskDealItems = useMemo<CommandPaletteItem[]>(() => {
    const candidates = deals
      .filter((deal) => !deal.deletedAt)
      .sort((left, right) => {
        const leftPinned = left.isPinned ? 1 : 0;
        const rightPinned = right.isPinned ? 1 : 0;
        if (leftPinned !== rightPinned) {
          return rightPinned - leftPinned;
        }
        return (right.createdAt ?? '').localeCompare(left.createdAt ?? '');
      });

    return candidates.map((deal) => ({
      id: `task-deal-${deal.id}`,
      title: deal.title,
      subtitle: deal.clientName ? `Клиент: ${deal.clientName}` : 'Выбор сделки для задачи',
      keywords: [deal.clientName ?? '', deal.executorName ?? ''],
      onSelect: () => {
        selectDealById(deal.id);
        setQuickTaskDealId(deal.id);
      },
    }));
  }, [deals, selectDealById, setQuickTaskDealId]);

  useGlobalHotkeys([
    {
      id: 'open-command-palette',
      combo: 'mod+k',
      handler: openCommandsPalette,
      allowInInput: true,
      enabled: isAuthenticated,
    },
    {
      id: 'open-hotkeys-help',
      combo: 'mod+/',
      handler: openHelpPalette,
      allowInInput: true,
      enabled: isAuthenticated,
    },
    {
      id: 'create-deal-hotkey',
      combo: 'mod+shift+d',
      handler: openDealCreateModal,
      enabled: isAuthenticated,
    },
    {
      id: 'create-client-hotkey',
      combo: 'mod+shift+c',
      handler: openClientCreateModal,
      enabled: isAuthenticated,
    },
    {
      id: 'create-task-hotkey',
      combo: 'mod+shift+t',
      handler: openTaskCreateFlow,
      enabled: isAuthenticated,
    },
    {
      id: 'context-prev-selection-hotkey',
      combo: 'alt+arrowup',
      handler: () => cycleActiveContextSelection(-1),
      enabled:
        isAuthenticated &&
        ((isDealsRoute && deals.length > 0) ||
          (isClientsRoute && sortedClientsCount > 0) ||
          (isPoliciesRoute && sortedPoliciesCount > 0) ||
          (isTasksRoute && sortedTasksCount > 0)),
    },
    {
      id: 'context-next-selection-hotkey',
      combo: 'alt+arrowdown',
      handler: () => cycleActiveContextSelection(1),
      enabled:
        isAuthenticated &&
        ((isDealsRoute && deals.length > 0) ||
          (isClientsRoute && sortedClientsCount > 0) ||
          (isPoliciesRoute && sortedPoliciesCount > 0) ||
          (isTasksRoute && sortedTasksCount > 0)),
    },
    {
      id: 'context-open-hotkey',
      combo: 'mod+o',
      handler: () => {
        void openPrimaryContextAction();
      },
      enabled:
        isAuthenticated &&
        ((isDealsRoute && selectedDeal?.id != null) ||
          (isClientsRoute && selectedClientShortcut != null) ||
          (isPoliciesRoute && selectedPolicyShortcut != null) ||
          (isTasksRoute && selectedTaskShortcut?.dealId != null)),
    },
    {
      id: 'context-delete-hotkey',
      combo: 'mod+backspace',
      handler: () => {
        void deletePrimaryContextAction();
      },
      enabled:
        isAuthenticated &&
        ((isDealsRoute && selectedDeal?.id != null && selectedDeal?.deletedAt == null) ||
          (isClientsRoute && selectedClientShortcut != null)),
    },
    {
      id: 'deals-restore-selected-hotkey',
      combo: 'mod+shift+r',
      handler: () => {
        void restoreSelectedDeal();
      },
      enabled:
        isAuthenticated &&
        isDealsRoute &&
        selectedDeal?.id != null &&
        selectedDeal?.deletedAt != null,
    },
    {
      id: 'tasks-mark-done-hotkey',
      combo: 'mod+enter',
      handler: () => {
        void markSelectedTaskDone();
      },
      enabled:
        isAuthenticated &&
        isTasksRoute &&
        selectedTaskShortcut != null &&
        selectedTaskShortcut.status !== 'done',
    },
    {
      id: 'close-palette-hotkey',
      combo: 'escape',
      handler: closePalette,
      allowInInput: true,
      enabled: isAuthenticated && paletteMode !== null,
    },
  ]);

  return {
    paletteMode,
    openCommandsPalette,
    openHelpPalette,
    openTaskCreateFlow,
    closePalette,
    commandItems,
    taskDealItems,
  };
};
