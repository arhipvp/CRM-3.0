import { buildCommissionIncomeNote } from '../../../utils/financialRecordNotes';
import { createEmptyRecord, type FinancialRecordDraft, type PaymentDraft } from './types';

export const PKV_INCOME_NOTE = 'Доход от Гриша. Сбер. ПКВ';
const normalizeName = (name?: string | null) => (name ?? '').trim().toLowerCase();
export const skipsAutomaticFinances = (channel?: string | null) =>
  normalizeName(channel) === 'чужой полис';
export const needsPkvPayment = (channel?: string | null, insuranceType?: string | null) =>
  normalizeName(channel) === 'гриша. сбер' && normalizeName(insuranceType) === 'осаго';

export const buildDefaultPaymentExpenses = (
  counterparty?: string,
  executorName?: string | null,
): FinancialRecordDraft[] => {
  const notes = [
    counterparty?.trim() ? `Расход контрагенту ${counterparty.trim()}` : '',
    executorName?.trim() ? `Расход исполнителю ${executorName.trim()}` : '',
  ].filter(Boolean);
  return notes.map((note) => ({ ...createEmptyRecord('1', note), autoDefault: true }));
};

interface FinanceContext {
  channel?: string;
  insuranceType?: string;
  counterparty?: string;
  executorName?: string | null;
}

// Transient autoDefault markers never leave the form; editing any field clears them.
export const applyFinanceDefaults = (
  payments: PaymentDraft[],
  context: FinanceContext,
  previous?: FinanceContext,
): PaymentDraft[] => {
  const skip = skipsAutomaticFinances(context.channel);
  const pkv = needsPkvPayment(context.channel, context.insuranceType);
  const wasSkipped = previous && skipsAutomaticFinances(previous.channel);
  const result = payments.flatMap((payment): PaymentDraft[] => {
    if (payment.kind === 'pkv') {
      const untouched =
        payment.autoDefault &&
        [...payment.incomes, ...payment.expenses].every((record) => record.autoDefault);
      return !pkv && untouched ? [] : [payment];
    }
    const incomes = payment.incomes.flatMap((record) => {
      if (!record.autoDefault) return [record];
      return skip ? [] : [{ ...record, note: buildCommissionIncomeNote(context.channel) }];
    });
    if (!skip && wasSkipped && !incomes.length) {
      incomes.push({
        ...createEmptyRecord('0', buildCommissionIncomeNote(context.channel)),
        autoDefault: true,
      });
    }
    const expenses = skip
      ? payment.expenses.filter((record) => !record.autoDefault)
      : [...payment.expenses];
    if (!skip && (!previous || wasSkipped) && !expenses.length) {
      expenses.push(...buildDefaultPaymentExpenses(context.counterparty, context.executorName));
    }
    return [{ ...payment, kind: payment.kind ?? 'premium', incomes, expenses }];
  });
  if (pkv && !result.some((payment) => payment.kind === 'pkv')) {
    const primary = result.find((payment) => payment.kind !== 'pkv');
    if (primary)
      result.push({
        kind: 'pkv',
        autoDefault: true,
        autoScheduledDate: true,
        amount: '0',
        description: 'ПКВ',
        scheduledDate: primary.scheduledDate ?? '',
        actualDate: '',
        incomes: [{ ...createEmptyRecord('0', PKV_INCOME_NOTE), autoDefault: true }],
        expenses: context.executorName?.trim()
          ? [
              {
                ...createEmptyRecord(
                  '1',
                  `Расход исполнителю ${context.executorName.trim()} от ПКВ`,
                ),
                autoDefault: true,
              },
            ]
          : [],
      });
  }
  return result;
};
