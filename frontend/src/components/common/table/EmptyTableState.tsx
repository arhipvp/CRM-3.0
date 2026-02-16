import React from 'react';

interface EmptyTableStateProps {
  colSpan: number;
  children: React.ReactNode;
}

export const EmptyTableState: React.FC<EmptyTableStateProps> = ({ colSpan, children }) => {
  return (
    <tr>
      <td
        colSpan={colSpan}
        className="border border-slate-200 px-6 py-10 text-center text-slate-600"
      >
        <div className="app-panel-muted inline-flex px-4 py-3 text-sm text-slate-600">
          {children}
        </div>
      </td>
    </tr>
  );
};
