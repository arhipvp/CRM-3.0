import { parseNumericAmount } from '../../../utils/parseNumericAmount';
import type { PaymentDraft } from './types';
import type { PaymentDraftOrderEntry } from './paymentDraftOrdering';

export type PaymentIssueSeverity = 'error' | 'warning';
export type PaymentIssueField = 'amount' | 'description' | 'scheduledDate' | 'actualDate';

export interface PaymentIssue {
  severity: PaymentIssueSeverity;
  field: PaymentIssueField;
  message: string;
}

export type PaymentIssuesByIndex = Record<number, PaymentIssue[]>;

const parseDate = (value?: string | null) => {
  if (!value) {
    return null;
  }

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
};

const isBefore = (left?: string | null, right?: string | null) => {
  const leftDate = parseDate(left);
  const rightDate = parseDate(right);
  if (!leftDate || !rightDate) {
    return false;
  }

  return leftDate.getTime() < rightDate.getTime();
};

const isOutOfRange = (value: string | undefined, startDate?: string, endDate?: string) => {
  if (!value) {
    return false;
  }

  if (startDate && isBefore(value, startDate)) {
    return true;
  }

  if (endDate && isBefore(endDate, value)) {
    return true;
  }

  return false;
};

const isPastDueWithoutActualDate = (
  payment: PaymentDraft,
  todayDate: string,
  startDate?: string,
  endDate?: string,
) =>
  Boolean(
    payment.scheduledDate &&
    !payment.actualDate &&
    !isOutOfRange(payment.scheduledDate, startDate, endDate) &&
    !isBefore(todayDate, payment.scheduledDate),
  );

export const buildPaymentIssuesByIndex = ({
  paymentEntries,
  startDate,
  endDate,
  todayDate,
}: {
  paymentEntries: PaymentDraftOrderEntry[];
  startDate?: string;
  endDate?: string;
  todayDate: string;
}): PaymentIssuesByIndex => {
  const issuesByIndex: PaymentIssuesByIndex = {};
  const scheduledDateCounts = new Map<string, number>();

  paymentEntries.forEach(({ payment }) => {
    const scheduledDate = payment.scheduledDate?.trim();
    if (!scheduledDate) {
      return;
    }
    scheduledDateCounts.set(scheduledDate, (scheduledDateCounts.get(scheduledDate) ?? 0) + 1);
  });

  paymentEntries.forEach((entry) => {
    const { payment, sourceIndex } = entry;
    const issues: PaymentIssue[] = [];
    const amount = parseNumericAmount(payment.amount ?? '');
    const scheduledDate = payment.scheduledDate?.trim() ?? '';

    if (!Number.isFinite(amount) || amount <= 0) {
      issues.push({
        severity: 'error',
        field: 'amount',
        message: 'Укажите сумму больше нуля.',
      });
    }

    if (scheduledDate && isOutOfRange(scheduledDate, startDate, endDate)) {
      issues.push({
        severity: 'error',
        field: 'scheduledDate',
        message: 'Плановая дата должна попадать в срок действия полиса.',
      });
    }

    if (scheduledDate && (scheduledDateCounts.get(scheduledDate) ?? 0) > 1) {
      issues.push({
        severity: 'warning',
        field: 'scheduledDate',
        message: 'Эта плановая дата совпадает с другим платежом.',
      });
    }

    if (isPastDueWithoutActualDate(payment, todayDate, startDate, endDate)) {
      issues.push({
        severity: 'warning',
        field: 'actualDate',
        message: 'Плановая дата уже прошла, но фактическая дата не указана.',
      });
    }

    issuesByIndex[sourceIndex] = issues;
  });

  return issuesByIndex;
};

export const countPaymentIssues = (
  issuesByIndex: PaymentIssuesByIndex,
  severity: PaymentIssueSeverity,
) =>
  Object.values(issuesByIndex).reduce(
    (count, issues) => count + issues.filter((issue) => issue.severity === severity).length,
    0,
  );
