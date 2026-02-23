import React from 'react';

import { CommandPalette, type CommandPaletteItem } from '../common/modal/CommandPalette';

type PaletteMode = null | 'commands' | 'help' | 'taskDeal';

type AppShortcutsControllerProps = {
  paletteMode: PaletteMode;
  commandItems: CommandPaletteItem[];
  hotkeyHelpItems: CommandPaletteItem[];
  taskDealItems: CommandPaletteItem[];
  onClose: () => void;
};

export const AppShortcutsController: React.FC<AppShortcutsControllerProps> = ({
  paletteMode,
  commandItems,
  hotkeyHelpItems,
  taskDealItems,
  onClose,
}) => (
  <>
    <CommandPalette
      isOpen={paletteMode === 'commands'}
      title="Командная палитра"
      placeholder="Поиск по разделам и действиям..."
      items={commandItems}
      onClose={onClose}
    />
    <CommandPalette
      isOpen={paletteMode === 'help'}
      title="Горячие клавиши"
      placeholder="Поиск по сочетаниям..."
      items={hotkeyHelpItems}
      onClose={onClose}
    />
    <CommandPalette
      isOpen={paletteMode === 'taskDeal'}
      title="Выберите сделку для задачи"
      placeholder="Поиск сделки или клиента..."
      emptyMessage="Не найдено подходящих сделок для создания задачи."
      items={taskDealItems}
      onClose={onClose}
    />
  </>
);
