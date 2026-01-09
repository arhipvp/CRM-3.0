import { useCallback, useMemo, useState } from 'react';

import type { FinancialRecord } from '../types';
import type { FinancialRecordCreationContext } from '../types';

export const useFinancialRecordModal = (financialRecords: FinancialRecord[]) => {
  const [editingFinancialRecordId, setEditingFinancialRecordId] = useState<string | null>(null);
  const [creatingFinancialRecordContext, setCreatingFinancialRecordContext] =
    useState<FinancialRecordCreationContext | null>(null);

  const editingFinancialRecord = useMemo(
    () =>
      editingFinancialRecordId
        ? financialRecords.find((record) => record.id === editingFinancialRecordId)
        : undefined,
    [editingFinancialRecordId, financialRecords],
  );

  const openCreateFinancialRecord = useCallback(
    (paymentId: string, recordType: 'income' | 'expense') => {
      setCreatingFinancialRecordContext({ paymentId, recordType });
      setEditingFinancialRecordId(null);
    },
    [],
  );

  const openEditFinancialRecord = useCallback((recordId: string) => {
    setEditingFinancialRecordId(recordId);
    setCreatingFinancialRecordContext(null);
  }, []);

  const closeFinancialRecordModal = useCallback(() => {
    setEditingFinancialRecordId(null);
    setCreatingFinancialRecordContext(null);
  }, []);

  const isOpen = Boolean(editingFinancialRecordId || creatingFinancialRecordContext);
  const paymentId =
    creatingFinancialRecordContext?.paymentId || editingFinancialRecord?.paymentId || '';
  const defaultRecordType = creatingFinancialRecordContext?.recordType;

  return {
    isOpen,
    paymentId,
    defaultRecordType,
    editingFinancialRecord,
    editingFinancialRecordId,
    creatingFinancialRecordContext,
    setEditingFinancialRecordId,
    setCreatingFinancialRecordContext,
    openCreateFinancialRecord,
    openEditFinancialRecord,
    closeFinancialRecordModal,
  };
};
