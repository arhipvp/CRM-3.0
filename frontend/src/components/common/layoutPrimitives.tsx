import type { HTMLAttributes, ReactNode } from 'react';

export type PanelProps = HTMLAttributes<HTMLElement> & {
  as?: 'div' | 'section' | 'article';
  variant?: 'default' | 'muted' | 'flat';
  padding?: 'none' | 'sm' | 'md' | 'lg';
  children: ReactNode;
};

export type SectionHeaderProps = {
  title: string;
  eyebrow?: string;
  description?: ReactNode;
  actions?: ReactNode;
  titleId?: string;
  size?: 'sm' | 'md';
  className?: string;
};

export type PageHeaderProps = {
  title: string;
  description?: ReactNode;
  eyebrow?: string;
  actions?: ReactNode;
  meta?: ReactNode;
  titleId?: string;
  className?: string;
};

export type ToolbarProps = HTMLAttributes<HTMLDivElement> & {
  leading?: ReactNode;
  trailing?: ReactNode;
  children?: ReactNode;
};

export type StatusBadgeProps = {
  children: ReactNode;
  tone?: 'neutral' | 'primary' | 'success' | 'warning' | 'danger';
  dot?: boolean;
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
  flat: 'rounded-[var(--app-radius-lg)] border border-[var(--app-border)] bg-white',
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

export function PageShell({ className = '', ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={['app-page', className].filter(Boolean).join(' ')} {...props} />;
}

export function PageHeader({
  title,
  description,
  eyebrow,
  actions,
  meta,
  titleId,
  className = '',
}: PageHeaderProps) {
  return (
    <header className={['app-page-header', className].filter(Boolean).join(' ')}>
      <div className="min-w-0 space-y-1">
        {eyebrow && <p className="app-label text-[var(--app-primary)]">{eyebrow}</p>}
        <h1 id={titleId} className="text-2xl font-semibold tracking-tight text-[var(--app-text)]">
          {title}
        </h1>
        {description && <div className="text-sm text-[var(--app-text-muted)]">{description}</div>}
        {meta && (
          <div className="flex flex-wrap items-center gap-2 pt-1 text-xs text-slate-500">
            {meta}
          </div>
        )}
      </div>
      {actions && <div className="flex flex-wrap items-center justify-end gap-2">{actions}</div>}
    </header>
  );
}

export function Toolbar({ leading, trailing, children, className = '', ...props }: ToolbarProps) {
  return (
    <div className={['app-toolbar', className].filter(Boolean).join(' ')} {...props}>
      <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">{leading ?? children}</div>
      {trailing && <div className="flex flex-wrap items-center justify-end gap-2">{trailing}</div>}
    </div>
  );
}

export function SectionHeader({
  title,
  eyebrow,
  description,
  actions,
  titleId,
  size = 'md',
  className = '',
}: SectionHeaderProps) {
  return (
    <div className={['flex flex-wrap items-start justify-between gap-3', className].join(' ')}>
      <div className="min-w-0 space-y-1">
        {eyebrow && <p className="app-label">{eyebrow}</p>}
        <h2
          id={titleId}
          className={
            size === 'sm'
              ? 'text-base font-semibold text-slate-900'
              : 'text-xl font-semibold text-slate-900'
          }
        >
          {title}
        </h2>
        {description && <p className="text-sm text-slate-500">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

export function StatusBadge({
  children,
  tone = 'neutral',
  dot = false,
  className = '',
}: StatusBadgeProps) {
  return (
    <span
      className={[
        'inline-flex min-h-6 items-center gap-1.5 rounded-full border px-2 py-0.5 text-xs font-semibold',
        badgeToneClassName[tone],
        className,
      ]
        .filter(Boolean)
        .join(' ')}
    >
      {dot && <span className="h-1.5 w-1.5 rounded-full bg-current" aria-hidden="true" />}
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
                ? 'border border-[var(--app-border)] bg-white font-semibold text-[var(--app-primary)] shadow-sm'
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
