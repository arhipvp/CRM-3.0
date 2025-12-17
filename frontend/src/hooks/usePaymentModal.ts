import { useCallback, useMemo, useState } from 'react';

import type { Payment } from '../types';

export const usePaymentModal = (payments: Payment[]) => {
  const [editingPaymentId, setEditingPaymentId] = useState<string | null>(null);
  const [creatingPaymentPolicyId, setCreatingPaymentPolicyId] = useState<string | null>(null);

  const isOpen = Boolean(editingPaymentId);
  const isCreating = editingPaymentId === 'new';

  const editingPayment = useMemo(() => {
    if (!editingPaymentId || editingPaymentId === 'new') {
      return undefined;
    }
    return payments.find((payment) => payment.id === editingPaymentId);
  }, [editingPaymentId, payments]);

  const fixedPolicyId = isCreating ? creatingPaymentPolicyId ?? undefined : undefined;

  const closePaymentModal = useCallback(() => {
    setEditingPaymentId(null);
    setCreatingPaymentPolicyId(null);
  }, []);

  const openCreatePayment = useCallback((policyId?: string | null) => {
    setEditingPaymentId('new');
    setCreatingPaymentPolicyId(policyId ?? null);
  }, []);

  const openEditPayment = useCallback((paymentId: string) => {
    setEditingPaymentId(paymentId);
    setCreatingPaymentPolicyId(null);
  }, []);

  return {
    isOpen,
    isCreating,
    editingPaymentId,
    setEditingPaymentId,
    creatingPaymentPolicyId,
    setCreatingPaymentPolicyId,
    editingPayment,
    fixedPolicyId,
    openCreatePayment,
    openEditPayment,
    closePaymentModal,
  };
};
