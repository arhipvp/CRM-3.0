import type { Client, Deal, Policy, Task } from '../../../types';
import type { AppInteractionShellResult } from './types';
import { useCommandPalette } from './useCommandPalette';
import { useShortcutContextController } from './useShortcutContextController';
import type { DealPreviewController } from './useDealPreviewController';

interface UseAppInteractionShellArgs {
  clients: Client[];
  clientsById: Map<string, Client>;
  deals: Deal[];
  isClientsRoute: boolean;
  isDealsRoute: boolean;
  isPoliciesRoute: boolean;
  isTasksRoute: boolean;
  navigate: (path: string) => void;
  policiesList: Policy[];
  setQuickTaskDealId: React.Dispatch<React.SetStateAction<string | null>>;
  tasks: Task[];
  handleClientDeleteRequest: (client: Client) => void;
  handleClientEditRequest: (client: Client) => void;
  handleRequestEditPolicy: (policy: Policy) => void;
  handleUpdateTask: (taskId: string, data: Partial<Task>) => Promise<void>;
  cycleSelectedDeal: (direction: 1 | -1) => void;
  dealPreview: DealPreviewController;
  deleteSelectedDeal: () => Promise<void>;
  openClientCreateModal: () => void;
  openDealCreateModal: () => void;
  openSelectedDealPreview: () => void;
  restoreSelectedDeal: () => Promise<void>;
}

export const useAppInteractionShell = ({
  clients,
  clientsById,
  deals,
  isClientsRoute,
  isDealsRoute,
  isPoliciesRoute,
  isTasksRoute,
  navigate,
  policiesList,
  setQuickTaskDealId,
  tasks,
  handleClientDeleteRequest,
  handleClientEditRequest,
  handleRequestEditPolicy,
  handleUpdateTask,
  cycleSelectedDeal,
  dealPreview,
  deleteSelectedDeal,
  openClientCreateModal,
  openDealCreateModal,
  openSelectedDealPreview,
  restoreSelectedDeal,
}: UseAppInteractionShellArgs): AppInteractionShellResult => {
  const selectedDeal = dealPreview.selectedDealId
    ? (deals.find((deal) => deal.id === dealPreview.selectedDealId) ?? null)
    : null;

  const shortcutContext = useShortcutContextController({
    clients,
    clientsById,
    policies: policiesList,
    tasks,
    selectedDeal,
    isDealsRoute,
    isClientsRoute,
    isPoliciesRoute,
    isTasksRoute,
    handleClientEditRequest,
    handleClientDeleteRequest,
    handleRequestEditPolicy,
    handleOpenDealPreview: dealPreview.handleOpenDealPreview,
    handleUpdateTask,
    cycleSelectedDeal,
    openSelectedDealPreview,
    deleteSelectedDeal,
  });

  const { paletteMode, openCommandsPalette, closePalette, commandItems, taskDealItems } =
    useCommandPalette({
      deals,
      selectedDeal,
      selectedClientShortcut: shortcutContext.selectedClientShortcut,
      selectedPolicyShortcut: shortcutContext.selectedPolicyShortcut,
      selectedTaskShortcut: shortcutContext.selectedTaskShortcut,
      isDealsRoute,
      isClientsRoute,
      isPoliciesRoute,
      isTasksRoute,
      selectedDealId: dealPreview.selectedDealId,
      selectedDealExists: Boolean(
        dealPreview.selectedDealId && deals.some((deal) => deal.id === dealPreview.selectedDealId),
      ),
      navigate,
      selectDealById: dealPreview.selectDealById,
      setQuickTaskDealId,
      openDealCreateModal,
      openClientCreateModal,
      openSelectedDealPreview,
      deleteSelectedDeal,
      restoreSelectedDeal,
      openSelectedClient: shortcutContext.openSelectedClient,
      deleteSelectedClient: shortcutContext.deleteSelectedClient,
      openSelectedPolicy: shortcutContext.openSelectedPolicy,
      openSelectedTaskDealPreview: shortcutContext.openSelectedTaskDealPreview,
      markSelectedTaskDone: shortcutContext.markSelectedTaskDone,
    });

  return {
    commandItems,
    openCommandsPalette,
    paletteMode,
    shortcutContext,
    taskDealItems,
    closePalette,
  };
};
