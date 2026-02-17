import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { FilterBar } from '../FilterBar';

describe('FilterBar', () => {
  it('applies compact density and inline-wrap layout classes', () => {
    const onFilterChange = vi.fn();

    render(
      <FilterBar
        onFilterChange={onFilterChange}
        density="compact"
        layout="inline-wrap"
        sortOptions={[{ value: '-start_date', label: 'Начало (убывание)' }]}
        customFilters={[{ key: 'unpaid_payments', label: 'Только неоплаченные', type: 'checkbox' }]}
      />,
    );

    const searchInput = screen.getByLabelText('Поиск');
    const sortSelect = screen.getByLabelText('Сортировка');

    expect(searchInput.className).toContain('h-9');
    expect(sortSelect.className).toContain('h-9');
  });

  it('keeps filter behavior with new props', () => {
    const onFilterChange = vi.fn();

    render(
      <FilterBar
        onFilterChange={onFilterChange}
        density="compact"
        layout="inline-wrap"
        sortOptions={[{ value: 'number', label: 'Номер (A → Z)' }]}
        customFilters={[{ key: 'unpaid_payments', label: 'Только неоплаченные', type: 'checkbox' }]}
      />,
    );

    fireEvent.change(screen.getByLabelText('Поиск'), { target: { value: 'POL-77' } });
    fireEvent.change(screen.getByLabelText('Сортировка'), { target: { value: 'number' } });
    fireEvent.click(screen.getByLabelText('Только неоплаченные'));

    expect(onFilterChange).toHaveBeenCalledWith({
      ordering: 'number',
      search: 'POL-77',
      unpaid_payments: 'true',
    });
  });
});
