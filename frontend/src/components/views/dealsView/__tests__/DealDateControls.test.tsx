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
  onQuickShift: vi.fn(),
  onEventDelayClick: vi.fn(),
  onAddEventClick: vi.fn(),
};

describe('DealDateControls', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders next contact input, read-only deadline and quick options', () => {
    render(<DealDateControls {...baseProps} />);

    expect(screen.getByDisplayValue('2024-01-10')).toBeInTheDocument();
    expect(screen.getByText('Крайний срок')).toBeInTheDocument();
    expect(screen.getByText('2024-02-10')).toBeInTheDocument();
    expect(screen.queryByDisplayValue('2024-02-10')).not.toBeInTheDocument();

    fireEvent.change(screen.getByDisplayValue('2024-01-10'), {
      target: { value: '2024-01-20' },
    });
    expect(baseProps.onNextContactChange).toHaveBeenCalledWith('2024-01-20');

    fireEvent.blur(screen.getByDisplayValue('2024-01-10'));
    expect(baseProps.onNextContactBlur).toHaveBeenCalledWith('2024-01-10');

    fireEvent.click(screen.getByText('завтра'));
    expect(baseProps.onQuickShift).toHaveBeenCalledWith(1);
  });

  it('renders add event action near deadline and wires click', () => {
    render(<DealDateControls {...baseProps} />);

    fireEvent.click(screen.getByText('Добавить событие'));
    expect(baseProps.onAddEventClick).toHaveBeenCalled();
  });

  it('renders event delay quick action and wires click', () => {
    render(
      <DealDateControls
        {...baseProps}
        eventDelayLabel="за 60 дней до ближайшего события"
        eventDelayTitle="Окончание полиса: 28.07.2026"
      />,
    );

    fireEvent.click(screen.getByText('за 60 дней до ближайшего события'));
    expect(baseProps.onEventDelayClick).toHaveBeenCalled();
  });

  it('disables event delay quick action when requested', () => {
    render(
      <DealDateControls
        {...baseProps}
        eventDelayLabel="за 60 дней до ближайшего события"
        eventDelayDisabled
      />,
    );

    expect(screen.getByText('за 60 дней до ближайшего события')).toBeDisabled();
  });

  it('shows expected close reason when provided', () => {
    render(
      <DealDateControls
        {...baseProps}
        expectedCloseReason={{
          status: 'exact',
          events: [
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
          ],
        }}
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
        expectedCloseReason={{
          status: 'exact',
          events: [
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
          ],
        }}
      />,
    );

    expect(
      screen.getByText('Предположительно купит квартиру, предложить застраховать'),
    ).toBeInTheDocument();
  });

  it('shows unknown reason fallback', () => {
    render(
      <DealDateControls
        {...baseProps}
        expectedCloseReason={{
          status: 'empty',
          events: [],
          message: 'Нет событий, которые объясняют крайний срок.',
        }}
      />,
    );

    expect(screen.getByText('Нет событий, которые объясняют крайний срок.')).toBeInTheDocument();
  });

  it('shows mismatch warning when deadline differs from source event', () => {
    render(
      <DealDateControls
        {...baseProps}
        expectedCloseReason={{
          status: 'mismatch',
          message:
            'Ближайшее основание: окончание полиса 26.06.2027, но крайний срок сейчас 26.06.2026.',
          events: [
            {
              id: 'policy-expiration-policy-1',
              deal: 'deal-1',
              eventType: 'policy_expiration',
              eventTypeDisplay: 'Окончание полиса',
              eventDate: '2027-06-26',
              title: 'Окончание полиса',
              description: 'полис EMGI-26-111666-78',
              sourceType: 'policy',
              sourceId: 'policy-1',
              actor: null,
              actorUsername: null,
              actorDisplayName: null,
              metadata: {},
              createdAt: '2024-01-01T10:00:00Z',
            },
          ],
        }}
      />,
    );

    expect(screen.getByText(/Ближайшее основание: окончание полиса/)).toBeInTheDocument();
    expect(screen.getByText(/полис EMGI-26-111666-78/)).toBeInTheDocument();
  });
});
