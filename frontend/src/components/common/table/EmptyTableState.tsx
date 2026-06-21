import React from 'react';

import { EmptyState } from '../EmptyState';

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
        <EmptyState compact>{children}</EmptyState>
      </td>
    </tr>
  );
};
