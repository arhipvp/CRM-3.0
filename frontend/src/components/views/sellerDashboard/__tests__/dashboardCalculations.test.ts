import { describe, expect, it } from 'vitest';

import {
  buildCalendarDays,
  buildDateRange,
  buildExecutorSeries,
  buildFinancialMatrix,
  buildPaymentsSeries,
} from '../dashboardCalculations';

describe('dashboard calculations', () => {
  it('builds deterministic date, payment and calendar ranges', () => {
    expect(buildDateRange('2025-01-01', '2025-01-03')).toEqual([
      '2025-01-01',
      '2025-01-02',
      '2025-01-03',
    ]);
    expect(
      buildPaymentsSeries('2025-01-01', '2025-01-03', [{ date: '2025-01-02', total: '1200.50' }]),
    ).toEqual([
      { date: '2025-01-01', value: 0 },
      { date: '2025-01-02', value: 1200.5 },
      { date: '2025-01-03', value: 0 },
    ]);
    const calendar = buildCalendarDays(
      '2025-01-01',
      '2025-01-03',
      new Map([['2025-01-02', 2]]),
      new Map([['2025-01-03', 1]]),
    );
    expect(calendar).toHaveLength(7);
    expect(calendar.find((day) => day.date === '2025-01-02')).toMatchObject({
      policyExpirations: 2,
      nextContacts: 0,
      isInRange: true,
    });
  });

  it('groups executor task series and fills missing days', () => {
    const result = buildExecutorSeries('2025-01-01', '2025-01-02', [
      { date: '2025-01-02', executorId: 'u1', executorName: 'Иван', count: 3 },
    ]);
    expect(result.executors[0]).toMatchObject({ id: 'u1', name: 'Иван' });
    expect(result.data).toEqual([
      { date: '2025-01-01', totals: { u1: 0 } },
      { date: '2025-01-02', totals: { u1: 3 } },
    ]);
  });

  it('builds, filters and sorts the financial matrix', () => {
    const rows = [
      {
        insuranceCompanyId: 'c1',
        insuranceCompanyName: 'Альфа',
        insuranceCompanyLogoUrl: 'https://cdn.example.test/alfa.svg',
        insuranceTypeId: 't1',
        insuranceTypeName: 'КАСКО',
        incomeTotal: '100',
        expenseTotal: '25',
        netTotal: '75',
        recordsCount: 2,
      },
      {
        insuranceCompanyId: 'c2',
        insuranceCompanyName: 'Бета',
        insuranceTypeId: 't1',
        insuranceTypeName: 'КАСКО',
        incomeTotal: '50',
        expenseTotal: '10',
        netTotal: '40',
        recordsCount: 1,
      },
    ];
    const matrix = buildFinancialMatrix(rows, '', false, false, 'net_desc');
    expect(matrix.rows.map((row) => row.companyName)).toEqual(['Альфа', 'Бета']);
    expect(matrix.rows[0].companyLogoUrl).toBe('https://cdn.example.test/alfa.svg');
    expect(matrix.topCompanies[0].companyLogoUrl).toBe('https://cdn.example.test/alfa.svg');
    expect(matrix.maxExpensePair?.companyLogoUrl).toBe('https://cdn.example.test/alfa.svg');
    expect(matrix.grandTotals).toMatchObject({ income: 150, expense: 35, net: 115, count: 3 });
    expect(buildFinancialMatrix(rows, 'бета', false, true, 'alpha').rows).toHaveLength(1);
  });
});
