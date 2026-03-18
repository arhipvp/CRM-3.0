import type { FinancialRecord } from '../../types';
import type { FinancialRecordDraft } from '../forms/addPolicy/types';

const normalizeRecordAmount = (value?: string | null) => {
  const numeric = Number(value ?? '0');
  if (!Number.isFinite(numeric)) {
    return '0';
  }
  return String(Math.abs(numeric));
};

const toFinancialRecordDraft = (record: FinancialRecord): FinancialRecordDraft => ({
  id: record.id,
  amount: normalizeRecordAmount(record.amount),
  date: record.date ?? '',
  description: record.description ?? '',
  source: record.source ?? '',
  note: record.note ?? '',
});

const resolveFinancialRecordBucket = (record: FinancialRecord): 'income' | 'expense' => {
  if (record.recordType === 'Расход') {
    return 'expense';
  }
  if (record.recordType === 'Доход') {
    return 'income';
  }
  const amount = Number(record.amount ?? '0');
  return Number.isFinite(amount) && amount < 0 ? 'expense' : 'income';
};

export const splitFinancialRecords = (records: FinancialRecord[]) => {
  const incomes: FinancialRecordDraft[] = [];
  const expenses: FinancialRecordDraft[] = [];
  for (const record of records) {
    if (resolveFinancialRecordBucket(record) === 'income') {
      incomes.push(toFinancialRecordDraft(record));
    } else {
      expenses.push(toFinancialRecordDraft(record));
    }
  }
  return { incomes, expenses };
};
