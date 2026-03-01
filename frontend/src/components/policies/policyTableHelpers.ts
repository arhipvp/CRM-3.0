import type { FinancialRecord, Payment } from '../../types';
import { formatCurrency, formatDate } from '../views/dealsView/helpers';

export const POLICY_STATUS_TONE_CLASS: Record<'red' | 'orange' | 'green', string> = {
  red: 'bg-red-100 text-red-700',
  orange: 'bg-orange-100 text-orange-700',
  green: 'bg-emerald-100 text-emerald-700',
};

export const POLICY_LEDGER_STATE_CLASS: Record<'paid' | 'unpaid', string> = {
  paid: 'bg-emerald-50 text-emerald-800 border border-emerald-100',
  unpaid: 'bg-rose-50 text-rose-800 border border-rose-100',
};

export const getPolicyExpiryToneClass = (tone: 'red' | 'orange') =>
  tone === 'red' ? 'bg-red-100 text-red-700' : 'bg-orange-100 text-orange-700';

export const getPolicyNotePreview = (note?: string | null) => {
  const normalized = note?.trim() ?? '';
  if (!normalized) {
    return {
      preview: 'Без примечания',
      fullText: 'Без примечания',
    };
  }

  return {
    preview: normalized,
    fullText: normalized,
  };
};

const getDateSortWeight = (date?: string | null) => {
  if (!date) {
    return Number.POSITIVE_INFINITY;
  }
  const timestamp = new Date(date).getTime();
  return Number.isNaN(timestamp) ? Number.POSITIVE_INFINITY : timestamp;
};

export const sortPaymentsForLedger = (payments: Payment[]) =>
  [...payments].sort((left, right) => {
    const leftWeight = getDateSortWeight(left.actualDate);
    const rightWeight = getDateSortWeight(right.actualDate);
    if (leftWeight !== rightWeight) {
      return leftWeight - rightWeight;
    }
    return left.id.localeCompare(right.id);
  });

export const sortFinancialRecordsForLedger = (records: FinancialRecord[]) =>
  [...records].sort((left, right) => {
    const leftWeight = getDateSortWeight(left.date);
    const rightWeight = getDateSortWeight(right.date);
    if (leftWeight !== rightWeight) {
      return leftWeight - rightWeight;
    }
    return left.id.localeCompare(right.id);
  });

export const getPaymentLedgerState = (payment: Payment): 'paid' | 'unpaid' =>
  payment.actualDate ? 'paid' : 'unpaid';

export const getRecordLedgerState = (record: FinancialRecord): 'paid' | 'unpaid' =>
  record.date ? 'paid' : 'unpaid';

export const formatPaymentLedgerLine = (payment: Payment) => {
  const dateText = payment.actualDate ? formatDate(payment.actualDate) : 'без даты оплаты';
  const amountText = formatCurrency(payment.amount);
  return {
    dateText,
    amountText,
    text: `${dateText} — ${amountText}`,
  };
};

export const formatRecordLedgerLine = (record: FinancialRecord, fallbackText: string) => {
  const dateText = record.date ? formatDate(record.date) : 'без даты выплаты';
  const amountValue = Math.abs(Number(record.amount) || 0).toString();
  const sign = record.recordType === 'Расход' ? '-' : '+';
  const amountText = `${sign}${formatCurrency(amountValue)}`;
  const comment = (record.note ?? '').trim() || fallbackText || 'Без комментария';
  return {
    dateText,
    amountText,
    comment,
    text: `${dateText} — ${amountText} (${comment})`,
  };
};
