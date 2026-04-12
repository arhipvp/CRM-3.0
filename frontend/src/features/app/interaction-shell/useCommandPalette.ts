import { useCallback, useMemo, useState } from 'react';

import type { CommandPaletteItem } from '../../../components/common/modal/CommandPalette';
import type { Client, Deal, Policy, Task } from '../../../types';
import type { PaletteMode } from './types';

const NAVIGATION_COMMANDS: Array<{ path: string; label: string }> = [
  { path: '/seller-dashboard', label: 'Дашборд продавца' },
  { path: '/deals', label: 'Сделки' },
  { path: '/clients', label: 'Клиенты' },
  { path: '/policies', label: 'Полисы' },
  { path: '/commissions', label: 'Доходы и расходы' },
  { path: '/tasks', label: 'Задачи' },
  { path: '/settings', label: 'Настройки' },
];

interface UseCommandPaletteParams {
  deals: Deal[];
  selectedDeal: Deal | null;
  selectedClientShortcut: Client | null;
  selectedPolicyShortcut: Policy | null;
  selectedTaskShortcut: Task | null;
  isDealsRoute: boolean;
  isClientsRoute: boolean;
  isPoliciesRoute: boolean;
  isTasksRoute: boolean;
  selectedDealId: string | null;
  selectedDealExists: boolean;
  navigate: (path: string) => void;
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
}

export const useCommandPalette = ({
  deals,
  selectedDeal,
  selectedClientShortcut,
  selectedPolicyShortcut,
  selectedTaskShortcut,
  isDealsRoute,
  isClientsRoute,
  isPoliciesRoute,
  isTasksRoute,
  selectedDealId,
  selectedDealExists,
  navigate,
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
}: UseCommandPaletteParams) => {
  const [paletteMode, setPaletteMode] = useState<PaletteMode>(null);

  const openCommandsPalette = useCallback(() => {
    setPaletteMode((prev) => (prev === 'commands' ? null : 'commands'));
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
        keywords: ['сделка', 'создать'],
        onSelect: openDealCreateModal,
      },
      {
        id: 'create-client',
        title: 'Новый клиент',
        subtitle: 'Создание',
        keywords: ['клиент', 'создать'],
        onSelect: openClientCreateModal,
      },
      {
        id: 'create-task',
        title: 'Новая задача',
        subtitle: 'Создание',
        keywords: ['задача', 'создать'],
        onSelect: openTaskCreateFlow,
      },
      ...(isDealsRoute && selectedDeal
        ? [
            {
              id: 'deal-open-preview',
              title: `Открыть сделку: ${selectedDeal.title}`,
              subtitle: 'Контекст сделки',
              keywords: ['сделка', 'открыть', 'превью'],
              onSelect: openSelectedDealPreview,
            },
            {
              id: 'deal-delete',
              title: `Удалить сделку: ${selectedDeal.title}`,
              subtitle: 'Контекст сделки',
              keywords: ['сделка', 'удалить'],
              disabled: Boolean(selectedDeal.deletedAt),
              onSelect: deleteSelectedDeal,
            },
            {
              id: 'deal-restore',
              title: `Восстановить сделку: ${selectedDeal.title}`,
              subtitle: 'Контекст сделки',
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
              keywords: ['клиент', 'открыть', 'редактировать'],
              onSelect: openSelectedClient,
            },
            {
              id: 'client-delete',
              title: `Удалить клиента: ${selectedClientShortcut.name}`,
              subtitle: 'Контекст клиентов',
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
              keywords: ['задача', 'сделка', 'открыть'],
              disabled: !selectedTaskShortcut.dealId,
              onSelect: openSelectedTaskDealPreview,
            },
            {
              id: 'task-mark-done',
              title: `Отметить выполненной: ${selectedTaskShortcut.title}`,
              subtitle: 'Контекст задач',
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

  return {
    paletteMode,
    openCommandsPalette,
    openTaskCreateFlow,
    closePalette,
    commandItems,
    taskDealItems,
  };
};
