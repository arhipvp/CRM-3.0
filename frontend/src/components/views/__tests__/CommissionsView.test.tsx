import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  fetchFinancialRecordsWithPagination,
  fetchPolicy,
  fetchStatementFinancialRecordsWithPagination,
} from '../../../api';
import { NotificationProvider } from '../../../contexts/NotificationProvider';
import type { FinancialRecord, Policy } from '../../../types';
import { CommissionsView } from '../CommissionsView';

vi.mock('../../../api', async () => {
  const actual = await vi.importActual<typeof import('../../../api')>('../../../api');
  return {
    ...actual,
    fetchStatementFinancialRecordsWithPagination: vi.fn(),
    fetchFinancialRecordsWithPagination: vi.fn(),
    fetchPolicy: vi.fn(),
  };
});

const mockedFetchStatementFinancialRecords = vi.mocked(
  fetchStatementFinancialRecordsWithPagination,
);
const mockedFetchFinancialRecordsWithPagination = vi.mocked(fetchFinancialRecordsWithPagination);
const mockedFetchPolicy = vi.mocked(fetchPolicy);

const buildPolicy = (overrides: Partial<Policy> = {}): Policy => ({
  id: 'policy-1',
  number: 'SYS123456',
  insuranceCompanyId: 'company-1',
  insuranceCompany: 'Страховая',
  insuranceTypeId: 'type-1',
  insuranceType: 'ОСАГО',
  dealId: 'deal-1',
  isVehicle: false,
  status: 'active',
  createdAt: '2026-03-06T10:00:00Z',
  ...overrides,
});

const buildFinancialRecord = (overrides: Partial<FinancialRecord> = {}): FinancialRecord => ({
  id: 'record-policy-1',
  paymentId: 'payment-policy-1',
  paymentAmount: '10000',
  paymentScheduledDate: '2026-03-15',
  dealTitle: 'Сделка с полисом',
  dealClientName: 'Клиент полиса',
  policyId: 'policy-1',
  policyNumber: 'SYS123456',
  policyClientName: 'Клиент полиса',
  paymentPaidBalance: '0',
  amount: '1000',
  date: '2026-03-15',
  recordType: 'Доход',
  createdAt: '2026-03-06T10:00:00Z',
  updatedAt: '2026-03-06T10:00:00Z',
  ...overrides,
});

beforeEach(() => {
  vi.resetAllMocks();
  mockedFetchStatementFinancialRecords.mockResolvedValue({
    count: 0,
    next: null,
    previous: null,
    results: [],
  });
  mockedFetchFinancialRecordsWithPagination.mockResolvedValue({
    count: 0,
    next: null,
    previous: null,
    results: [],
  });
  mockedFetchPolicy.mockResolvedValue(buildPolicy());
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
            salesChannels={[]}
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
    mockedFetchStatementFinancialRecords.mockResolvedValueOnce({
      count: 1,
      next: null,
      previous: null,
      results: [
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
      ],
    });

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
            salesChannels={[]}
            hasCommissionsSnapshotLoaded
          />
        </NotificationProvider>
      </MemoryRouter>,
    );

    expect(await screen.findAllByText('Клиент А')).toHaveLength(2);
    expect(mockedFetchStatementFinancialRecords).toHaveBeenCalledWith(
      'statement-1',
      expect.objectContaining({ page: 1, page_size: 100 }),
      expect.any(Object),
    );
    expect(mockedFetchFinancialRecordsWithPagination).not.toHaveBeenCalled();
  });

  it('hides remove bulk action until records are selected', async () => {
    render(
      <MemoryRouter>
        <NotificationProvider>
          <CommissionsView
            payments={[]}
            policies={[]}
            statements={[
              {
                id: 'statement-1',
                name: 'Пустая ведомость',
                statementType: 'expense',
                status: 'draft',
                totalAmount: '0',
                recordsCount: 0,
                createdAt: '2026-03-06T10:00:00Z',
                updatedAt: '2026-03-06T10:00:00Z',
              },
            ]}
            salesChannels={[]}
            hasCommissionsSnapshotLoaded
          />
        </NotificationProvider>
      </MemoryRouter>,
    );

    expect(await screen.findAllByText('Записей в ведомости пока нет')).toHaveLength(2);
    expect(screen.queryByRole('button', { name: 'Убрать из ведомости' })).not.toBeInTheDocument();
  });

  it('shows statement amount controls and keeps amount sorting stable when toggling percent mode', async () => {
    const user = userEvent.setup();
    const onUpdateFinancialRecord = vi.fn().mockResolvedValue(undefined);
    const onApplyStatementAmount = vi.fn().mockResolvedValue({
      updated: 2,
      unchanged: 0,
      skipped: 0,
      skippedReasons: {},
      records: [],
      statement: {
        id: 'statement-1',
        name: 'Алиса',
        statementType: 'expense',
        status: 'draft',
        totalAmount: '300',
        recordsCount: 2,
        createdAt: '2026-03-06T10:00:00Z',
        updatedAt: '2026-03-06T10:00:00Z',
      },
    });
    mockedFetchStatementFinancialRecords.mockResolvedValueOnce({
      count: 2,
      next: null,
      previous: null,
      results: [
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
      ],
    });

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
            salesChannels={[]}
            hasCommissionsSnapshotLoaded
            onUpdateFinancialRecord={onUpdateFinancialRecord}
            onApplyStatementAmount={onApplyStatementAmount}
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

    expect(onUpdateFinancialRecord).not.toHaveBeenCalled();
    expect(onApplyStatementAmount).toHaveBeenCalledTimes(1);
    expect(onApplyStatementAmount).toHaveBeenCalledWith('statement-1', {
      mode: 'percent',
      value: '10',
    });
  }, 10000);

  it('opens policy edit modal from all records using a policy already in local state', async () => {
    const user = userEvent.setup();
    const policy = buildPolicy();
    const onRequestEditPolicy = vi.fn();
    mockedFetchFinancialRecordsWithPagination.mockResolvedValueOnce({
      count: 1,
      next: null,
      previous: null,
      results: [buildFinancialRecord()],
    });

    render(
      <MemoryRouter>
        <NotificationProvider>
          <CommissionsView
            payments={[]}
            policies={[policy]}
            statements={[]}
            salesChannels={[]}
            hasCommissionsSnapshotLoaded
            onRequestEditPolicy={onRequestEditPolicy}
          />
        </NotificationProvider>
      </MemoryRouter>,
    );

    await user.click(screen.getByRole('tab', { name: 'Все финансовые записи' }));
    await user.click(await screen.findByRole('button', { name: 'Редактировать полис SYS123456' }));

    expect(mockedFetchPolicy).not.toHaveBeenCalled();
    expect(onRequestEditPolicy).toHaveBeenCalledWith(policy);
  });

  it('fetches policy before opening edit modal when it is missing from local state', async () => {
    const user = userEvent.setup();
    const fetchedPolicy = buildPolicy({ id: 'policy-2', number: 'SYS654321' });
    const onRequestEditPolicy = vi.fn();
    mockedFetchFinancialRecordsWithPagination.mockResolvedValueOnce({
      count: 1,
      next: null,
      previous: null,
      results: [
        buildFinancialRecord({
          policyId: 'policy-2',
          policyNumber: 'SYS654321',
        }),
      ],
    });
    mockedFetchPolicy.mockResolvedValueOnce(fetchedPolicy);

    render(
      <MemoryRouter>
        <NotificationProvider>
          <CommissionsView
            payments={[]}
            policies={[]}
            statements={[]}
            salesChannels={[]}
            hasCommissionsSnapshotLoaded
            onRequestEditPolicy={onRequestEditPolicy}
          />
        </NotificationProvider>
      </MemoryRouter>,
    );

    await user.click(screen.getByRole('tab', { name: 'Все финансовые записи' }));
    await user.click(await screen.findByRole('button', { name: 'Редактировать полис SYS654321' }));

    expect(mockedFetchPolicy).toHaveBeenCalledWith('policy-2');
    expect(onRequestEditPolicy).toHaveBeenCalledWith(fetchedPolicy);
  });
}, 20000);
