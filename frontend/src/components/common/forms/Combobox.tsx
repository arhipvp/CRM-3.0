import { useEffect, useId, useState, type KeyboardEvent } from 'react';

interface ComboboxProps<T> {
  id: string;
  value: string;
  options: readonly T[];
  isOpen: boolean;
  onOpen: () => void;
  onClose: () => void;
  onChange: (value: string) => void;
  onSelect: (option: T) => void;
  getOptionKey: (option: T) => string;
  getOptionLabel: (option: T) => string;
  placeholder?: string;
  emptyMessage?: string;
  isLoading?: boolean;
  disabled?: boolean;
}

export function Combobox<T>({
  id,
  value,
  options,
  isOpen,
  onOpen,
  onClose,
  onChange,
  onSelect,
  getOptionKey,
  getOptionLabel,
  placeholder,
  emptyMessage = 'Ничего не найдено',
  isLoading = false,
  disabled = false,
}: ComboboxProps<T>) {
  const generatedId = useId().replace(/:/g, '');
  const listboxId = `${id}-${generatedId}-listbox`;
  const [activeIndex, setActiveIndex] = useState(0);

  useEffect(() => {
    setActiveIndex((current) => Math.min(current, Math.max(options.length - 1, 0)));
  }, [options.length]);

  const selectActiveOption = () => {
    const option = options[activeIndex];
    if (option) {
      onSelect(option);
    }
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      onOpen();
      setActiveIndex((current) => Math.min(current + 1, Math.max(options.length - 1, 0)));
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      onOpen();
      setActiveIndex((current) => Math.max(current - 1, 0));
    } else if (event.key === 'Enter' && isOpen && options.length > 0) {
      event.preventDefault();
      selectActiveOption();
    } else if (event.key === 'Escape' && isOpen) {
      event.preventDefault();
      onClose();
    }
  };

  return (
    <div className="relative flex-1">
      <input
        id={id}
        type="text"
        role="combobox"
        aria-autocomplete="list"
        aria-expanded={isOpen}
        aria-controls={listboxId}
        aria-activedescendant={
          isOpen && options[activeIndex] ? `${listboxId}-option-${activeIndex}` : undefined
        }
        aria-busy={isLoading || undefined}
        value={value}
        onFocus={onOpen}
        onChange={(event) => {
          onChange(event.target.value);
          setActiveIndex(0);
          onOpen();
        }}
        onBlur={onClose}
        onKeyDown={handleKeyDown}
        className="field field-input"
        placeholder={placeholder}
        disabled={disabled}
      />
      {isOpen && (
        <div
          id={listboxId}
          role="listbox"
          className="absolute inset-x-0 top-full z-10 mt-1 max-h-44 overflow-y-auto rounded-xl border border-slate-200 bg-white shadow-lg"
        >
          {isLoading ? (
            <div role="status" className="px-3 py-2 text-sm text-slate-600">
              Загрузка…
            </div>
          ) : options.length ? (
            options.map((option, index) => (
              <div
                key={getOptionKey(option)}
                id={`${listboxId}-option-${index}`}
                role="option"
                aria-selected={index === activeIndex}
                className={`cursor-pointer px-3 py-2 text-left text-sm text-slate-700 ${
                  index === activeIndex ? 'bg-sky-50 text-sky-900' : 'hover:bg-slate-50'
                }`}
                onMouseEnter={() => setActiveIndex(index)}
                onMouseDown={(event) => {
                  event.preventDefault();
                  onSelect(option);
                }}
              >
                {getOptionLabel(option)}
              </div>
            ))
          ) : (
            <div role="status" className="px-3 py-2 text-sm text-slate-600">
              {emptyMessage}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
