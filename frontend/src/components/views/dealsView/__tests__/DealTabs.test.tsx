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
    expect(overviewTab).toHaveAttribute('aria-controls', 'deal-tabpanel-overview');

    const tasksTab = screen.getByRole('tab', { name: 'Задачи' });
    expect(tasksTab).toHaveAttribute('aria-selected', 'false');
    fireEvent.click(tasksTab);
    expect(onChange).toHaveBeenCalledWith('tasks');
  });

  it('shows spinner for tasks tab and hides its counter while loading', () => {
    const { container } = render(
      <DealTabs
        activeTab="overview"
        onChange={vi.fn()}
        tabCounts={{ tasks: 6 }}
        loadingByTab={{ tasks: true }}
      />,
    );

    const tasksTab = container.querySelector('#deal-tab-tasks');
    expect(tasksTab).toBeInTheDocument();
    expect(tasksTab?.querySelector('.animate-spin')).toBeInTheDocument();
    expect(tasksTab?.querySelector('.app-counter')).not.toBeInTheDocument();
  });
});
