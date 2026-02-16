import { useCallback, useMemo, useState } from 'react';

import type { FinancialRecord, Payment } from '../../../../types';
import type { IncomeExpenseRow } from '../RecordsTable';

interface UseCommissionsRowsArgs {
  payments: Payment[];
  allRecords: FinancialRecord[];
  paymentsById: Map<string, Payment>;
  selectedStatementId: string | null;
  viewMode: 'all' | 'statements';
}

export const useCommissionsRows = ({
  payments,
  allRecords,
  paymentsById,
  selectedStatementId,
  viewMode,
}: UseCommissionsRowsArgs) => {
  const [recordAmountSort, setRecordAmountSort] = useState<'none' | 'asc' | 'desc'>('none');

  const statementRows = useMemo<IncomeExpenseRow[]>(() => {
    const result: IncomeExpenseRow[] = [];
    payments.forEach((payment) => {
      const records = payment.financialRecords ?? [];
      const paidEntries = records
        .filter((record) => Boolean(record.date))
        .map((record) => ({
          amount: record.amount,
          date: record.date as string,
        }));
      const paidBalance = paidEntries.reduce((sum, entry) => {
        const value = Number(entry.amount);
        return Number.isFinite(value) ? sum + value : sum;
      }, 0);
      const paymentPaidBalance = Number.isFinite(paidBalance) ? paidBalance : undefined;

      records.forEach((record) => {
        const amount = Number(record.amount);
        if (!Number.isFinite(amount) || amount === 0) {
          return;
        }
        result.push({
          key: `${payment.id}-${record.id}`,
          payment,
          recordId: record.id,
          statementId: record.statementId,
          recordAmount: amount,
          paymentPaidBalance,
          paymentPaidEntries: paidEntries,
          recordDate: record.date ?? null,
          recordDescription: record.description,
          recordSource: record.source,
          recordNote: record.note,
        });
      });
    });
    return result;
  }, [payments]);

  const allRows = useMemo<IncomeExpenseRow[]>(() => {
    const result: IncomeExpenseRow[] = [];
    allRecords.forEach((record) => {
      const payment = paymentsById.get(record.paymentId);
      if (!payment) {
        return;
      }
      const amount = Number(record.amount);
      if (!Number.isFinite(amount) || amount === 0) {
        return;
      }
      const paidBalanceValue = record.paymentPaidBalance;
      const paidBalance = paidBalanceValue ? Number(paidBalanceValue) : undefined;
      const paidEntries =
        record.paymentPaidEntries?.map((entry) => ({
          amount: entry.amount,
          date: entry.date,
        })) ?? [];
      result.push({
        key: `${payment.id}-${record.id}`,
        payment,
        recordId: record.id,
        statementId: record.statementId,
        recordAmount: amount,
        paymentPaidBalance: Number.isFinite(paidBalance) ? paidBalance : undefined,
        paymentPaidEntries: paidEntries,
        recordDate: record.date ?? null,
        recordDescription: record.description,
        recordSource: record.source,
        recordNote: record.note,
      });
    });
    return result;
  }, [allRecords, paymentsById]);

  const filteredRows = useMemo(() => {
    // В режиме "Все записи" сортировка и пагинация должны соответствовать серверу.
    // Любая клиентская сортировка ломает порядок (особенно при "Показать ещё").
    if (viewMode === 'all') {
      return [...allRows];
    }

    if (!selectedStatementId) {
      return [];
    }

    const result = statementRows.filter((row) => row.statementId === selectedStatementId);
    const compareByDate = (a: IncomeExpenseRow, b: IncomeExpenseRow) => {
      const aTime = a.recordDate ? new Date(a.recordDate).getTime() : 0;
      const bTime = b.recordDate ? new Date(b.recordDate).getTime() : 0;
      return bTime - aTime;
    };

    if (recordAmountSort !== 'none') {
      result.sort((a, b) => {
        const aAmount = Number(a.recordAmount) || 0;
        const bAmount = Number(b.recordAmount) || 0;
        if (aAmount === bAmount) {
          return compareByDate(a, b);
        }
        return recordAmountSort === 'asc' ? aAmount - bAmount : bAmount - aAmount;
      });
    } else {
      result.sort(compareByDate);
    }
    return result;
  }, [allRows, recordAmountSort, selectedStatementId, statementRows, viewMode]);

  const toggleAmountSort = useCallback(() => {
    setRecordAmountSort((prev) => {
      if (prev === 'none') {
        return 'asc';
      }
      if (prev === 'asc') {
        return 'desc';
      }
      return 'none';
    });
  }, []);

  const getAmountSortIndicator = useCallback(() => {
    if (recordAmountSort === 'asc') {
      return '↑';
    }
    if (recordAmountSort === 'desc') {
      return '↓';
    }
    return '↕';
  }, [recordAmountSort]);

  const getAmountSortLabel = useCallback(() => {
    if (recordAmountSort === 'asc') {
      return 'по возрастанию';
    }
    if (recordAmountSort === 'desc') {
      return 'по убыванию';
    }
    return 'не сортируется';
  }, [recordAmountSort]);

  return {
    filteredRows,
    toggleAmountSort,
    getAmountSortIndicator,
    getAmountSortLabel,
  };
};
