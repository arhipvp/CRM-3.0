import { render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { SellerDashboardView } from '../SellerDashboardView';

vi.mock('../../../api/policies', () => ({
  fetchSellerDashboard: vi.fn(),
}));

import { fetchSellerDashboard } from '../../../api/policies';

const mockedFetchSellerDashboard = vi.mocked(fetchSellerDashboard);

const createDashboardPayload = () => ({
  rangeStart: '2025-01-01',
  rangeEnd: '2025-01-31',
  totalPaid: '120000',
  tasksCurrent: 5,
  tasksCompleted: 11,
  paymentsByDay: [{ date: '2025-01-05', total: '10000' }],
  tasksCompletedByDay: [{ date: '2025-01-05', count: 3 }],
  tasksCompletedByExecutor: [
    { date: '2025-01-05', executorId: 'u1', executorName: 'Иван', count: 2 },
  ],
  policyExpirationsByDay: [{ date: '2025-01-10', count: 1 }],
  nextContactsByDay: [{ date: '2025-01-11', count: 1 }],
  financialTotals: {
    incomeTotal: '50000',
    expenseTotal: '12000',
    netTotal: '38000',
    recordsCount: 4,
  },
  financialByCompanyType: [
    {
      insuranceCompanyId: 'ic-1',
      insuranceCompanyName: 'РЕСО',
      insuranceTypeId: 'it-1',
      insuranceTypeName: 'КАСКО',
      incomeTotal: '50000',
      expenseTotal: '12000',
      netTotal: '38000',
      recordsCount: 4,
    },
  ],
  policies: [
    {
      id: 'p-1',
      number: '123',
      insuranceCompany: 'РЕСО',
      insuranceType: 'КАСКО',
      clientName: 'Иван Иванов',
      insuredClientName: 'Иван Иванов',
      startDate: '2025-01-02',
      paidAmount: '120000',
    },
  ],
});

describe('SellerDashboardView', () => {
  beforeEach(() => {
    mockedFetchSellerDashboard.mockReset();
  });

  it('renders loading state before data', async () => {
    mockedFetchSellerDashboard.mockImplementation(
      () =>
        new Promise((resolve) => {
          setTimeout(() => resolve(createDashboardPayload()), 30);
        }),
    );

    render(<SellerDashboardView />);

    expect(screen.getAllByText('Загрузка данных...').length).toBeGreaterThan(0);
    expect(await screen.findByText('Продажи по дате начала полиса')).toBeInTheDocument();
  });

  it('renders error state on failed request', async () => {
    mockedFetchSellerDashboard.mockRejectedValueOnce(new Error('Network error'));

    render(<SellerDashboardView />);

    await waitFor(() => {
      expect(screen.getByText('Network error')).toBeInTheDocument();
    });
  });

  it('renders empty policies message when no policies in range', async () => {
    mockedFetchSellerDashboard.mockResolvedValueOnce({
      ...createDashboardPayload(),
      policies: [],
      financialByCompanyType: [],
      paymentsByDay: [],
      tasksCompletedByExecutor: [],
    });

    render(<SellerDashboardView />);

    expect(await screen.findByText('Полисы выбранного периода')).toBeInTheDocument();
    expect(
      screen.getByText('В этом периоде у вас нет полисов с началом в выбранном диапазоне.'),
    ).toBeInTheDocument();
  });
});
