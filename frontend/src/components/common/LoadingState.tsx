import type { HTMLAttributes, ReactNode } from 'react';

export interface SpinnerProps extends HTMLAttributes<HTMLSpanElement> {
  size?: 'sm' | 'md' | 'lg';
  label?: string;
}

const spinnerSizeClassName = {
  sm: 'h-4 w-4 border-2',
  md: 'h-6 w-6 border-2',
  lg: 'h-8 w-8 border-[3px]',
} as const;

export function Spinner({
  size = 'md',
  label = 'Загрузка',
  className = '',
  ...props
}: SpinnerProps) {
  return (
    <span
      className={['spinner', spinnerSizeClassName[size], className].filter(Boolean).join(' ')}
      role="status"
      aria-label={label}
      {...props}
    />
  );
}

export interface LoadingStateProps {
  label?: ReactNode;
  compact?: boolean;
  className?: string;
}

export function LoadingState({
  label = 'Загрузка данных…',
  compact = false,
  className = '',
}: LoadingStateProps) {
  return (
    <div
      className={[
        'loading-state',
        compact ? 'loading-state-compact' : 'loading-state-default',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
      role="status"
      aria-live="polite"
    >
      <Spinner size={compact ? 'sm' : 'md'} label="" aria-hidden="true" />
      <span>{label}</span>
    </div>
  );
}
