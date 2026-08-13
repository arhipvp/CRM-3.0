import type { ReactNode } from 'react';

import { handleTabKeyboardNavigation } from './tabKeyboard';

export type TabOption<T extends string> = {
  value: T;
  label: ReactNode;
  count?: number;
  loading?: boolean;
  disabled?: boolean;
  controls?: string;
};

export type TabsProps<T extends string> = {
  options: readonly TabOption<T>[];
  value: T;
  onChange: (value: T) => void;
  ariaLabel: string;
  idPrefix: string;
  variant?: 'primary' | 'secondary';
  className?: string;
};

export function Tabs<T extends string>({
  options,
  value,
  onChange,
  ariaLabel,
  idPrefix,
  variant = 'primary',
  className = '',
}: TabsProps<T>) {
  const tabValues = options.map((option) => option.value);
  const rootClassName =
    variant === 'primary'
      ? 'app-segmented-control scrollbar-none'
      : 'flex min-h-8 flex-wrap items-center gap-1';

  return (
    <div
      role="tablist"
      aria-label={ariaLabel}
      className={[rootClassName, className].filter(Boolean).join(' ')}
    >
      {options.map((option) => {
        const isActive = option.value === value;
        const variantClassName =
          variant === 'primary'
            ? `app-segmented-control-button ${
                isActive
                  ? 'border border-[var(--app-border)] bg-white font-semibold text-[var(--app-primary)] shadow-sm'
                  : 'text-slate-600 hover:bg-white/70 hover:text-slate-900'
              }`
            : `min-h-8 rounded-[var(--app-radius-sm)] px-2.5 py-1 text-xs font-semibold transition ${
                isActive
                  ? 'bg-[var(--app-brand-100)] text-[var(--app-primary-hover)]'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`;

        return (
          <button
            key={option.value}
            id={`${idPrefix}-${option.value}`}
            role="tab"
            type="button"
            aria-selected={isActive}
            aria-controls={option.controls}
            tabIndex={isActive ? 0 : -1}
            disabled={option.disabled}
            onClick={() => onChange(option.value)}
            onKeyDown={(event) =>
              handleTabKeyboardNavigation({
                event,
                tabs: tabValues,
                activeTab: value,
                onChange,
                getTabElementId: (tabId) => `${idPrefix}-${tabId}`,
              })
            }
            className={variantClassName}
          >
            <span className="flex items-center justify-center gap-2">
              {option.label}
              {option.loading ? (
                <span
                  className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-r-transparent"
                  aria-label="Загрузка"
                />
              ) : option.count ? (
                <span className="app-counter" aria-hidden="true">
                  {option.count}
                </span>
              ) : null}
            </span>
          </button>
        );
      })}
    </div>
  );
}
