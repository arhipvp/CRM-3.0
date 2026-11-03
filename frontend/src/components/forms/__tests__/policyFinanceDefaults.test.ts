import { describe, expect, it } from 'vitest';
import { applyFinanceDefaults, needsPkvPayment } from '../addPolicy/financeDefaults';
import { createPaymentWithDefaultIncome } from '../addPolicy/types';
import { buildPaymentIssuesByIndex } from '../addPolicy/paymentIssues';

describe('policy finance defaults', () => {
  it('removes only automatic records for a foreign policy and preserves manual records', () => {
    const original = createPaymentWithDefaultIncome('Комиссионное вознаграждение');
    original.incomes.push({ amount: '200', note: 'Ручной доход' });
    original.expenses.push({ amount: '35', note: 'Ручной расход' });
    const [payment] = applyFinanceDefaults([original], { channel: ' ЧУЖОЙ ПОЛИС ' });
    expect(payment.incomes).toEqual([{ amount: '200', note: 'Ручной доход' }]);
    expect(payment.expenses).toEqual([{ amount: '35', note: 'Ручной расход' }]);
    expect(original.incomes).toHaveLength(2);
  });

  it('adds exactly one PKV with its own executor expense, without a counterparty expense', () => {
    const context = {
      channel: ' ГРИША. СБЕР ',
      insuranceType: ' ОСАГО ',
      counterparty: 'Партнёр',
      executorName: 'Иван',
    };
    const payments = applyFinanceDefaults(
      [{ ...createPaymentWithDefaultIncome(), amount: '10000', scheduledDate: '2026-11-03' }],
      context,
    );
    const pkv = payments[1];
    expect(pkv).toMatchObject({
      kind: 'pkv',
      amount: '0',
      scheduledDate: '2026-11-03',
      actualDate: '',
    });
    expect(pkv.incomes.map((record) => record.note)).toEqual(['Доход от Гриша. Сбер. ПКВ']);
    expect(pkv.expenses.map((record) => record.note)).toEqual(['Расход исполнителю Иван от ПКВ']);
    expect(
      applyFinanceDefaults(payments, context, context).filter((payment) => payment.kind === 'pkv'),
    ).toHaveLength(1);
    expect(needsPkvPayment(context.channel, 'КАСКО')).toBe(false);
  });

  it('removes untouched PKV when the condition changes, preserving changed PKV records', () => {
    const context = { channel: 'Гриша. Сбер', insuranceType: 'ОСАГО' };
    const payments = applyFinanceDefaults([createPaymentWithDefaultIncome()], context);
    expect(applyFinanceDefaults(payments, { channel: 'Другой' }, context)).toHaveLength(1);
    payments[1].incomes[0] = { ...payments[1].incomes[0], amount: '1200', autoDefault: false };
    expect(
      applyFinanceDefaults(payments, { channel: 'Чужой полис' }, context)[1].incomes[0].amount,
    ).toBe('1200');
  });

  it('accepts a zero PKV without premium schedule warnings and rejects a zero premium', () => {
    const payment = {
      ...createPaymentWithDefaultIncome(),
      amount: '0',
      scheduledDate: '2020-01-01',
    };
    const issues = buildPaymentIssuesByIndex({
      paymentEntries: [
        { payment, sourceIndex: 0 },
        { payment: { ...payment, kind: 'pkv' }, sourceIndex: 1 },
      ],
      todayDate: '2026-11-03',
      startDate: '2026-01-01',
    });
    expect(issues[0].some((issue) => issue.field === 'amount')).toBe(true);
    expect(issues[1]).toEqual([]);
  });
});
