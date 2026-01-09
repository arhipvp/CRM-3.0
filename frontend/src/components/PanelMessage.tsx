import React from 'react';

type PanelMessageProps = {
  children: React.ReactNode;
  className?: string;
};

export const PanelMessage: React.FC<PanelMessageProps> = ({ children, className }) => {
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
};
