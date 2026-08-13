import React from 'react';

export interface DataTableShellProps {
  children: React.ReactNode;
  className?: string;
}

export const DataTableShell: React.FC<DataTableShellProps> = ({ children, className }) => {
  const panelClassName = ['app-panel overflow-hidden shadow-none', className]
    .filter(Boolean)
    .join(' ');

  return (
    <div className={panelClassName}>
      <div className="overflow-x-auto bg-[var(--app-surface)]">{children}</div>
    </div>
  );
};
