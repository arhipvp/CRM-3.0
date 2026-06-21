import type { HTMLAttributes, ReactNode } from 'react';

type PanelProps = HTMLAttributes<HTMLElement> & {
  as?: 'div' | 'section' | 'article';
  variant?: 'default' | 'muted' | 'flat';
  padding?: 'none' | 'sm' | 'md' | 'lg';
  children: ReactNode;
};

type SectionHeaderProps = {
  title: string;
  eyebrow?: string;
  description?: ReactNode;
  actions?: ReactNode;
  titleId?: string;
  className?: string;
};

type StatusBadgeProps = {
  children: ReactNode;
  tone?: 'neutral' | 'primary' | 'success' | 'warning' | 'danger';
  className?: string;
};

type SegmentedControlProps<T extends string> = {
  options: Array<{ value: T; label: ReactNode; disabled?: boolean }>;
  value: T;
  onChange: (value: T) => void;
  ariaLabel: string;
  className?: string;
};

const panelVariantClassName: Record<NonNullable<PanelProps['variant']>, string> = {
  default: 'app-panel shadow-none',
  muted: 'app-panel-muted',
  flat: 'rounded-2xl border border-[var(--app-border)] bg-white',
};

const panelPaddingClassName: Record<NonNullable<PanelProps['padding']>, string> = {
  none: '',
  sm: 'p-3',
  md: 'p-4',
  lg: 'p-6',
};

const badgeToneClassName: Record<NonNullable<StatusBadgeProps['tone']>, string> = {
  neutral: 'border-slate-200 bg-slate-50 text-slate-700',
  primary: 'border-sky-200 bg-sky-50 text-sky-800',
  success: 'border-emerald-200 bg-emerald-50 text-emerald-800',
  warning: 'border-amber-200 bg-amber-50 text-amber-800',
  danger: 'border-rose-200 bg-rose-50 text-rose-800',
};

export function Panel({
  as = 'div',
  variant = 'default',
  padding = 'md',
  className = '',
  children,
  ...props
}: PanelProps) {
  const Component = as;
  const resolvedClassName = [
    panelVariantClassName[variant],
    panelPaddingClassName[padding],
    className,
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <Component className={resolvedClassName} {...props}>
      {children}
    </Component>
  );
}

export function SectionHeader({
  title,
  eyebrow,
  description,
  actions,
  titleId,
  className = '',
}: SectionHeaderProps) {
  return (
    <div className={['flex flex-wrap items-start justify-between gap-3', className].join(' ')}>
      <div className="min-w-0 space-y-1">
        {eyebrow && <p className="app-label">{eyebrow}</p>}
        <h2 id={titleId} className="text-xl font-semibold text-slate-900">
          {title}
        </h2>
        {description && <p className="text-sm text-slate-500">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

export function StatusBadge({ children, tone = 'neutral', className = '' }: StatusBadgeProps) {
  return (
    <span
      className={[
        'inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-semibold',
        badgeToneClassName[tone],
        className,
      ]
        .filter(Boolean)
        .join(' ')}
    >
      {children}
    </span>
  );
}

export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  ariaLabel,
  className = '',
}: SegmentedControlProps<T>) {
  return (
    <div
      className={['app-segmented-control', className].filter(Boolean).join(' ')}
      role="group"
      aria-label={ariaLabel}
    >
      {options.map((option) => {
        const isSelected = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            disabled={option.disabled}
            aria-pressed={isSelected}
            onClick={() => onChange(option.value)}
            className={`app-segmented-control-button ${
              isSelected
                ? 'border border-[var(--app-border)] bg-white font-semibold text-sky-700 shadow-sm'
                : 'text-slate-500 hover:bg-white/70 hover:text-slate-800'
            }`}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
