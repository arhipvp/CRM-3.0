import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import type { Deal } from '../../../../types';
import { DealDelayModal, DealMergeModal } from '../DealDetailsModals';
import type { DealEvent } from '../eventUtils';

const deal: Deal = {
  id: 'deal-1',
  title: 'Test Deal',
  clientId: 'client-1',
  clientName: 'Client A',
  status: 'open',
  createdAt: '2024-01-01T00:00:00Z',
  quotes: [],
  documents: [],
};

const upcomingEvent: DealEvent = {
  id: 'event-1',
  type: 'payment',
  date: '2025-01-01',
  title: 'Очередной платёж',
  description: 'Взнос по полису',
};

const pastEvent: DealEvent = {
  id: 'event-2',
  type: 'payment',
  date: '2023-12-01',
  title: 'Прошлый платёж',
};

describe('DealDetailsModals', () => {
  it('renders delay modal and wires events', () => {
    const onClose = vi.fn();
    const onEventSelect = vi.fn();
    const onConfirm = vi.fn();

    render(
      <DealDelayModal
        deal={deal}
        selectedEvent={upcomingEvent}
        selectedEventNextContact="2024-12-01"
        upcomingEvents={[upcomingEvent]}
        pastEvents={[pastEvent]}
        isSchedulingDelay={false}
        onClose={onClose}
        onEventSelect={onEventSelect}
        onConfirm={onConfirm}
      />
    );

    expect(screen.getByText('Отложить до следующего события')).toBeInTheDocument();
    const eventButton = screen.getByRole('button', { name: /Очередной платёж/ });
    fireEvent.click(eventButton);
    expect(onEventSelect).toHaveBeenCalledWith(upcomingEvent.id);

    fireEvent.click(screen.getByRole('button', { name: 'Перенести следующий контакт' }));
    expect(onConfirm).toHaveBeenCalled();

    fireEvent.click(screen.getByLabelText('Закрыть'));
    expect(onClose).toHaveBeenCalled();
  });

  it('renders merge modal and exposes handlers', () => {
    const onMergeSearchChange = vi.fn();
    const toggleMergeSource = vi.fn();
    const onSubmit = vi.fn();

    const dealList: Deal[] = [
      {
        id: 'deal-1',
        title: 'Deal 1',
        clientId: 'client-1',
        clientName: 'Client A',
        status: 'open',
        createdAt: '2024-01-01T00:00:00Z',
        quotes: [],
        documents: [],
      },
      {
        id: 'deal-2',
        title: 'Deal 2',
        clientId: 'client-1',
        clientName: 'Client A',
        status: 'open',
        createdAt: '2024-01-01T00:00:00Z',
        quotes: [],
        documents: [],
      },
    ];

    render(
      <DealMergeModal
        targetDeal={deal}
        selectedClientName="Client A"
        mergeSearch=""
        onMergeSearchChange={onMergeSearchChange}
        mergeList={dealList}
        mergeSources={['deal-1']}
        toggleMergeSource={toggleMergeSource}
        mergeError={null}
        isLoading={false}
        isActiveSearch={false}
        searchQuery=""
        isMerging={false}
        onClose={() => undefined}
        onSubmit={onSubmit}
      />
    );

    fireEvent.change(screen.getByRole('searchbox'), { target: { value: 'test' } });
    expect(onMergeSearchChange).toHaveBeenCalledWith('test');

    fireEvent.click(screen.getByRole('checkbox', { name: /Deal 2/ }));
    expect(toggleMergeSource).toHaveBeenCalledWith('deal-2');

    fireEvent.click(screen.getByRole('button', { name: 'Объединить сделки' }));
    expect(onSubmit).toHaveBeenCalled();
  });
});
