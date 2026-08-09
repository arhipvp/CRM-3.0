import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { DealTabs } from '../DealTabs';

describe('DealTabs', () => {
  it('renders tablist with aria attributes and invokes onChange', () => {
    const onChange = vi.fn();
    render(<DealTabs activeTab="overview" onChange={onChange} />);

    const tablist = screen.getByRole('tablist');
    expect(tablist).toBeInTheDocument();

    const overviewTab = screen.getByRole('tab', { name: 'Обзор' });
    expect(overviewTab).toHaveAttribute('aria-selected', 'true');

    const workTab = screen.getByRole('tab', { name: 'Работа' });
    expect(workTab).toHaveAttribute('aria-selected', 'false');
    expect(overviewTab).toHaveAttribute('tabindex', '0');
    expect(workTab).toHaveAttribute('tabindex', '-1');
    expect(screen.getAllByRole('tab')).toHaveLength(5);
    fireEvent.click(workTab);
    expect(onChange).toHaveBeenCalledWith('tasks');
  });

  it('supports arrow, Home and End keyboard navigation', () => {
    const onChange = vi.fn();
    render(<DealTabs activeTab="overview" onChange={onChange} />);

    const overviewTab = screen.getByRole('tab', { name: 'Обзор' });
    fireEvent.keyDown(overviewTab, { key: 'ArrowRight' });
    expect(onChange).toHaveBeenCalledWith('tasks');
    expect(screen.getByRole('tab', { name: 'Работа' })).toHaveFocus();

    fireEvent.keyDown(overviewTab, { key: 'End' });
    expect(onChange).toHaveBeenLastCalledWith('chat');
    expect(screen.getByRole('tab', { name: 'Активность' })).toHaveFocus();
  });

  it('shows spinner for tasks tab and hides its counter while loading', () => {
    const { container } = render(
      <DealTabs
        activeTab="tasks"
        onChange={vi.fn()}
        tabCounts={{ tasks: 6 }}
        loadingByTab={{ tasks: true }}
      />,
    );

    const workTab = container.querySelector('#deal-tab-group-work');
    expect(workTab).toBeInTheDocument();
    expect(workTab?.querySelector('.animate-spin')).toBeInTheDocument();
  });

  it('reserves space for subtabs even when the active section has none', () => {
    const { rerender } = render(<DealTabs activeTab="overview" onChange={vi.fn()} />);

    const subtabs = screen.getByTestId('deal-subtabs');
    expect(subtabs).toHaveClass('min-h-8');
    expect(subtabs).toHaveAttribute('aria-hidden', 'true');

    rerender(<DealTabs activeTab="tasks" onChange={vi.fn()} />);
    expect(screen.getByTestId('deal-subtabs')).toHaveClass('min-h-8');
    expect(screen.getByRole('button', { name: 'Задачи' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Расчёты' })).toBeInTheDocument();
  });
});
