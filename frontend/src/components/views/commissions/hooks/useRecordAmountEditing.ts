import { useCallback, useState } from 'react';

import type { AddFinancialRecordFormValues } from '../../../forms/AddFinancialRecordForm';
import type { IncomeExpenseRow } from '../RecordsTable';

type AmountDraft = { mode: 'rub' | 'percent'; value: string };

interface UseRecordAmountEditingArgs {
  onUpdateFinancialRecord?: (
    recordId: string,
    values: AddFinancialRecordFormValues,
  ) => Promise<void>;
  isRowAmountLocked?: (row: IncomeExpenseRow) => boolean;
}

const normalizeAbsoluteAmount = (value: number) => value.toFixed(2).replace(/\.?0+$/, '');

export const useRecordAmountEditing = ({
  onUpdateFinancialRecord,
  isRowAmountLocked,
}: UseRecordAmountEditingArgs) => {
  const [amountDrafts, setAmountDrafts] = useState<Record<string, AmountDraft>>({});
  const [statementAmountDraft, setStatementAmountDraft] = useState<AmountDraft>({
    mode: 'rub',
    value: '',
  });
  const [isApplyingStatementAmount, setIsApplyingStatementAmount] = useState(false);

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

  const getAbsoluteAmountFromDraft = useCallback(
    (row: IncomeExpenseRow, draft: AmountDraft) => {
      const parsed = Number(draft.value);
      if (!Number.isFinite(parsed)) {
        return null;
      }
      if (draft.mode === 'rub') {
        return Math.abs(parsed);
      }
      const base = getAbsoluteSaldoBase(row);
      if (base <= 0) {
        return null;
      }
      return Math.abs((base * parsed) / 100);
    },
    [getAbsoluteSaldoBase],
  );

  const buildRecordUpdateValues = useCallback(
    (row: IncomeExpenseRow, absoluteAmount: number): AddFinancialRecordFormValues => {
      const recordType: AddFinancialRecordFormValues['recordType'] =
        row.recordAmount >= 0 ? 'income' : 'expense';

      return {
        paymentId: row.payment.id,
        recordType,
        amount: normalizeAbsoluteAmount(absoluteAmount),
        date: row.recordDate ?? null,
        description: row.recordDescription ?? '',
        source: row.recordSource ?? '',
        note: row.recordNote ?? '',
      };
    },
    [],
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
                value: normalizeAbsoluteAmount(absoluteAmount),
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
      if (isRowAmountLocked?.(row)) {
        return;
      }
      const draft = amountDrafts[row.recordId];
      if (!draft) {
        return;
      }
      const absoluteAmount = getAbsoluteAmountFromDraft(row, draft);
      if (absoluteAmount === null) {
        return;
      }
      await onUpdateFinancialRecord(
        row.recordId,
        buildRecordUpdateValues(row, Math.abs(absoluteAmount)),
      );
      setAmountDrafts((prev) => {
        const next = { ...prev };
        delete next[row.recordId];
        return next;
      });
    },
    [
      amountDrafts,
      buildRecordUpdateValues,
      getAbsoluteAmountFromDraft,
      isRowAmountLocked,
      onUpdateFinancialRecord,
    ],
  );

  const handleStatementAmountChange = useCallback((value: string) => {
    setStatementAmountDraft((prev) => ({ ...prev, value }));
  }, []);

  const toggleStatementAmountMode = useCallback(() => {
    setStatementAmountDraft((prev) => ({
      mode: prev.mode === 'rub' ? 'percent' : 'rub',
      value: prev.value,
    }));
  }, []);

  const applyStatementAmountToRows = useCallback(
    async (rows: IncomeExpenseRow[]) => {
      if (!onUpdateFinancialRecord || isApplyingStatementAmount) {
        return;
      }
      const candidates = rows.filter((row) => !isRowAmountLocked?.(row));
      if (!candidates.length) {
        return;
      }

      const updates = candidates
        .map((row) => {
          const absoluteAmount = getAbsoluteAmountFromDraft(row, statementAmountDraft);
          if (absoluteAmount === null) {
            return null;
          }
          return {
            row,
            values: buildRecordUpdateValues(row, absoluteAmount),
          };
        })
        .filter((item): item is { row: IncomeExpenseRow; values: AddFinancialRecordFormValues } =>
          Boolean(item),
        );

      if (!updates.length) {
        return;
      }

      setIsApplyingStatementAmount(true);
      try {
        for (const update of updates) {
          await onUpdateFinancialRecord(update.row.recordId, update.values);
        }
        setAmountDrafts((prev) => {
          const next = { ...prev };
          updates.forEach(({ row }) => {
            delete next[row.recordId];
          });
          return next;
        });
      } finally {
        setIsApplyingStatementAmount(false);
      }
    },
    [
      buildRecordUpdateValues,
      getAbsoluteAmountFromDraft,
      isApplyingStatementAmount,
      isRowAmountLocked,
      onUpdateFinancialRecord,
      statementAmountDraft,
    ],
  );

  return {
    amountDrafts,
    statementAmountDraft,
    isApplyingStatementAmount,
    getAbsoluteSaldoBase,
    getPercentFromSaldo,
    handleRecordAmountChange,
    toggleRecordAmountMode,
    handleRecordAmountBlur,
    handleStatementAmountChange,
    toggleStatementAmountMode,
    applyStatementAmountToRows,
  };
};
