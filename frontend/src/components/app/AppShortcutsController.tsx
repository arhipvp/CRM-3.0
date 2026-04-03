import React from 'react';

import { CommandPalette, type CommandPaletteItem } from '../common/modal/CommandPalette';

type PaletteMode = null | 'commands' | 'taskDeal';

type AppShortcutsControllerProps = {
  paletteMode: PaletteMode;
  commandItems: CommandPaletteItem[];
  taskDealItems: CommandPaletteItem[];
  onClose: () => void;
};

export const AppShortcutsController: React.FC<AppShortcutsControllerProps> = ({
  paletteMode,
  commandItems,
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
      isOpen={paletteMode === 'taskDeal'}
      title="Выберите сделку для задачи"
      placeholder="Поиск сделки или клиента..."
      emptyMessage="Не найдено подходящих сделок для создания задачи."
      items={taskDealItems}
      onClose={onClose}
    />
  </>
);
