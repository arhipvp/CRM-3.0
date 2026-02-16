import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { DataTableShell } from '../table/DataTableShell';
import { EmptyTableState } from '../table/EmptyTableState';

describe('table primitives', () => {
  it('renders wrapped table and empty state row', () => {
    render(
      <DataTableShell>
        <table>
          <tbody>
            <EmptyTableState colSpan={3}>Нет данных</EmptyTableState>
          </tbody>
        </table>
      </DataTableShell>,
    );

    expect(screen.getByText('Нет данных')).toBeInTheDocument();
  });
});
