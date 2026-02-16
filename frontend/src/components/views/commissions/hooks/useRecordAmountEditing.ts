import { useCallback, useState } from 'react';

import type { AddFinancialRecordFormValues } from '../../../forms/AddFinancialRecordForm';
import type { IncomeExpenseRow } from '../RecordsTable';

type AmountDraft = { mode: 'rub' | 'percent'; value: string };

interface UseRecordAmountEditingArgs {
  onUpdateFinancialRecord?: (
    recordId: string,
    values: AddFinancialRecordFormValues,
  ) => Promise<void>;
}

export const useRecordAmountEditing = ({ onUpdateFinancialRecord }: UseRecordAmountEditingArgs) => {
  const [amountDrafts, setAmountDrafts] = useState<Record<string, AmountDraft>>({});

  const getAbsoluteSaldoBase = useCallback((row: IncomeExpenseRow) => {
    const value = Number(row.paymentPaidBalance ?? 0);
    if (!Number.isFinite(value)) {
      return 0;
    }
    return Math.abs(value);
  }, []);

  const getPercentFromSaldo = useCallback(
    (row: IncomeExpenseRow, absoluteAmount: number) => {
      const base = getAbsoluteSaldoBase(row);
      if (!Number.isFinite(absoluteAmount) || base <= 0) {
        return '';
      }
      const percent = (Math.abs(absoluteAmount) / base) * 100;
      return percent.toFixed(2).replace(/\.?0+$/, '');
    },
    [getAbsoluteSaldoBase],
  );

  const handleRecordAmountChange = useCallback((recordId: string, value: string) => {
    setAmountDrafts((prev) => ({
      ...prev,
      [recordId]: { mode: prev[recordId]?.mode ?? 'rub', value },
    }));
  }, []);

  const toggleRecordAmountMode = useCallback(
    (row: IncomeExpenseRow) => {
      setAmountDrafts((prev) => {
        const current = prev[row.recordId];
        const currentMode: AmountDraft['mode'] = current?.mode ?? 'rub';
        const nextMode: AmountDraft['mode'] = currentMode === 'rub' ? 'percent' : 'rub';

        const base = getAbsoluteSaldoBase(row);
        const currentValue = current?.value;
        const currentNumber = currentValue !== undefined ? Number(currentValue) : NaN;

        if (nextMode === 'percent') {
          if (base <= 0) {
            return prev;
          }
          const absoluteAmount = Number.isFinite(currentNumber)
            ? currentNumber
            : Math.abs(row.recordAmount);
          return {
            ...prev,
            [row.recordId]: { mode: 'percent', value: getPercentFromSaldo(row, absoluteAmount) },
          };
        }

        if (currentMode === 'percent' && base > 0) {
          const percent = Number.isFinite(currentNumber) ? currentNumber : NaN;
          const absoluteAmount = Number.isFinite(percent) ? (base * percent) / 100 : NaN;
          if (Number.isFinite(absoluteAmount)) {
            return {
              ...prev,
              [row.recordId]: {
                mode: 'rub',
                value: absoluteAmount.toFixed(2).replace(/\.?0+$/, ''),
              },
            };
          }
        }

        return {
          ...prev,
          [row.recordId]: { mode: 'rub', value: Math.abs(row.recordAmount).toString() },
        };
      });
    },
    [getAbsoluteSaldoBase, getPercentFromSaldo],
  );

  const handleRecordAmountBlur = useCallback(
    async (row: IncomeExpenseRow) => {
      if (!onUpdateFinancialRecord) {
        return;
      }
      const draft = amountDrafts[row.recordId];
      if (!draft) {
        return;
      }
      const parsed = Number(draft.value);
      if (!Number.isFinite(parsed)) {
        return;
      }

      const absoluteAmount =
        draft.mode === 'percent'
          ? (() => {
              const base = getAbsoluteSaldoBase(row);
              if (base <= 0) {
                return NaN;
              }
              return (base * parsed) / 100;
            })()
          : parsed;

      if (!Number.isFinite(absoluteAmount)) {
        return;
      }
      const recordType: AddFinancialRecordFormValues['recordType'] =
        row.recordAmount >= 0 ? 'income' : 'expense';
      await onUpdateFinancialRecord(row.recordId, {
        paymentId: row.payment.id,
        recordType,
        amount: Math.abs(absoluteAmount).toString(),
        date: row.recordDate ?? null,
        description: row.recordDescription ?? '',
        source: row.recordSource ?? '',
        note: row.recordNote ?? '',
      });
      setAmountDrafts((prev) => {
        const next = { ...prev };
        delete next[row.recordId];
        return next;
      });
    },
    [amountDrafts, getAbsoluteSaldoBase, onUpdateFinancialRecord],
  );

  return {
    amountDrafts,
    getAbsoluteSaldoBase,
    getPercentFromSaldo,
    handleRecordAmountChange,
    toggleRecordAmountMode,
    handleRecordAmountBlur,
  };
};
