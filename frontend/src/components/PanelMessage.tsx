import type { ReactNode } from 'react';

interface PanelMessageProps {
  children: ReactNode;
  className?: string;
}

export function PanelMessage({ children, className }: PanelMessageProps) {
  const classes = [
    'app-panel-muted',
    'inline-flex',
    'px-4',
    'py-3',
    'text-sm',
    'text-slate-600',
    className,
  ]
    .filter(Boolean)
    .join(' ');

  return <div className={classes}>{children}</div>;
}
