import { useCallback, useState } from 'react';
import type { Dispatch, SetStateAction } from 'react';

import {
  APIError,
  createPolicyDraft,
  deletePolicy,
  fetchPayments,
  movePolicy,
  updatePolicyDraft,
  updatePolicyRenewed,
} from '../../api';
import type { FilterParams, PolicyDraftSaveResult } from '../../api';
import type { ModalType } from '../../components/app/types';
import type { PolicyFormValues } from '../../components/forms/addPolicy/types';
import type { Client, Deal, Payment, Policy, SalesChannel, Statement } from '../../types';
import { formatErrorMessage } from '../../utils/formatErrorMessage';
import { buildPolicyRecognitionDraft } from './policyActionHelpers';
import type { useAppData } from '../useAppData';

type UpdateAppData = ReturnType<typeof useAppData>['updateAppData'];
interface UsePolicyActionsParams {
  clients: Client[];
  dealsById: Map<string, Deal>;
  policies: Policy[];
  payments: Payment[];
  statements: Statement[];
  salesChannels: SalesChannel[];
  dealFilters: FilterParams;
  setModal: Dispatch<SetStateAction<ModalType>>;
  setError: Dispatch<SetStateAction<string | null>>;
  setIsSyncing: Dispatch<SetStateAction<boolean>>;
  updateAppData: UpdateAppData;
  invalidateDealsCache: () => void;
  invalidateDealPoliciesCache: (dealId?: string | null) => void;
  loadDealPolicies: (dealId: string, options?: { force?: boolean }) => Promise<void>;
  mergeDealWithHydratedQuotes: (incomingDeal: Deal, existingDeal?: Deal | null) => Deal;
  refreshDealsWithSelection: (
    filters?: FilterParams,
    options?: { force?: boolean },
  ) => Promise<Deal[]>;
  syncDealsByIds: (dealIds: (string | null | undefined)[]) => Promise<void>;
  selectDealById: (dealId: string) => void;
  adjustPaymentsTotals: <
    T extends { id: string; paymentsTotal?: string | null; paymentsPaid?: string | null },
  >(
    items: T[],
    targetId: string | undefined | null,
    totalDelta: number,
    paidDelta: number,
  ) => T[];
}

export const usePolicyActions = ({
  clients,
  dealsById,
  policies,
  salesChannels,
  dealFilters,
  setModal,
  setError,
  setIsSyncing,
  updateAppData,
  invalidateDealsCache,
  invalidateDealPoliciesCache,
  loadDealPolicies,
  refreshDealsWithSelection,
  syncDealsByIds,
  selectDealById,
}: UsePolicyActionsParams) => {
  const [policyDealId, setPolicyDealId] = useState<string | null>(null);
  const [policyPrefill, setPolicyPrefill] = useState<{
    values: PolicyFormValues;
    insuranceCompanyName?: string;
    insuranceTypeName?: string;
  } | null>(null);
  const [policyDefaultCounterparty, setPolicyDefaultCounterparty] = useState<string | undefined>(
    undefined,
  );
  const [policySourceFileIds, setPolicySourceFileIds] = useState<string[]>([]);
  const [editingPolicy, setEditingPolicy] = useState<Policy | null>(null);

  const resolveDealCounterpartyName = useCallback(
    (dealId: string | null | undefined) => {
      if (!dealId) {
        return undefined;
      }
      const deal = dealsById.get(dealId);
      if (!deal?.clientId) {
        return undefined;
      }
      const dealClient = clients.find((client) => client.id === deal.clientId);
      if (!dealClient?.isCounterparty) {
        return undefined;
      }
      return dealClient.name.trim() || undefined;
    },
    [clients, dealsById],
  );

  const closePolicyModal = useCallback(() => {
    setPolicyDealId(null);
    setPolicyPrefill(null);
    setPolicyDefaultCounterparty(undefined);
    setPolicySourceFileIds([]);
  }, []);

  const mergePolicyDraftResult = useCallback(
    ({ policy, payments: draftPayments }: PolicyDraftSaveResult) => {
      updateAppData((prev) => {
        const paymentIds = new Set(draftPayments.map((payment) => payment.id));
        const draftRecords = draftPayments.flatMap((payment) => payment.financialRecords ?? []);
        const recordIds = new Set(draftRecords.map((record) => record.id));
        const existingPolicyIndex = prev.policies.findIndex((item) => item.id === policy.id);
        const policies =
          existingPolicyIndex >= 0
            ? prev.policies.map((item) => (item.id === policy.id ? policy : item))
            : [policy, ...prev.policies];

        return {
          policies,
          payments: [
            ...draftPayments,
            ...prev.payments.filter(
              (payment) => payment.policyId !== policy.id && !paymentIds.has(payment.id),
            ),
          ],
          financialRecords: [
            ...draftRecords,
            ...prev.financialRecords.filter(
              (record) => !recordIds.has(record.id) && !paymentIds.has(record.paymentId),
            ),
          ],
        };
      });
    },
    [updateAppData],
  );

  const handlePolicyDraftReady = useCallback(
    (
      dealId: string,
      parsed: Record<string, unknown>,
      _fileName?: string | null,
      fileId?: string | null,
      parsedFileIds?: string[],
    ) => {
      if (!parsed) {
        return;
      }
      const draft = buildPolicyRecognitionDraft({
        parsed,
        clients,
        salesChannels,
        fileId,
        parsedFileIds,
      });
      if (!draft) {
        return;
      }
      setPolicyDealId(dealId);
      setPolicyDefaultCounterparty(undefined);
      setPolicySourceFileIds(draft.sourceFileIds);
      setPolicyPrefill({
        values: draft.values,
        insuranceCompanyName: draft.insuranceCompanyName,
        insuranceTypeName: draft.insuranceTypeName,
      });
    },
    [clients, salesChannels],
  );

  const handleRequestAddPolicy = useCallback(
    (dealId: string) => {
      setPolicyDefaultCounterparty(resolveDealCounterpartyName(dealId));
      setPolicyPrefill(null);
      setPolicySourceFileIds([]);
      setPolicyDealId(dealId);
    },
    [resolveDealCounterpartyName],
  );

  const handleRequestEditPolicy = useCallback(
    async (policy: Policy) => {
      setModal(null);
      closePolicyModal();
      setIsSyncing(true);
      try {
        const hydratedPayments = await fetchPayments({ policy: policy.id });
        const hydratedRecords = hydratedPayments.flatMap(
          (payment) => payment.financialRecords ?? [],
        );
        updateAppData((prev) => {
          const hydratedPaymentIds = new Set(hydratedPayments.map((payment) => payment.id));
          const hydratedRecordIds = new Set(hydratedRecords.map((record) => record.id));
          return {
            payments: [
              ...hydratedPayments,
              ...prev.payments.filter((payment) => !hydratedPaymentIds.has(payment.id)),
            ],
            financialRecords: [
              ...hydratedRecords,
              ...prev.financialRecords.filter((record) => !hydratedRecordIds.has(record.id)),
            ],
          };
        });
      } catch (error) {
        setError(formatErrorMessage(error, 'Не удалось загрузить платежи полиса.'));
        throw error;
      } finally {
        setIsSyncing(false);
      }
      setEditingPolicy(policy);
    },
    [closePolicyModal, setError, setIsSyncing, setModal, updateAppData],
  );

  const handleAddPolicy = useCallback(
    async (dealId: string, values: PolicyFormValues) => {
      invalidateDealsCache();
      invalidateDealPoliciesCache(dealId);
      setIsSyncing(true);
      const sourceFileIds = policySourceFileIds;
      const sourceFileId = sourceFileIds[0];
      try {
        const result = await createPolicyDraft({
          dealId,
          ...values,
          sourceFileId,
          sourceFileIds: sourceFileIds.length ? sourceFileIds : undefined,
        });
        mergePolicyDraftResult(result);

        let refreshFailed = false;
        try {
          await syncDealsByIds([dealId]);
          selectDealById(dealId);
        } catch (refreshErr) {
          setError(
            refreshErr instanceof Error ? refreshErr.message : 'Не удалось обновить данные сделки',
          );
          refreshFailed = true;
        }

        try {
          await loadDealPolicies(dealId, { force: true });
        } catch (refreshErr) {
          setError(
            refreshErr instanceof Error ? refreshErr.message : 'Не удалось обновить список полисов',
          );
          refreshFailed = true;
        }
        try {
          await refreshDealsWithSelection(dealFilters, { force: true });
        } catch (refreshErr) {
          setError(
            refreshErr instanceof Error ? refreshErr.message : 'Не удалось обновить список сделок',
          );
          refreshFailed = true;
        }

        if (!refreshFailed) {
          closePolicyModal();
        }
      } catch (err) {
        setError(formatErrorMessage(err, 'Не удалось сохранить полис'));
        throw err;
      } finally {
        setIsSyncing(false);
      }
    },
    [
      closePolicyModal,
      dealFilters,
      dealsById,
      invalidateDealPoliciesCache,
      invalidateDealsCache,
      loadDealPolicies,
      mergePolicyDraftResult,
      policySourceFileIds,
      refreshDealsWithSelection,
      selectDealById,
      setError,
      setIsSyncing,
      syncDealsByIds,
    ],
  );

  const handleUpdatePolicy = useCallback(
    async (policyId: string, values: PolicyFormValues) => {
      setIsSyncing(true);
      invalidateDealsCache();
      try {
        const currentPolicy = policies.find((policy) => policy.id === policyId);
        if (!currentPolicy) {
          throw new Error('Не удалось найти полис для обновления.');
        }
        invalidateDealPoliciesCache(currentPolicy.dealId);
        const result = await updatePolicyDraft(policyId, values);
        mergePolicyDraftResult(result);

        if (currentPolicy.dealId) {
          await syncDealsByIds([currentPolicy.dealId]);
          await loadDealPolicies(currentPolicy.dealId, { force: true });
        }
        setEditingPolicy(null);
      } catch (err) {
        const message =
          err instanceof APIError
            ? err.message
            : err instanceof Error
              ? err.message
              : 'Не удалось обновить полис.';
        setError(message);
        throw err;
      } finally {
        setIsSyncing(false);
      }
    },
    [
      invalidateDealPoliciesCache,
      invalidateDealsCache,
      loadDealPolicies,
      mergePolicyDraftResult,
      policies,
      setError,
      setIsSyncing,
      syncDealsByIds,
    ],
  );

  const handleDeletePolicy = useCallback(
    async (policyId: string) => {
      const targetPolicy = policies.find((policy) => policy.id === policyId);
      const targetDealId = targetPolicy?.dealId ?? null;
      invalidateDealsCache();
      invalidateDealPoliciesCache(targetDealId);
      try {
        await deletePolicy(policyId);
        updateAppData((prev) => {
          const removedPaymentIds = new Set<string>();
          const remainingPayments = prev.payments.filter((payment) => {
            const shouldRemove = payment.policyId === policyId;
            if (shouldRemove) {
              removedPaymentIds.add(payment.id);
            }
            return !shouldRemove;
          });
          return {
            policies: prev.policies.filter((policy) => policy.id !== policyId),
            payments: remainingPayments,
            financialRecords: prev.financialRecords.filter(
              (record) => !removedPaymentIds.has(record.paymentId),
            ),
          };
        });
        if (targetDealId) {
          await syncDealsByIds([targetDealId]);
          await loadDealPolicies(targetDealId, { force: true });
        }
      } catch (err) {
        setError(formatErrorMessage(err, 'Не удалось удалить полис'));
        throw err;
      }
    },
    [
      invalidateDealPoliciesCache,
      invalidateDealsCache,
      loadDealPolicies,
      policies,
      setError,
      syncDealsByIds,
      updateAppData,
    ],
  );

  const handleMovePolicy = useCallback(
    async (policyId: string, targetDealId: string) => {
      const targetPolicy = policies.find((policy) => policy.id === policyId);
      if (!targetPolicy) {
        throw new Error('Не удалось найти полис для переноса.');
      }
      const sourceDealId = targetPolicy.dealId;
      if (sourceDealId === targetDealId) {
        throw new Error('Полис уже находится в выбранной сделке.');
      }

      setIsSyncing(true);
      invalidateDealsCache();
      invalidateDealPoliciesCache(sourceDealId);
      invalidateDealPoliciesCache(targetDealId);
      try {
        const updated = await movePolicy(policyId, targetDealId);
        const targetDeal = dealsById.get(targetDealId);
        updateAppData((prev) => ({
          policies: prev.policies.map((policy) => (policy.id === updated.id ? updated : policy)),
          payments: prev.payments.map((payment) =>
            payment.policyId === policyId
              ? {
                  ...payment,
                  dealId: targetDealId,
                  dealTitle: targetDeal?.title ?? updated.dealTitle ?? payment.dealTitle,
                  dealClientName:
                    targetDeal?.clientName ?? updated.clientName ?? payment.dealClientName,
                }
              : payment,
          ),
          financialRecords: prev.financialRecords.map((record) =>
            record.policyId === policyId
              ? {
                  ...record,
                  dealId: targetDealId,
                  dealTitle: targetDeal?.title ?? updated.dealTitle ?? record.dealTitle,
                  dealClientName:
                    targetDeal?.clientName ?? updated.clientName ?? record.dealClientName,
                }
              : record,
          ),
        }));
        await syncDealsByIds([sourceDealId, targetDealId]);
        await Promise.all(
          [sourceDealId, targetDealId]
            .filter((dealId): dealId is string => Boolean(dealId))
            .map((dealId) => loadDealPolicies(dealId, { force: true })),
        );
      } catch (err) {
        setError(formatErrorMessage(err, 'Не удалось перенести полис'));
        throw err;
      } finally {
        setIsSyncing(false);
      }
    },
    [
      dealsById,
      invalidateDealPoliciesCache,
      invalidateDealsCache,
      loadDealPolicies,
      policies,
      setError,
      setIsSyncing,
      syncDealsByIds,
      updateAppData,
    ],
  );

  const handleUpdatePolicyRenewed = useCallback(
    async (policyId: string, isRenewed: boolean) => {
      const targetPolicy = policies.find((policy) => policy.id === policyId);
      const targetDealId = targetPolicy?.dealId ?? null;
      setIsSyncing(true);
      invalidateDealsCache();
      invalidateDealPoliciesCache(targetDealId);
      try {
        const updated = await updatePolicyRenewed(policyId, isRenewed);
        updateAppData((prev) => ({
          policies: prev.policies.map((policy) => (policy.id === updated.id ? updated : policy)),
        }));
        if (targetDealId) {
          await loadDealPolicies(targetDealId, { force: true });
        }
      } catch (err) {
        setError(formatErrorMessage(err, 'Не удалось обновить признак продления полиса'));
        throw err;
      } finally {
        setIsSyncing(false);
      }
    },
    [
      invalidateDealPoliciesCache,
      invalidateDealsCache,
      loadDealPolicies,
      policies,
      setError,
      setIsSyncing,
      updateAppData,
    ],
  );

  return {
    policyDealId,
    policyPrefill,
    policyDefaultCounterparty:
      policyDefaultCounterparty ?? resolveDealCounterpartyName(policyDealId),
    editingPolicy,
    setEditingPolicy,
    closePolicyModal,
    handlePolicyDraftReady,
    handleRequestAddPolicy,
    handleRequestEditPolicy,
    handleAddPolicy,
    handleUpdatePolicy,
    handleUpdatePolicyRenewed,
    handleDeletePolicy,
    handleMovePolicy,
    policyDealExecutorName: policyDealId
      ? (dealsById.get(policyDealId)?.executorName ?? null)
      : null,
    editingPolicyExecutorName: editingPolicy
      ? (dealsById.get(editingPolicy.dealId)?.executorName ?? null)
      : null,
  };
};
