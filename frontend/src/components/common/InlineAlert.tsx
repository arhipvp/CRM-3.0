import React from 'react';

type InlineAlertTone = 'danger' | 'success' | 'info';
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
  info: 'app-panel-muted text-slate-700',
};

export const InlineAlert: React.FC<InlineAlertProps> = ({
  children,
  tone = 'danger',
  as = 'div',
  className,
}) => {
  const Component = as;
  const resolvedClassName = [TONE_CLASS[tone], className].filter(Boolean).join(' ');

  return <Component className={resolvedClassName}>{children}</Component>;
};
