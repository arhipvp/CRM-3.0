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

  it('shows expected close reason when provided', () => {
    render(
      <DealDateControls
        {...baseProps}
        expectedCloseReasons={[
          {
            id: 'policy-expiration-policy-1',
            deal: 'deal-1',
            eventType: 'policy_expiration',
            eventTypeDisplay: 'Окончание полиса',
            eventDate: '2024-02-10',
            title: 'Окончание полиса',
            description: 'полис POL-777',
            sourceType: 'policy',
            sourceId: 'policy-1',
            actor: null,
            actorUsername: null,
            actorDisplayName: null,
            metadata: { policy_number: 'POL-777' },
            createdAt: '2024-01-01T10:00:00Z',
          },
        ]}
      />,
    );

    expect(screen.getByText('Почему эта дата')).toBeInTheDocument();
    expect(screen.getByText('Окончание полиса')).toBeInTheDocument();
    expect(screen.getByText(/полис POL-777/)).toBeInTheDocument();
  });

  it('shows manual expected close reason when provided', () => {
    render(
      <DealDateControls
        {...baseProps}
        expectedCloseReasons={[
          {
            id: 'deal-event-event-1',
            deal: 'deal-1',
            eventType: 'manual',
            eventTypeDisplay: 'Ручное событие',
            eventDate: '2024-02-10',
            title: 'Предположительно купит квартиру, предложить застраховать',
            description: '',
            sourceType: '',
            sourceId: '',
            actor: null,
            actorUsername: null,
            actorDisplayName: null,
            metadata: {},
            createdAt: '2024-01-01T10:00:00Z',
          },
        ]}
      />,
    );

    expect(
      screen.getByText('Предположительно купит квартиру, предложить застраховать'),
    ).toBeInTheDocument();
  });

  it('shows unknown reason fallback', () => {
    render(<DealDateControls {...baseProps} expectedCloseReasons={[]} />);

    expect(screen.getByText('Причина не определена')).toBeInTheDocument();
  });
});
