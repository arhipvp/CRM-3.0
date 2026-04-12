import type { CommandPaletteItem } from '../../../components/common/modal/CommandPalette';
import type { Client, Policy, Task } from '../../../types';

export type PaletteMode = null | 'commands' | 'taskDeal';

export interface AppInteractionShellResult {
  commandItems: CommandPaletteItem[];
  openCommandsPalette: () => void;
  paletteMode: PaletteMode;
  shortcutContext: {
    deleteSelectedClient: () => void;
    markSelectedTaskDone: () => Promise<void>;
    openSelectedClient: () => void;
    openSelectedPolicy: () => void;
    openSelectedTaskDealPreview: () => void;
    selectedClientShortcut: Client | null;
    selectedPolicyShortcut: Policy | null;
    selectedTaskShortcut: Task | null;
  };
  taskDealItems: CommandPaletteItem[];
  closePalette: () => void;
}
