import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { DealDateControls } from '../DealDateControls';

const baseProps = {
  nextContactValue: '2024-01-10',
  expectedCloseValue: '2024-02-10',
  headerExpectedCloseTone: 'text-slate-500',
  quickOptions: [
    { label: 'завтра', days: 1 },
    { label: '+2 дня', days: 2 },
  ],
  onNextContactChange: vi.fn(),
  onNextContactBlur: vi.fn(),
  onExpectedCloseChange: vi.fn(),
  onExpectedCloseBlur: vi.fn(),
  onQuickShift: vi.fn(),
};

describe('DealDateControls', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders inputs and quick options', () => {
    render(<DealDateControls {...baseProps} />);

    expect(screen.getByDisplayValue('2024-01-10')).toBeInTheDocument();
    expect(screen.getByDisplayValue('2024-02-10')).toBeInTheDocument();

    fireEvent.change(screen.getByDisplayValue('2024-01-10'), {
      target: { value: '2024-01-20' },
    });
    expect(baseProps.onNextContactChange).toHaveBeenCalledWith('2024-01-20');

    fireEvent.blur(screen.getByDisplayValue('2024-01-10'));
    expect(baseProps.onNextContactBlur).toHaveBeenCalledWith('2024-01-10');

    fireEvent.click(screen.getByText('завтра'));
    expect(baseProps.onQuickShift).toHaveBeenCalledWith(1);
  });

  it('handles expected close changes', () => {
    render(<DealDateControls {...baseProps} />);

    fireEvent.change(screen.getByDisplayValue('2024-02-10'), {
      target: { value: '2024-03-10' },
    });
    expect(baseProps.onExpectedCloseChange).toHaveBeenCalledWith('2024-03-10');

    fireEvent.blur(screen.getByDisplayValue('2024-02-10'));
    expect(baseProps.onExpectedCloseBlur).toHaveBeenCalledWith('2024-02-10');
  });
});
