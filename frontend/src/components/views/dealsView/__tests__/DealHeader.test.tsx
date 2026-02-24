import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { Deal } from '../../../../types';
import { DealHeader } from '../DealHeader';

const { addNotificationMock, copyToClipboardMock } = vi.hoisted(() => ({
  addNotificationMock: vi.fn(),
  copyToClipboardMock: vi.fn(),
}));

vi.mock('../../../../contexts/NotificationContext', () => ({
  useNotification: () => ({
    addNotification: addNotificationMock,
  }),
}));

vi.mock('../../../../utils/clipboard', () => ({
  copyToClipboard: copyToClipboardMock,
}));

const deal: Deal = {
  id: '123e4567-e89b-12d3-a456-426614174000',
  title: 'Deal title',
  clientId: 'client-1',
  clientName: 'Client A',
  status: 'open',
  createdAt: '2024-01-01T00:00:00Z',
  quotes: [],
  documents: [],
};

describe('DealHeader', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    copyToClipboardMock.mockResolvedValue(true);
  });

  it('renders deal info', () => {
    render(
      <DealHeader
        deal={{ ...deal, description: 'Test description', closingReason: 'Причина' }}
        clientDisplayName="Client A"
        clientPhone="+7 (999) 000-00-01"
        sellerDisplayName="Seller"
        executorDisplayName="Executor"
      />,
    );

    expect(screen.getByText('Deal title')).toBeInTheDocument();
    expect(screen.getByText('#123e4567')).toHaveAttribute('title', deal.id);
    expect(screen.getByText('Test description')).toBeInTheDocument();
    expect(screen.getByText('Client A')).toBeInTheDocument();
    expect(screen.getByText('Seller')).toBeInTheDocument();
    expect(screen.getByText('Executor')).toBeInTheDocument();
    expect(
      screen.getByText(
        (content) => content.includes('Причина закрытия') && content.includes('Причина'),
      ),
    ).toBeInTheDocument();
  });

  it('renders messaging icons when the client has a phone', () => {
    render(
      <DealHeader
        deal={deal}
        clientDisplayName="Client A"
        clientPhone="+7 999 000 00 02"
        sellerDisplayName="Seller"
        executorDisplayName="Executor"
      />,
    );

    expect(screen.getByRole('link', { name: 'Написать клиенту в WhatsApp' })).toHaveAttribute(
      'href',
      'https://wa.me/79990000002',
    );

    expect(screen.getByRole('link', { name: 'Написать клиенту в Telegram' })).toHaveAttribute(
      'href',
      'https://t.me/+79990000002',
    );
  });

  it('does not render WhatsApp icon when the client phone is missing', () => {
    render(
      <DealHeader
        deal={deal}
        clientDisplayName="Client A"
        sellerDisplayName="Seller"
        executorDisplayName="Executor"
      />,
    );

    expect(screen.queryByRole('link', { name: 'Написать клиенту в WhatsApp' })).toBeNull();
    expect(screen.queryByRole('link', { name: 'Написать клиенту в Telegram' })).toBeNull();
  });

  it('copies short deal id and shows success notification', async () => {
    render(
      <DealHeader
        deal={deal}
        clientDisplayName="Client A"
        sellerDisplayName="Seller"
        executorDisplayName="Executor"
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: `ID сделки ${deal.id}` }));

    await waitFor(() => {
      expect(copyToClipboardMock).toHaveBeenCalledWith('123e4567');
      expect(addNotificationMock).toHaveBeenCalledWith('ID сделки скопирован', 'success', 1600);
    });
  });

  it('shows error notification when copying fails', async () => {
    copyToClipboardMock.mockResolvedValue(false);
    render(
      <DealHeader
        deal={deal}
        clientDisplayName="Client A"
        sellerDisplayName="Seller"
        executorDisplayName="Executor"
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: `ID сделки ${deal.id}` }));

    await waitFor(() => {
      expect(addNotificationMock).toHaveBeenCalledWith(
        'Не удалось скопировать ID сделки',
        'error',
        2000,
      );
    });
  });
});
