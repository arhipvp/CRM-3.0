import React from 'react';

export type InlineAlertTone = 'danger' | 'success' | 'warning' | 'info';
type InlineAlertTag = 'div' | 'p';

interface InlineAlertProps {
  children: React.ReactNode;
  tone?: InlineAlertTone;
  as?: InlineAlertTag;
  className?: string;
}

const TONE_CLASS: Record<InlineAlertTone, string> = {
  danger: 'app-alert app-alert-danger',
  success: 'app-alert app-alert-success',
  warning: 'app-alert border-amber-200 bg-amber-50 text-amber-900',
  info: 'app-alert border-sky-200 bg-sky-50 text-sky-900',
};

export const InlineAlert: React.FC<InlineAlertProps> = ({
  children,
  tone = 'danger',
  as = 'div',
  className,
}) => {
  const Component = as;
  const resolvedClassName = [TONE_CLASS[tone], className].filter(Boolean).join(' ');

  const liveProps =
    tone === 'danger'
      ? { role: 'alert' as const, 'aria-live': 'assertive' as const }
      : { role: 'status' as const, 'aria-live': 'polite' as const };

  return (
    <Component className={resolvedClassName} {...liveProps}>
      {children}
    </Component>
  );
};
