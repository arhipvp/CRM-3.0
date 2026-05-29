import type { AddFinancialRecordFormValues } from '../../components/forms/AddFinancialRecordForm';
import type { FinancialRecord, Payment, Statement } from '../../types';
import { parseAmountValue } from '../../utils/appContent';

export const normalizeFinancialRecordAmount = (values: AddFinancialRecordFormValues) => {
  const parsedAmount = parseFloat(values.amount);
  if (!Number.isFinite(parsedAmount)) {
    return parsedAmount;
  }
  return values.recordType === 'expense' ? -Math.abs(parsedAmount) : Math.abs(parsedAmount);
};

export const applyStatementAggregates = (
  items: Statement[],
  records: FinancialRecord[],
): Statement[] => {
  const aggregates = new Map<string, { count: number; total: number }>();

  for (const record of records) {
    if (record.deletedAt) {
      continue;
    }
    const statementId = record.statementId ?? null;
    if (!statementId) {
      continue;
    }
    const amount = parseAmountValue(record.amount);
    const current = aggregates.get(statementId) ?? { count: 0, total: 0 };
    current.count += 1;
    current.total += Number.isFinite(amount) ? amount : 0;
    aggregates.set(statementId, current);
  }

  return items.map((statement) => {
    const aggregate = aggregates.get(statement.id) ?? { count: 0, total: 0 };
    return {
      ...statement,
      recordsCount: aggregate.count,
      totalAmount: aggregate.total.toFixed(2),
    };
  });
};

export const mergeFinancialRecords = (
  currentRecords: FinancialRecord[],
  incomingRecords: FinancialRecord[],
): FinancialRecord[] => {
  if (!incomingRecords.length) {
    return currentRecords;
  }
  const incomingById = new Map(incomingRecords.map((record) => [record.id, record]));
  const existingIds = new Set(currentRecords.map((record) => record.id));
  const merged = currentRecords.map((record) => incomingById.get(record.id) ?? record);
  incomingRecords.forEach((record) => {
    if (!existingIds.has(record.id)) {
      merged.push(record);
    }
  });
  return merged;
};

export const mergePaymentFinancialRecords = (
  payments: Payment[],
  incomingRecords: FinancialRecord[],
): Payment[] => {
  if (!incomingRecords.length) {
    return payments;
  }
  const incomingById = new Map(incomingRecords.map((record) => [record.id, record]));
  const incomingByPaymentId = new Map<string, FinancialRecord[]>();
  incomingRecords.forEach((record) => {
    const records = incomingByPaymentId.get(record.paymentId) ?? [];
    records.push(record);
    incomingByPaymentId.set(record.paymentId, records);
  });
  return payments.map((payment) => {
    const paymentIncoming = incomingByPaymentId.get(payment.id) ?? [];
    if (!paymentIncoming.length) {
      return payment;
    }
    const currentRecords = payment.financialRecords ?? [];
    const existingIds = new Set(currentRecords.map((record) => record.id));
    const financialRecords = currentRecords.map((record) => incomingById.get(record.id) ?? record);
    paymentIncoming.forEach((record) => {
      if (!existingIds.has(record.id)) {
        financialRecords.push(record);
      }
    });
    return { ...payment, financialRecords };
  });
};
