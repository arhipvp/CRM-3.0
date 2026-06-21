import type { ReactNode } from 'react';

import { AppIcon, type AppIconName } from './AppIcon';

interface EmptyStateProps {
  children: ReactNode;
  title?: string;
  icon?: AppIconName;
  compact?: boolean;
  actions?: ReactNode;
  className?: string;
}

export function EmptyState({
  children,
  title,
  icon = 'file',
  compact = false,
  actions,
  className = '',
}: EmptyStateProps) {
  if (compact) {
    return (
      <div
        className={['app-panel-muted inline-flex px-4 py-3 text-sm text-slate-600', className]
          .filter(Boolean)
          .join(' ')}
      >
        {children}
      </div>
    );
  }

  return (
    <div
      className={[
        'app-panel-muted flex flex-col items-center justify-center gap-3 px-5 py-8 text-center text-sm text-slate-600',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
    >
      <span className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-[var(--app-border)] bg-white text-slate-500">
        <AppIcon name={icon} size={18} />
      </span>
      <div className="space-y-1">
        {title && <p className="font-semibold text-slate-900">{title}</p>}
        <div>{children}</div>
      </div>
      {actions && <div className="flex flex-wrap justify-center gap-2">{actions}</div>}
    </div>
  );
}
