import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import type { Statement } from '../../../../types';
import type { IncomeExpenseRow } from '../RecordsTable';

interface UseStatementRecordsSelectionArgs {
  attachStatement?: Statement;
  selectedStatement?: Statement;
  isAttachStatementPaid: boolean;
  filteredRows: IncomeExpenseRow[];
  viewMode: 'all' | 'statements';
  onUpdateStatement?: (
    statementId: string,
    values: Partial<{
      recordIds: string[];
    }>,
  ) => Promise<Statement>;
  onRemoveStatementRecords?: (statementId: string, recordIds: string[]) => Promise<void>;
  onRefreshAllRecords: () => Promise<void>;
}

export const useStatementRecordsSelection = ({
  attachStatement,
  selectedStatement,
  isAttachStatementPaid,
  filteredRows,
  viewMode,
  onUpdateStatement,
  onRemoveStatementRecords,
  onRefreshAllRecords,
}: UseStatementRecordsSelectionArgs) => {
  const [selectedRecordIds, setSelectedRecordIds] = useState<string[]>([]);
  const selectAllRef = useRef<HTMLInputElement | null>(null);

  const canAttachRow = useCallback(
    (row: IncomeExpenseRow) => {
      if (!attachStatement) {
        return false;
      }
      if (row.statementId && row.statementId !== attachStatement.id) {
        return false;
      }
      const isIncome = row.recordAmount > 0;
      if (attachStatement.statementType === 'income' && !isIncome) {
        return false;
      }
      if (attachStatement.statementType === 'expense' && isIncome) {
        return false;
      }
      return true;
    },
    [attachStatement],
  );

  const toggleRecordSelection = useCallback(
    (row: IncomeExpenseRow) => {
      if (!attachStatement || !canAttachRow(row)) {
        return;
      }
      setSelectedRecordIds((prev) =>
        prev.includes(row.recordId)
          ? prev.filter((id) => id !== row.recordId)
          : [...prev, row.recordId],
      );
    },
    [attachStatement, canAttachRow],
  );

  const handleAttachSelected = useCallback(async () => {
    if (!attachStatement || !onUpdateStatement || !selectedRecordIds.length) {
      return;
    }
    await onUpdateStatement(attachStatement.id, {
      recordIds: selectedRecordIds,
    });
    if (viewMode === 'all') {
      await onRefreshAllRecords();
    }
    setSelectedRecordIds([]);
  }, [attachStatement, onRefreshAllRecords, onUpdateStatement, selectedRecordIds, viewMode]);

  const handleRemoveSelected = useCallback(async () => {
    if (!selectedStatement || !onRemoveStatementRecords || !selectedRecordIds.length) {
      return;
    }
    await onRemoveStatementRecords(selectedStatement.id, selectedRecordIds);
    setSelectedRecordIds([]);
  }, [onRemoveStatementRecords, selectedRecordIds, selectedStatement]);

  const selectableRecordIds = useMemo(() => {
    if (!attachStatement || isAttachStatementPaid) {
      return [];
    }
    return filteredRows.filter((row) => canAttachRow(row)).map((row) => row.recordId);
  }, [attachStatement, canAttachRow, filteredRows, isAttachStatementPaid]);

  const allSelectableSelected =
    selectableRecordIds.length > 0 &&
    selectableRecordIds.every((id) => selectedRecordIds.includes(id));
  const someSelectableSelected = selectableRecordIds.some((id) => selectedRecordIds.includes(id));

  useEffect(() => {
    if (!selectAllRef.current) {
      return;
    }
    selectAllRef.current.indeterminate = someSelectableSelected && !allSelectableSelected;
  }, [allSelectableSelected, someSelectableSelected]);

  const toggleSelectAll = useCallback(() => {
    if (!attachStatement || isAttachStatementPaid) {
      return;
    }
    setSelectedRecordIds((prev) => {
      const next = new Set(prev);
      if (allSelectableSelected) {
        selectableRecordIds.forEach((id) => next.delete(id));
      } else {
        selectableRecordIds.forEach((id) => next.add(id));
      }
      return Array.from(next);
    });
  }, [allSelectableSelected, attachStatement, isAttachStatementPaid, selectableRecordIds]);

  const resetSelection = useCallback(() => {
    setSelectedRecordIds([]);
  }, []);

  return {
    selectedRecordIds,
    selectableRecordIds,
    allSelectableSelected,
    selectAllRef,
    canAttachRow,
    toggleRecordSelection,
    handleAttachSelected,
    handleRemoveSelected,
    toggleSelectAll,
    resetSelection,
  };
};
