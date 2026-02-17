import React, { useEffect, useMemo, useState } from 'react';

import { Modal } from '../../Modal';

export interface CommandPaletteItem {
  id: string;
  title: string;
  subtitle?: string;
  shortcut?: string;
  keywords?: string[];
  disabled?: boolean;
  onSelect?: () => boolean | void | Promise<boolean | void>;
}

interface CommandPaletteProps {
  isOpen: boolean;
  title: string;
  placeholder?: string;
  emptyMessage?: string;
  items: CommandPaletteItem[];
  onClose: () => void;
}

export const CommandPalette: React.FC<CommandPaletteProps> = ({
  isOpen,
  title,
  placeholder = 'Введите команду...',
  emptyMessage = 'Ничего не найдено.',
  items,
  onClose,
}) => {
  const [query, setQuery] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);

  useEffect(() => {
    if (!isOpen) {
      return;
    }
    setQuery('');
    setActiveIndex(0);
  }, [isOpen, title]);

  const filteredItems = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) {
      return items;
    }
    return items.filter((item) => {
      const haystack = [item.title, item.subtitle ?? '', ...(item.keywords ?? [])]
        .join(' ')
        .toLowerCase();
      return haystack.includes(normalized);
    });
  }, [items, query]);

  useEffect(() => {
    if (activeIndex >= filteredItems.length) {
      setActiveIndex(Math.max(filteredItems.length - 1, 0));
    }
  }, [activeIndex, filteredItems.length]);

  const handleSelect = async (item: CommandPaletteItem) => {
    if (item.disabled || !item.onSelect) {
      return;
    }
    const shouldClose = await item.onSelect();
    if (shouldClose !== false) {
      onClose();
    }
  };

  if (!isOpen) {
    return null;
  }

  return (
    <Modal title={title} onClose={onClose} size="lg" zIndex={70} closeOnOverlayClick={false}>
      <div className="space-y-3">
        <input
          type="text"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'ArrowDown') {
              event.preventDefault();
              setActiveIndex((prev) => Math.min(prev + 1, filteredItems.length - 1));
            }
            if (event.key === 'ArrowUp') {
              event.preventDefault();
              setActiveIndex((prev) => Math.max(prev - 1, 0));
            }
            if (event.key === 'Enter') {
              event.preventDefault();
              const item = filteredItems[activeIndex];
              if (item) {
                void handleSelect(item);
              }
            }
          }}
          autoFocus
          placeholder={placeholder}
          className="field field-input"
        />
        <div className="max-h-[55vh] overflow-y-auto rounded-xl border border-slate-200 bg-white">
          {filteredItems.length ? (
            <ul className="divide-y divide-slate-100">
              {filteredItems.map((item, index) => {
                const isActive = index === activeIndex;
                return (
                  <li key={item.id}>
                    <button
                      type="button"
                      disabled={item.disabled}
                      onClick={() => void handleSelect(item)}
                      className={`flex w-full items-center justify-between gap-3 px-4 py-3 text-left transition-colors ${
                        item.disabled
                          ? 'cursor-not-allowed text-slate-400'
                          : isActive
                            ? 'bg-sky-50 text-sky-900'
                            : 'text-slate-700 hover:bg-slate-50'
                      }`}
                    >
                      <span className="min-w-0">
                        <span className="block text-sm font-semibold">{item.title}</span>
                        {item.subtitle && (
                          <span className="block truncate text-xs text-slate-500">
                            {item.subtitle}
                          </span>
                        )}
                      </span>
                      {item.shortcut && (
                        <span className="rounded-md border border-slate-200 bg-slate-50 px-2 py-1 text-xs text-slate-500">
                          {item.shortcut}
                        </span>
                      )}
                    </button>
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="px-4 py-6 text-center text-sm text-slate-500">{emptyMessage}</p>
          )}
        </div>
      </div>
    </Modal>
  );
};
