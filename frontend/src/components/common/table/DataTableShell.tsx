import React from 'react';

interface DataTableShellProps {
  children: React.ReactNode;
  className?: string;
}

export const DataTableShell: React.FC<DataTableShellProps> = ({ children, className }) => {
  const panelClassName = ['app-panel shadow-none overflow-hidden', className]
    .filter(Boolean)
    .join(' ');

  return (
    <div className={panelClassName}>
      <div className="overflow-x-auto bg-white">{children}</div>
    </div>
  );
};
