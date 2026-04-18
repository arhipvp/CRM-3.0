import { useCallback } from 'react';

import {
  createFinanceStatement,
  createFinancialRecord,
  createPayment,
  deleteFinanceStatement,
  deleteFinancialRecord,
  deletePayment,
  removeFinanceStatementRecords,
  updateFinanceStatement,
  updateFinancialRecord,
  updatePayment,
} from '../../api';
import type { AddFinancialRecordFormValues } from '../../components/forms/AddFinancialRecordForm';
import type { AddPaymentFormValues } from '../../components/forms/AddPaymentForm';
import { confirmTexts } from '../../constants/confirmTexts';
import type { NotificationContextType } from '../../contexts/NotificationTypes';
import type { FinancialRecordModalState, PaymentModalState } from '../../types';
import type { FinancialRecord, Payment, Statement } from '../../types';
import { parseAmountValue } from '../../utils/appContent';
import { formatErrorMessage } from '../../utils/formatErrorMessage';
import type { useAppData } from '../useAppData';
import type { useConfirm } from '../useConfirm';

type UpdateAppData = ReturnType<typeof useAppData>['updateAppData'];
type Confirm = ReturnType<typeof useConfirm>['confirm'];
type AddNotification = NotificationContextType['addNotification'];

interface UseFinanceActionsParams {
  payments: Payment[];
  financialRecordModal: FinancialRecordModalState | null;
  updateAppData: UpdateAppData;
  setError: React.Dispatch<React.SetStateAction<string | null>>;
  confirm: Confirm;
  addNotification: AddNotification;
  invalidateDealsCache: () => void;
  syncDealsByIds: (dealIds: (string | null | undefined)[]) => Promise<void>;
  adjustPaymentsTotals: <
    T extends { id: string; paymentsTotal?: string | null; paymentsPaid?: string | null },
  >(
    items: T[],
    targetId: string | undefined | null,
    totalDelta: number,
    paidDelta: number,
  ) => T[];
  setPaymentModal: React.Dispatch<React.SetStateAction<PaymentModalState | null>>;
  setFinancialRecordModal: React.Dispatch<React.SetStateAction<FinancialRecordModalState | null>>;
}

const normalizeFinancialRecordAmount = (values: AddFinancialRecordFormValues) => {
  const parsedAmount = parseFloat(values.amount);
  if (!Number.isFinite(parsedAmount)) {
    return parsedAmount;
  }
  return values.recordType === 'expense' ? -Math.abs(parsedAmount) : Math.abs(parsedAmount);
};

const applyStatementAggregates = (items: Statement[], records: FinancialRecord[]) => {
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

export const useFinanceActions = ({
  payments,
  financialRecordModal,
  updateAppData,
  setError,
  confirm,
  addNotification,
  invalidateDealsCache,
  syncDealsByIds,
  adjustPaymentsTotals,
  setPaymentModal,
  setFinancialRecordModal,
}: UseFinanceActionsParams) => {
  const handleAddPayment = useCallback(
    async (values: AddPaymentFormValues) => {
      invalidateDealsCache();
      try {
        const created = await createPayment({
          policyId: values.policyId,
          dealId: values.dealId ?? undefined,
          amount: parseFloat(values.amount),
          description: values.description,
          scheduledDate: values.scheduledDate || null,
          actualDate: values.actualDate || null,
        });

        const zeroIncome = await createFinancialRecord({
          paymentId: created.id,
          amount: 0,
          recordType: 'income',
          date: new Date().toISOString().split('T')[0],
          description: 'Счёт: автоматически создан для учета',
          source: 'Система',
        });

        const paymentAmount = parseAmountValue(created.amount);
        const paymentPaidAmount = created.actualDate ? paymentAmount : 0;
        updateAppData((prev) => ({
          payments: [created, ...prev.payments],
          financialRecords: [zeroIncome, ...prev.financialRecords],
          policies: adjustPaymentsTotals(
            prev.policies,
            created.policyId,
            paymentAmount,
            paymentPaidAmount,
          ),
          deals: adjustPaymentsTotals(prev.deals, created.dealId, paymentAmount, paymentPaidAmount),
        }));
        try {
          await syncDealsByIds([created.dealId]);
        } catch (syncErr) {
          const baseMessage = 'Не удалось обновить данные сделки после создания платежа';
          const detail = formatErrorMessage(syncErr);
          const message = detail ? `${baseMessage}: ${detail}` : baseMessage;
          throw new Error(message);
        }
        setPaymentModal(null);
      } catch (err) {
        setError(formatErrorMessage(err, 'Ошибка при создании платежа'));
        throw err;
      }
    },
    [
      adjustPaymentsTotals,
      invalidateDealsCache,
      setError,
      setPaymentModal,
      syncDealsByIds,
      updateAppData,
    ],
  );

  const handleUpdatePayment = useCallback(
    async (paymentId: string, values: AddPaymentFormValues) => {
      invalidateDealsCache();
      try {
        const previousPayment = payments.find((payment) => payment.id === paymentId);
        const previousAmount = parseAmountValue(previousPayment?.amount);
        const previousPaid = previousPayment?.actualDate ? previousAmount : 0;
        const previousPolicyId = previousPayment?.policyId;
        const previousDealId = previousPayment?.dealId;

        const updated = await updatePayment(paymentId, {
          policyId: values.policyId,
          dealId: values.dealId ?? undefined,
          amount: parseFloat(values.amount),
          description: values.description,
          scheduledDate: values.scheduledDate || null,
          actualDate: values.actualDate || null,
        });
        const updatedAmount = parseAmountValue(updated.amount);
        const updatedPaid = updated.actualDate ? updatedAmount : 0;
        updateAppData((prev) => {
          let policies = prev.policies;
          if (previousPolicyId && previousPolicyId === updated.policyId) {
            policies = adjustPaymentsTotals(
              policies,
              previousPolicyId,
              updatedAmount - previousAmount,
              updatedPaid - previousPaid,
            );
          } else {
            if (previousPolicyId) {
              policies = adjustPaymentsTotals(
                policies,
                previousPolicyId,
                -previousAmount,
                -previousPaid,
              );
            }
            if (updated.policyId) {
              policies = adjustPaymentsTotals(
                policies,
                updated.policyId,
                updatedAmount,
                updatedPaid,
              );
            }
          }

          let deals = prev.deals;
          if (previousDealId && previousDealId === updated.dealId) {
            deals = adjustPaymentsTotals(
              deals,
              previousDealId,
              updatedAmount - previousAmount,
              updatedPaid - previousPaid,
            );
          } else {
            if (previousDealId) {
              deals = adjustPaymentsTotals(deals, previousDealId, -previousAmount, -previousPaid);
            }
            if (updated.dealId) {
              deals = adjustPaymentsTotals(deals, updated.dealId, updatedAmount, updatedPaid);
            }
          }

          return {
            payments: prev.payments.map((payment) =>
              payment.id === updated.id ? updated : payment,
            ),
            policies,
            deals,
          };
        });
        try {
          await syncDealsByIds([updated.dealId, previousDealId]);
        } catch (syncErr) {
          const baseMessage = 'Не удалось обновить данные сделки после изменения платежа';
          const detail = formatErrorMessage(syncErr);
          const message = detail ? `${baseMessage}: ${detail}` : baseMessage;
          throw new Error(message);
        }
        setPaymentModal(null);
      } catch (err) {
        setError(formatErrorMessage(err, 'Ошибка при обновлении платежа'));
        throw err;
      }
    },
    [
      adjustPaymentsTotals,
      invalidateDealsCache,
      payments,
      setError,
      setPaymentModal,
      syncDealsByIds,
      updateAppData,
    ],
  );

  const handleDeletePayment = useCallback(
    async (paymentId: string) => {
      const payment = payments.find((item) => item.id === paymentId);
      if (!payment) {
        return;
      }
      const confirmed = await confirm(confirmTexts.deletePayment());
      if (!confirmed) {
        return;
      }
      try {
        await deletePayment(paymentId);
        const paymentAmount = parseAmountValue(payment.amount);
        const paymentPaid = payment.actualDate ? paymentAmount : 0;
        updateAppData((prev) => ({
          payments: prev.payments.filter((item) => item.id !== paymentId),
          financialRecords: prev.financialRecords.filter(
            (record) => record.paymentId !== paymentId,
          ),
          policies: adjustPaymentsTotals(
            prev.policies,
            payment.policyId,
            -paymentAmount,
            -paymentPaid,
          ),
          deals: adjustPaymentsTotals(prev.deals, payment.dealId, -paymentAmount, -paymentPaid),
        }));
        await syncDealsByIds([payment.dealId]);
      } catch (err) {
        setError(formatErrorMessage(err, 'Ошибка при удалении платежа'));
        throw err;
      }
    },
    [adjustPaymentsTotals, confirm, payments, setError, syncDealsByIds, updateAppData],
  );

  const handleMarkPaymentPaid = useCallback(
    async (paymentId: string, actualDate: string) => {
      const payment = payments.find((item) => item.id === paymentId);
      if (!payment) {
        return;
      }

      try {
        const previousAmount = parseAmountValue(payment.amount);
        const previousPaid = payment.actualDate ? previousAmount : 0;
        const updated = await updatePayment(paymentId, {
          policyId: payment.policyId,
          dealId: payment.dealId ?? undefined,
          amount: previousAmount,
          description: payment.description ?? '',
          scheduledDate: payment.scheduledDate ?? null,
          actualDate,
        });
        const updatedAmount = parseAmountValue(updated.amount);
        const updatedPaid = updated.actualDate ? updatedAmount : 0;

        updateAppData((prev) => ({
          payments: prev.payments.map((item) => (item.id === updated.id ? updated : item)),
          policies: adjustPaymentsTotals(
            prev.policies,
            updated.policyId,
            updatedAmount - previousAmount,
            updatedPaid - previousPaid,
          ),
          deals: adjustPaymentsTotals(
            prev.deals,
            updated.dealId,
            updatedAmount - previousAmount,
            updatedPaid - previousPaid,
          ),
        }));
        await syncDealsByIds([updated.dealId, payment.dealId]);
      } catch (err) {
        setError(formatErrorMessage(err, 'Ошибка при обновлении даты оплаты'));
        throw err;
      }
    },
    [adjustPaymentsTotals, payments, setError, syncDealsByIds, updateAppData],
  );

  const handleAddFinancialRecord = useCallback(
    async (values: AddFinancialRecordFormValues) => {
      const paymentId = values.paymentId || financialRecordModal?.paymentId;
      if (!paymentId) {
        return;
      }
      try {
        const created = await createFinancialRecord({
          paymentId,
          amount: normalizeFinancialRecordAmount(values),
          recordType: values.recordType,
          date: values.date || null,
          description: values.description,
          source: values.source,
          note: values.note,
        });
        updateAppData((prev) => {
          const financialRecords = [created, ...prev.financialRecords];
          const payments = prev.payments.map((payment) =>
            payment.id === created.paymentId
              ? {
                  ...payment,
                  financialRecords: [...(payment.financialRecords ?? []), created],
                }
              : payment,
          );
          const statements = applyStatementAggregates(prev.statements ?? [], financialRecords);
          return { financialRecords, payments, statements };
        });
        setFinancialRecordModal(null);
      } catch (err) {
        setError(formatErrorMessage(err, 'Ошибка при создании записи'));
        throw err;
      }
    },
    [financialRecordModal, setError, setFinancialRecordModal, updateAppData],
  );

  const handleUpdateFinancialRecord = useCallback(
    async (recordId: string, values: AddFinancialRecordFormValues) => {
      try {
        const updated = await updateFinancialRecord(recordId, {
          amount: normalizeFinancialRecordAmount(values),
          recordType: values.recordType,
          date: values.date || null,
          description: values.description,
          source: values.source,
          note: values.note,
        });
        updateAppData((prev) => {
          const financialRecords = prev.financialRecords.map((record) =>
            record.id === updated.id ? updated : record,
          );
          const payments = prev.payments.map((payment) =>
            payment.id === updated.paymentId
              ? {
                  ...payment,
                  financialRecords: (payment.financialRecords ?? []).map((record) =>
                    record.id === updated.id ? updated : record,
                  ),
                }
              : payment,
          );
          const statements = applyStatementAggregates(prev.statements ?? [], financialRecords);
          return { financialRecords, payments, statements };
        });
        setFinancialRecordModal(null);
      } catch (err) {
        setError(formatErrorMessage(err, 'Ошибка при обновлении записи'));
        throw err;
      }
    },
    [setError, setFinancialRecordModal, updateAppData],
  );

  const handleMarkFinancialRecordPaid = useCallback(
    async (recordId: string, paidDate: string) => {
      const record = payments
        .flatMap((payment) => payment.financialRecords ?? [])
        .find((item) => item.id === recordId);
      if (!record) {
        return;
      }
      const resolvedRecordType = record.recordType === 'Расход' ? 'expense' : 'income';
      const amount = parseAmountValue(record.amount);

      try {
        const updated = await updateFinancialRecord(recordId, {
          recordType: resolvedRecordType,
          amount: Math.abs(amount),
          date: paidDate,
          description: record.description ?? '',
          source: record.source ?? '',
          note: record.note ?? '',
        });
        updateAppData((prev) => {
          const financialRecords = prev.financialRecords.map((item) =>
            item.id === updated.id ? updated : item,
          );
          const payments = prev.payments.map((payment) =>
            payment.id === updated.paymentId
              ? {
                  ...payment,
                  financialRecords: (payment.financialRecords ?? []).map((item) =>
                    item.id === updated.id ? updated : item,
                  ),
                }
              : payment,
          );
          const statements = applyStatementAggregates(prev.statements ?? [], financialRecords);
          return { financialRecords, payments, statements };
        });
      } catch (err) {
        setError(formatErrorMessage(err, 'Ошибка при обновлении даты оплаты записи'));
        throw err;
      }
    },
    [payments, setError, updateAppData],
  );

  const handleDeleteFinancialRecord = useCallback(
    async (recordId: string) => {
      const confirmed = await confirm(confirmTexts.deleteFinancialRecord());
      if (!confirmed) {
        return;
      }
      try {
        await deleteFinancialRecord(recordId);
        updateAppData((prev) => {
          const existing = prev.financialRecords.find((record) => record.id === recordId);
          const financialRecords = prev.financialRecords.filter((record) => record.id !== recordId);
          const payments = existing
            ? prev.payments.map((payment) =>
                payment.id === existing.paymentId
                  ? {
                      ...payment,
                      financialRecords: (payment.financialRecords ?? []).filter(
                        (record) => record.id !== recordId,
                      ),
                    }
                  : payment,
              )
            : prev.payments;
          const statements = applyStatementAggregates(prev.statements ?? [], financialRecords);
          return { financialRecords, payments, statements };
        });
        setFinancialRecordModal(null);
      } catch (err) {
        setError(formatErrorMessage(err, 'Ошибка при удалении записи'));
        throw err;
      }
    },
    [confirm, setError, setFinancialRecordModal, updateAppData],
  );

  const handleCreateFinanceStatement = useCallback(
    async (values: {
      name: string;
      statementType: Statement['statementType'];
      counterparty?: string;
      comment?: string;
      recordIds?: string[];
    }) => {
      const created = await createFinanceStatement({
        name: values.name,
        statementType: values.statementType,
        counterparty: values.counterparty,
        comment: values.comment,
        recordIds: values.recordIds,
      });
      updateAppData((prev) => {
        const recordIds = values.recordIds ?? [];
        if (!recordIds.length) {
          return {
            statements: [created, ...(prev.statements ?? [])],
          };
        }

        const recordIdSet = new Set(recordIds);
        const financialRecords = prev.financialRecords.map((record) =>
          recordIdSet.has(record.id) ? { ...record, statementId: created.id } : record,
        );
        const payments = prev.payments.map((payment) => ({
          ...payment,
          financialRecords: (payment.financialRecords ?? []).map((record) =>
            recordIdSet.has(record.id) ? { ...record, statementId: created.id } : record,
          ),
        }));
        const statements = applyStatementAggregates(
          [created, ...(prev.statements ?? [])],
          financialRecords,
        );
        return { statements, financialRecords, payments };
      });
      addNotification('Ведомость создана', 'success', 4000);
      return created;
    },
    [addNotification, updateAppData],
  );

  const handleUpdateFinanceStatement = useCallback(
    async (
      statementId: string,
      values: Partial<{
        name: string;
        statementType: Statement['statementType'];
        status: Statement['status'];
        counterparty: string;
        comment: string;
        paidAt: string | null;
        recordIds: string[];
      }>,
    ) => {
      const updated = await updateFinanceStatement(statementId, values);
      updateAppData((prev) => {
        let statements = (prev.statements ?? []).map((statement) =>
          statement.id === updated.id ? updated : statement,
        );
        const updatedRecordIds = values.recordIds ?? [];
        const recordIdSet = new Set(updatedRecordIds);
        const financialRecords = updatedRecordIds.length
          ? prev.financialRecords.map((record) =>
              recordIdSet.has(record.id) ? { ...record, statementId: updated.id } : record,
            )
          : prev.financialRecords;
        const payments = updatedRecordIds.length
          ? prev.payments.map((payment) => ({
              ...payment,
              financialRecords: (payment.financialRecords ?? []).map((record) =>
                recordIdSet.has(record.id) ? { ...record, statementId: updated.id } : record,
              ),
            }))
          : prev.payments;
        statements = applyStatementAggregates(statements, financialRecords);
        return { statements, financialRecords, payments };
      });
      addNotification('Ведомость обновлена', 'success', 4000);
      return updated;
    },
    [addNotification, updateAppData],
  );

  const handleDeleteFinanceStatement = useCallback(
    async (statementId: string) => {
      try {
        await deleteFinanceStatement(statementId);
        updateAppData((prev) => ({
          statements: (prev.statements ?? []).filter((statement) => statement.id !== statementId),
          financialRecords: prev.financialRecords.map((record) =>
            record.statementId === statementId ? { ...record, statementId: null } : record,
          ),
          payments: prev.payments.map((payment) => ({
            ...payment,
            financialRecords: (payment.financialRecords ?? []).map((record) =>
              record.statementId === statementId ? { ...record, statementId: null } : record,
            ),
          })),
        }));
        addNotification('Ведомость удалена', 'success', 4000);
      } catch (err) {
        setError(formatErrorMessage(err, 'Ошибка при удалении ведомости'));
        throw err;
      }
    },
    [addNotification, setError, updateAppData],
  );

  const handleRemoveFinanceStatementRecords = useCallback(
    async (statementId: string, recordIds: string[]) => {
      try {
        await removeFinanceStatementRecords(statementId, recordIds);
        updateAppData((prev) => {
          const recordIdSet = new Set(recordIds);
          const financialRecords = prev.financialRecords.map((record) =>
            recordIdSet.has(record.id) ? { ...record, statementId: null } : record,
          );
          const payments = prev.payments.map((payment) => ({
            ...payment,
            financialRecords: (payment.financialRecords ?? []).map((record) =>
              recordIdSet.has(record.id) ? { ...record, statementId: null } : record,
            ),
          }));
          const statements = applyStatementAggregates(prev.statements ?? [], financialRecords);
          return { financialRecords, payments, statements };
        });
        addNotification('Состав ведомости обновлён', 'success', 4000);
      } catch (err) {
        setError(formatErrorMessage(err, 'Ошибка при обновлении ведомости'));
        throw err;
      }
    },
    [addNotification, setError, updateAppData],
  );

  return {
    handleAddPayment,
    handleUpdatePayment,
    handleDeletePayment,
    handleMarkPaymentPaid,
    handleAddFinancialRecord,
    handleUpdateFinancialRecord,
    handleMarkFinancialRecordPaid,
    handleDeleteFinancialRecord,
    handleCreateFinanceStatement,
    handleUpdateFinanceStatement,
    handleDeleteFinanceStatement,
    handleRemoveFinanceStatementRecords,
  };
};
