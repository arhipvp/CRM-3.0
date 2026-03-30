import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import userEvent from '@testing-library/user-event';

import { CommissionsView } from '../CommissionsView';
import { NotificationProvider } from '../../../contexts/NotificationProvider';
import {
  fetchFinancialRecordsWithPagination,
  fetchStatementFinancialRecords,
} from '../../../api';

vi.mock('../../../api', async () => {
  const actual = await vi.importActual<typeof import('../../../api')>('../../../api');
  return {
    ...actual,
    fetchStatementFinancialRecords: vi.fn(),
    fetchFinancialRecordsWithPagination: vi.fn(),
  };
});

const mockedFetchStatementFinancialRecords = vi.mocked(fetchStatementFinancialRecords);
const mockedFetchFinancialRecordsWithPagination = vi.mocked(fetchFinancialRecordsWithPagination);

beforeEach(() => {
  vi.resetAllMocks();
  mockedFetchStatementFinancialRecords.mockResolvedValue([]);
  mockedFetchFinancialRecordsWithPagination.mockResolvedValue({
    count: 0,
    next: null,
    previous: null,
    results: [],
  });
});

describe('CommissionsView', () => {
  it('shows a route-level loading state while statements snapshot is loading', () => {
    render(
      <MemoryRouter>
        <NotificationProvider>
          <CommissionsView
            payments={[]}
            policies={[]}
            statements={[]}
            isLoading
            hasCommissionsSnapshotLoaded={false}
          />
        </NotificationProvider>
      </MemoryRouter>,
    );

    expect(screen.getByText('Загружаем финансовые данные...')).toBeInTheDocument();
    expect(screen.queryByText('Ведомостей пока нет')).not.toBeInTheDocument();
  });

  it('loads statement records lazily and does not request all records on initial render', async () => {
    mockedFetchStatementFinancialRecords.mockResolvedValueOnce([
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
    ]);

    render(
      <MemoryRouter>
        <NotificationProvider>
          <CommissionsView
            payments={[]}
            policies={[]}
            statements={[
              {
                id: 'statement-1',
                name: 'Алиса',
                statementType: 'expense',
                status: 'draft',
                totalAmount: '300',
                recordsCount: 1,
                createdAt: '2026-03-06T10:00:00Z',
                updatedAt: '2026-03-06T10:00:00Z',
              },
            ]}
            hasCommissionsSnapshotLoaded
          />
        </NotificationProvider>
      </MemoryRouter>,
    );

    expect(await screen.findAllByText('Клиент А')).toHaveLength(2);
    expect(mockedFetchStatementFinancialRecords).toHaveBeenCalledWith('statement-1', expect.any(Object));
    expect(mockedFetchFinancialRecordsWithPagination).not.toHaveBeenCalled();
  });

  it('shows statement amount controls and keeps amount sorting stable when toggling percent mode', async () => {
    const user = userEvent.setup();
    const onUpdateFinancialRecord = vi.fn().mockResolvedValue(undefined);
    mockedFetchStatementFinancialRecords.mockResolvedValueOnce([
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
    ]);

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
