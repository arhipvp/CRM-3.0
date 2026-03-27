import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import userEvent from '@testing-library/user-event';

import { CommissionsView } from '../CommissionsView';
import { NotificationProvider } from '../../../contexts/NotificationProvider';

describe('CommissionsView', () => {
  it('shows a pending statements state while finance snapshot is not yet consistent', async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <NotificationProvider>
          <CommissionsView
            payments={[]}
            financialRecords={[
              {
                id: 'record-1',
                paymentId: 'payment-1',
                amount: '1000',
                createdAt: '2026-03-06T10:00:00Z',
                updatedAt: '2026-03-06T10:00:00Z',
              },
            ]}
            policies={[]}
            statements={[]}
            hasCommissionsSnapshotLoaded={false}
          />
        </NotificationProvider>
      </MemoryRouter>,
    );

    await user.click(screen.getByRole('tab', { name: 'Ведомости' }));
    expect(screen.getAllByText('Загружаем согласованное состояние ведомостей...')).toHaveLength(2);
    expect(screen.queryByText('Ведомостей пока нет')).not.toBeInTheDocument();
  });

  it('shows statement amount controls and keeps amount sorting stable when toggling percent mode', async () => {
    const user = userEvent.setup();
    const onUpdateFinancialRecord = vi.fn().mockResolvedValue(undefined);

    render(
      <MemoryRouter>
        <NotificationProvider>
          <CommissionsView
            payments={[
              {
                id: 'payment-1',
                amount: '10000',
                actualDate: '2026-03-10',
                createdAt: '2026-03-06T10:00:00Z',
                updatedAt: '2026-03-06T10:00:00Z',
              },
              {
                id: 'payment-2',
                amount: '12000',
                actualDate: '2026-03-11',
                createdAt: '2026-03-06T10:00:00Z',
                updatedAt: '2026-03-06T10:00:00Z',
              },
            ]}
            financialRecords={[
              {
                id: 'record-1',
                paymentId: 'payment-1',
                statementId: 'statement-1',
                paymentAmount: '10000',
                paymentActualDate: '2026-03-10',
                dealTitle: 'Сделка 1',
                dealClientName: 'Клиент 1',
                policyClientName: 'Клиент А',
                paymentPaidBalance: '1000',
                amount: '300',
                date: '2026-03-10',
                createdAt: '2026-03-06T10:00:00Z',
                updatedAt: '2026-03-06T10:00:00Z',
              },
              {
                id: 'record-2',
                paymentId: 'payment-2',
                statementId: 'statement-1',
                paymentAmount: '12000',
                paymentActualDate: '2026-03-11',
                dealTitle: 'Сделка 2',
                dealClientName: 'Клиент 2',
                policyClientName: 'Клиент Б',
                paymentPaidBalance: '2000',
                amount: '100',
                date: '2026-03-11',
                createdAt: '2026-03-06T10:00:00Z',
                updatedAt: '2026-03-06T10:00:00Z',
              },
            ]}
            policies={[]}
            statements={[
              {
                id: 'statement-1',
                name: 'Алиса',
                statementType: 'expense',
                status: 'draft',
                totalAmount: '400',
                recordsCount: 2,
                createdAt: '2026-03-06T10:00:00Z',
                updatedAt: '2026-03-06T10:00:00Z',
              },
            ]}
            hasCommissionsSnapshotLoaded
            onUpdateFinancialRecord={onUpdateFinancialRecord}
          />
        </NotificationProvider>
      </MemoryRouter>,
    );

    await user.click(screen.getByRole('tab', { name: 'Ведомости' }));
    const statementAmountInput = (
      await screen.findAllByLabelText('Общая сумма для всей ведомости')
    )[0];
    expect(statementAmountInput).toBeInTheDocument();

    await user.click(screen.getAllByRole('button', { name: /Сортировать по сумме/i })[0]);

    const beforeToggle = screen.getAllByText(/^Клиент [АБ]$/);
    expect(beforeToggle[0]).toHaveTextContent('Клиент Б');
    expect(beforeToggle[1]).toHaveTextContent('Клиент А');

    await user.click(
      screen.getAllByRole('button', { name: 'Переключить ввод суммы на проценты' })[0],
    );

    const afterToggle = screen.getAllByText(/^Клиент [АБ]$/);
    expect(afterToggle[0]).toHaveTextContent('Клиент Б');
    expect(afterToggle[1]).toHaveTextContent('Клиент А');

    await user.type(statementAmountInput, '10');
    await user.click(screen.getAllByRole('button', { name: 'Применить ко всей ведомости' })[0]);

    expect(onUpdateFinancialRecord).toHaveBeenCalledTimes(2);
    expect(onUpdateFinancialRecord).toHaveBeenNthCalledWith(
      1,
      'record-2',
      expect.objectContaining({ amount: '200' }),
    );
    expect(onUpdateFinancialRecord).toHaveBeenNthCalledWith(
      2,
      'record-1',
      expect.objectContaining({ amount: '100' }),
    );
  });
});
