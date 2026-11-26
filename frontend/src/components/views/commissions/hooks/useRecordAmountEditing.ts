import { useCallback, useState } from 'react';

import type { AddFinancialRecordFormValues } from '../../../forms/AddFinancialRecordForm';
import type { AmountDraft, IncomeExpenseRow } from '../RecordsTable';
import type { StatementAmountApplyMode, StatementAmountApplyResult } from '../../../../types';
import { normalizeNumericAmount, parseNumericAmount } from '../../../../utils/parseNumericAmount';
import { formatErrorMessage } from '../../../../utils/formatErrorMessage';

interface UseRecordAmountEditingArgs {
  incomeStatementId?: string;
  onUpdateFinancialRecord?: (
    recordId: string,
    values: AddFinancialRecordFormValues,
  ) => Promise<void>;
  onApplyStatementAmount?: (
    statementId: string,
    values: { mode: StatementAmountApplyMode; value: string },
  ) => Promise<StatementAmountApplyResult | void>;
  isRowAmountLocked?: (row: IncomeExpenseRow) => boolean;
}

const normalizeAbsoluteAmount = (value: number) => value.toFixed(2).replace(/\.?0+$/, '');

const applyPercentToRecordAmount = (amount: number, percent: string) => {
  const [whole, fraction = ''] = percent.replace(/^[+-]/, '').split('.');
  const scaledPercent = BigInt(whole + fraction);
  const divisor = 100n * 10n ** BigInt(fraction.length);
  const amountInKopecks = BigInt(Math.round(amount * 100));
  return Number((amountInKopecks * scaledPercent + divisor / 2n) / divisor) / 100;
};

export const useRecordAmountEditing = ({
  incomeStatementId,
  onUpdateFinancialRecord,
  onApplyStatementAmount,
  isRowAmountLocked,
}: UseRecordAmountEditingArgs) => {
  const [amountDrafts, setAmountDrafts] = useState<Record<string, AmountDraft>>({});
  const [statementAmountDraft, setStatementAmountDraft] = useState<AmountDraft>({
    mode: 'rub',
    value: '',
  });
  const [isApplyingStatementAmount, setIsApplyingStatementAmount] = useState(false);
  const [savingRecordIds, setSavingRecordIds] = useState<Set<string>>(new Set());
  const [recordAmountErrors, setRecordAmountErrors] = useState<Record<string, string>>({});
  const [draftIncomeStatementId, setDraftIncomeStatementId] = useState(incomeStatementId);

  if (draftIncomeStatementId !== incomeStatementId) {
    setDraftIncomeStatementId(incomeStatementId);
    setAmountDrafts({});
  }

  const usesRecordAmountForPercent = useCallback(
    (row: IncomeExpenseRow) => Boolean(incomeStatementId && row.statementId === incomeStatementId),
    [incomeStatementId],
  );
  const getRecordPercentBase = useCallback(
    (row: IncomeExpenseRow) => {
      if (usesRecordAmountForPercent(row)) {
        return Math.abs(row.recordAmount);
      }
      const saldo = Math.abs(row.paymentPaidBalance ?? 0);
      return Number.isFinite(saldo) && saldo > 0 ? saldo : null;
    },
    [usesRecordAmountForPercent],
  );

  const getAbsoluteAmountFromDraft = useCallback(
    (row: IncomeExpenseRow, draft: AmountDraft) => {
      const normalized = normalizeNumericAmount(draft.value);
      if (normalized === null) {
        return null;
      }
      if (draft.mode === 'rub') {
        return Math.abs(Number(normalized));
      }
      const base = getRecordPercentBase(row);
      if (base === null) {
        return null;
      }
      const amount = usesRecordAmountForPercent(row)
        ? applyPercentToRecordAmount(base, normalized)
        : (base * Math.abs(Number(normalized))) / 100;
      return Number.isFinite(amount) ? amount : null;
    },
    [getRecordPercentBase, usesRecordAmountForPercent],
  );

  const buildRecordUpdateValues = useCallback(
    (row: IncomeExpenseRow, absoluteAmount: number): AddFinancialRecordFormValues => {
      const recordType: AddFinancialRecordFormValues['recordType'] =
        row.recordKind === 'income' ? 'income' : 'expense';

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
    setRecordAmountErrors((prev) => {
      const next = { ...prev };
      delete next[recordId];
      return next;
    });
    setAmountDrafts((prev) => ({
      ...prev,
      [recordId]: { mode: prev[recordId]?.mode ?? 'rub', value },
    }));
  }, []);

  const toggleRecordAmountMode = useCallback(
    (row: IncomeExpenseRow) => {
      setAmountDrafts((prev) => {
        const current = prev[row.recordId];
        if (current?.mode !== 'percent') {
          const base = getRecordPercentBase(row);
          if (base === null) {
            return prev;
          }
          const currentNumber = parseNumericAmount(current?.value);
          const absoluteAmount = Number.isFinite(currentNumber)
            ? Math.abs(currentNumber)
            : Math.abs(row.recordAmount);
          const percent = base === 0 ? 100 : (absoluteAmount / base) * 100;
          return {
            ...prev,
            [row.recordId]: { mode: 'percent', value: normalizeAbsoluteAmount(percent) },
          };
        }

        const absoluteAmount = getAbsoluteAmountFromDraft(row, current);
        return {
          ...prev,
          [row.recordId]: {
            mode: 'rub',
            value:
              absoluteAmount === null
                ? Math.abs(row.recordAmount).toString()
                : normalizeAbsoluteAmount(absoluteAmount),
          },
        };
      });
    },
    [getAbsoluteAmountFromDraft, getRecordPercentBase],
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
      if (savingRecordIds.has(row.recordId)) return;
      setSavingRecordIds((prev) => new Set(prev).add(row.recordId));
      try {
        await onUpdateFinancialRecord(
          row.recordId,
          buildRecordUpdateValues(row, Math.abs(absoluteAmount)),
        );
        setAmountDrafts((prev) => {
          const next = { ...prev };
          delete next[row.recordId];
          return next;
        });
      } catch (error) {
        setAmountDrafts((prev) => {
          const next = { ...prev };
          delete next[row.recordId];
          return next;
        });
        setRecordAmountErrors((prev) => ({
          ...prev,
          [row.recordId]: formatErrorMessage(error, 'Не удалось сохранить сумму.'),
        }));
      } finally {
        setSavingRecordIds((prev) => {
          const next = new Set(prev);
          next.delete(row.recordId);
          return next;
        });
      }
    },
    [
      amountDrafts,
      buildRecordUpdateValues,
      getAbsoluteAmountFromDraft,
      isRowAmountLocked,
      onUpdateFinancialRecord,
      savingRecordIds,
    ],
  );

  const cancelRecordAmountEdit = useCallback((recordId: string) => {
    setAmountDrafts((prev) => {
      const next = { ...prev };
      delete next[recordId];
      return next;
    });
    setRecordAmountErrors((prev) => {
      const next = { ...prev };
      delete next[recordId];
      return next;
    });
  }, []);

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
    async (statementId: string | undefined, rows: IncomeExpenseRow[]) => {
      if (!onApplyStatementAmount || !statementId || isApplyingStatementAmount) {
        return;
      }
      const candidates = rows.filter((row) => !isRowAmountLocked?.(row));
      if (!candidates.length) {
        return;
      }
      const normalizedValue = normalizeNumericAmount(statementAmountDraft.value);
      if (!normalizedValue) {
        return;
      }

      setIsApplyingStatementAmount(true);
      try {
        await onApplyStatementAmount(statementId, {
          mode: statementAmountDraft.mode,
          value: normalizedValue,
        });
        setAmountDrafts((prev) => {
          const next = { ...prev };
          candidates.forEach((row) => {
            delete next[row.recordId];
          });
          return next;
        });
        setStatementAmountDraft((prev) => ({ ...prev, value: '' }));
      } finally {
        setIsApplyingStatementAmount(false);
      }
    },
    [isApplyingStatementAmount, isRowAmountLocked, onApplyStatementAmount, statementAmountDraft],
  );

  return {
    amountDrafts,
    statementAmountDraft,
    isApplyingStatementAmount,
    savingRecordIds,
    recordAmountErrors,
    getRecordPercentBase,
    getAbsoluteAmountFromDraft,
    handleRecordAmountChange,
    toggleRecordAmountMode,
    handleRecordAmountBlur,
    cancelRecordAmountEdit,
    handleStatementAmountChange,
    toggleStatementAmountMode,
    applyStatementAmountToRows,
  };
};
