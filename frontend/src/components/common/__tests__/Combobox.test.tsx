import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { Combobox } from '../forms/Combobox';

const options = [
  { id: '1', name: 'Анна' },
  { id: '2', name: 'Борис' },
];

describe('Combobox', () => {
  it('exposes listbox semantics and supports keyboard selection', () => {
    const onOpen = vi.fn();
    const onSelect = vi.fn();
    render(
      <Combobox<{ id: string; name: string }>
        id="client"
        value=""
        options={options}
        isOpen
        onOpen={onOpen}
        onClose={vi.fn()}
        onChange={vi.fn()}
        onSelect={onSelect}
        getOptionKey={(option) => option.id}
        getOptionLabel={(option) => option.name}
      />,
    );

    const input = screen.getByRole('combobox');
    expect(input).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByRole('listbox')).toBeInTheDocument();
    expect(screen.getAllByRole('option')[0]).toHaveAttribute('aria-selected', 'true');

    fireEvent.keyDown(input, { key: 'ArrowDown' });
    expect(screen.getAllByRole('option')[1]).toHaveAttribute('aria-selected', 'true');
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(onSelect).toHaveBeenCalledWith(options[1]);
  });

  it('closes on Escape and announces async loading', () => {
    const onClose = vi.fn();
    render(
      <Combobox<{ id: string; name: string }>
        id="client"
        value="Ан"
        options={[]}
        isOpen
        isLoading
        onOpen={vi.fn()}
        onClose={onClose}
        onChange={vi.fn()}
        onSelect={vi.fn()}
        getOptionKey={(option) => option.id}
        getOptionLabel={(option) => option.name}
      />,
    );

    const input = screen.getByRole('combobox');
    expect(input).toHaveAttribute('aria-busy', 'true');
    expect(screen.getByRole('status')).toHaveTextContent('Загрузка');
    fireEvent.keyDown(input, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
