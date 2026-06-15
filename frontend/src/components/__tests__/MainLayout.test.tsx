import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { MainLayout } from '../MainLayout';

const SIDEBAR_COLLAPSED_STORAGE_KEY = 'crm.sidebar.collapsed';

const renderLayout = (withUser = false) =>
  render(
    <MemoryRouter>
      <MainLayout
        onAddDeal={vi.fn()}
        onAddClient={vi.fn()}
        onOpenCommandPalette={vi.fn()}
        currentUser={
          withUser ? { id: 'user-1', username: 'operator', roles: ['manager'] } : undefined
        }
      >
        <div>Содержимое</div>
      </MainLayout>
    </MemoryRouter>,
  );

describe('MainLayout', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('renders the expanded desktop sidebar by default', () => {
    renderLayout();

    expect(screen.getByTestId('main-sidebar')).toHaveClass('lg:w-60');
    expect(screen.getByTestId('main-content')).toHaveClass('lg:ml-60', 'min-w-0');
    expect(screen.getByRole('button', { name: 'Свернуть боковую панель' })).toHaveAttribute(
      'aria-expanded',
      'true',
    );
  });

  it('collapses the desktop sidebar and persists the choice', () => {
    renderLayout();

    fireEvent.click(screen.getByRole('button', { name: 'Свернуть боковую панель' }));

    expect(screen.getByTestId('main-sidebar')).toHaveClass('lg:w-20');
    expect(screen.getByTestId('main-content')).toHaveClass('lg:ml-20');
    expect(screen.getByText('Сделки')).toHaveClass('lg:sr-only');
    expect(localStorage.getItem(SIDEBAR_COLLAPSED_STORAGE_KEY)).toBe('true');
    expect(screen.getByRole('button', { name: 'Развернуть боковую панель' })).toHaveAttribute(
      'aria-expanded',
      'false',
    );
  });

  it('restores the collapsed sidebar from localStorage', () => {
    localStorage.setItem(SIDEBAR_COLLAPSED_STORAGE_KEY, 'true');

    renderLayout(true);

    expect(screen.getByTestId('main-sidebar')).toHaveClass('lg:w-20');
    expect(screen.getByTestId('main-content')).toHaveClass('lg:ml-20');
    expect(screen.getByLabelText('Пользователь: operator')).toHaveTextContent('o');
  });
});
