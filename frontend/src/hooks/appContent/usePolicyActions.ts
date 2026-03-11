import { useCallback, useState } from 'react';
import type { Dispatch, SetStateAction } from 'react';

import {
  APIError,
  createClient,
  createFinancialRecord,
  createPayment,
  createPolicy,
  deleteFinancialRecord,
  deletePayment,
  deletePolicy,
  fetchDeal,
  updateFinancialRecord,
  updatePayment,
  updatePolicy,
} from '../../api';
import type { FilterParams } from '../../api';
import type { ModalType } from '../../components/app/types';
import type { PolicyFormValues } from '../../components/forms/addPolicy/types';
import type {
  Client,
  Deal,
  FinancialRecord,
  Payment,
  Policy,
  SalesChannel,
  Statement,
} from '../../types';
import { formatAmountValue, matchSalesChannel, parseAmountValue } from '../../utils/appContent';
import {
  buildCommissionIncomeNote,
  resolveSalesChannelName,
  shouldAutofillCommissionNote,
} from '../../utils/financialRecordNotes';
import { formatErrorMessage } from '../../utils/formatErrorMessage';
import { normalizePaymentDraft } from '../../utils/normalizePaymentDraft';
import { parseNumericAmount } from '../../utils/parseNumericAmount';
import {
  buildPolicyDraftFromRecognition,
  normalizeStringValue,
} from '../../utils/policyRecognition';
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
  payments,
  statements,
  salesChannels,
  dealFilters,
  setModal,
  setError,
  setIsSyncing,
  updateAppData,
  invalidateDealsCache,
  invalidateDealPoliciesCache,
  loadDealPolicies,
  mergeDealWithHydratedQuotes,
  refreshDealsWithSelection,
  syncDealsByIds,
  selectDealById,
  adjustPaymentsTotals,
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

  const closePolicyModal = useCallback(() => {
    setPolicyDealId(null);
    setPolicyPrefill(null);
    setPolicyDefaultCounterparty(undefined);
    setPolicySourceFileIds([]);
  }, []);

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
      const draft = buildPolicyDraftFromRecognition(parsed);
      const policyObj = (parsed.policy ?? {}) as Record<string, unknown>;
      const recognizedSalesChannel = normalizeStringValue(
        policyObj.sales_channel ??
          policyObj.sales_channel_name ??
          policyObj.salesChannel ??
          policyObj.salesChannelName,
      );
      const matchedChannel = matchSalesChannel(salesChannels, recognizedSalesChannel);
      const commissionNote = buildCommissionIncomeNote(matchedChannel?.name);
      const paymentsWithNotes = draft.payments.map((payment) => ({
        ...payment,
        incomes: payment.incomes.map((income) =>
          shouldAutofillCommissionNote(income.note) ? { ...income, note: commissionNote } : income,
        ),
      }));

      const recognizedPolicyClientName = normalizeStringValue(
        parsed.insured_client_name ??
          parsed.client_name ??
          policyObj.insured_client_name ??
          policyObj.client_name ??
          policyObj.client ??
          policyObj.insured_client ??
          policyObj.contractor,
      );
      const matchedPolicyClient = recognizedPolicyClientName?.length
        ? clients.find(
            (client) => client.name.toLowerCase() === recognizedPolicyClientName.toLowerCase(),
          )
        : undefined;

      const values = {
        ...draft,
        salesChannelId: matchedChannel?.id,
        payments: paymentsWithNotes,
        clientId: matchedPolicyClient?.id ?? undefined,
        clientName: matchedPolicyClient?.name ?? (recognizedPolicyClientName || undefined),
      };
      const recognizedInsuranceType = normalizeStringValue(
        policyObj.insurance_type ??
          policyObj.insuranceType ??
          parsed.insurance_type ??
          parsed.insuranceType,
      );
      setPolicyDealId(dealId);
      setPolicyDefaultCounterparty(undefined);
      const resolvedFileIds = parsedFileIds?.length
        ? Array.from(new Set(parsedFileIds.filter((id): id is string => Boolean(id))))
        : fileId
          ? [fileId]
          : [];
      setPolicySourceFileIds(resolvedFileIds);
      setPolicyPrefill({
        values,
        insuranceCompanyName: normalizeStringValue(policyObj.insurance_company),
        insuranceTypeName: recognizedInsuranceType,
      });
    },
    [clients, salesChannels],
  );

  const handleRequestAddPolicy = useCallback((dealId: string) => {
    setPolicyDefaultCounterparty(undefined);
    setPolicyPrefill(null);
    setPolicySourceFileIds([]);
    setPolicyDealId(dealId);
  }, []);

  const handleRequestEditPolicy = useCallback(
    (policy: Policy) => {
      setModal(null);
      closePolicyModal();
      setEditingPolicy(policy);
    },
    [closePolicyModal, setModal],
  );

  const handleAddPolicy = useCallback(
    async (dealId: string, values: PolicyFormValues) => {
      invalidateDealsCache();
      invalidateDealPoliciesCache(dealId);
      setIsSyncing(true);
      const {
        number,
        insuranceCompanyId,
        insuranceTypeId,
        isVehicle,
        brand,
        model,
        vin,
        startDate,
        endDate,
        salesChannelId,
        clientId: selectedPolicyClientId,
        clientName: selectedPolicyClientName,
        counterparty,
        note,
        payments: paymentDrafts = [],
      } = values;
      const sourceFileIds = policySourceFileIds;
      const sourceFileId = sourceFileIds[0];
      let deal = dealsById.get(dealId);
      let clientId = deal?.clientId;
      if (!clientId) {
        try {
          const fetchedDeal = mergeDealWithHydratedQuotes(await fetchDeal(dealId), deal);
          deal = fetchedDeal;
          clientId = fetchedDeal.clientId;
          updateAppData((prev) => ({
            deals: prev.deals.some((item) => item.id === dealId)
              ? prev.deals
              : [fetchedDeal, ...prev.deals],
          }));
        } catch (err) {
          setError(formatErrorMessage(err, 'Ошибка при получении сделки'));
          throw err;
        }
      }

      try {
        let resolvedPolicyClientId = selectedPolicyClientId;
        const normalizedPolicyClientName = selectedPolicyClientName?.trim();
        if (!resolvedPolicyClientId && normalizedPolicyClientName) {
          const normalizedLower = normalizedPolicyClientName.toLowerCase();
          if (clientId && deal?.clientName?.toLowerCase() === normalizedLower) {
            resolvedPolicyClientId = clientId;
          } else {
            const matchedClient = clients.find(
              (client) => client.name.toLowerCase() === normalizedLower,
            );
            if (matchedClient) {
              resolvedPolicyClientId = matchedClient.id;
            } else {
              const createdClient = await createClient({ name: normalizedPolicyClientName });
              updateAppData((prev) => ({ clients: [createdClient, ...prev.clients] }));
              resolvedPolicyClientId = createdClient.id;
            }
          }
        }
        const created = await createPolicy({
          dealId,
          clientId: resolvedPolicyClientId || clientId,
          number,
          insuranceCompanyId,
          insuranceTypeId,
          isVehicle,
          salesChannelId,
          brand,
          model,
          vin,
          counterparty,
          note,
          startDate,
          endDate,
          sourceFileId,
          sourceFileIds: sourceFileIds.length ? sourceFileIds : undefined,
        });
        updateAppData((prev) => ({ policies: [created, ...prev.policies] }));
        const parsePolicyAmount = (value?: string | null) => {
          const parsed = parseNumericAmount(value ?? '');
          return Number.isFinite(parsed) ? parsed : 0;
        };
        let policyPaymentsTotal = parsePolicyAmount(created.paymentsTotal);
        let policyPaymentsPaid = parsePolicyAmount(created.paymentsPaid);
        const syncPolicyTotals = () => {
          updateAppData((prev) => ({
            policies: prev.policies.map((policy) =>
              policy.id === created.id
                ? {
                    ...policy,
                    paymentsTotal: formatAmountValue(policyPaymentsTotal),
                    paymentsPaid: formatAmountValue(policyPaymentsPaid),
                  }
                : policy,
            ),
          }));
        };

        const hasCounterparty = Boolean(counterparty?.trim());
        const executorName = deal?.executorName?.trim();
        const hasExecutor = Boolean(executorName);
        const ensureExpenses = hasCounterparty || hasExecutor;
        const expenseTargetName = counterparty?.trim() || executorName || 'контрагент';
        const expenseNote = `Расход контрагенту ${expenseTargetName}`;
        const salesChannelName = resolveSalesChannelName(salesChannels, salesChannelId);
        const autoIncomeNote = buildCommissionIncomeNote(salesChannelName);
        const paymentsToProcess = paymentDrafts.map((payment) =>
          normalizePaymentDraft(payment, ensureExpenses, {
            autoIncomeNote,
            autoExpenseNote: ensureExpenses ? expenseNote : undefined,
          }),
        );

        let dealPaymentsTotalDelta = 0;
        let dealPaymentsPaidDelta = 0;
        let paymentsCreated = 0;

        try {
          for (const paymentDraft of paymentsToProcess) {
            const amount = parseNumericAmount(paymentDraft.amount);
            if (!Number.isFinite(amount) || amount < 0) {
              continue;
            }

            const payment = await createPayment({
              dealId,
              policyId: created.id,
              amount,
              description: paymentDraft.description,
              scheduledDate: paymentDraft.scheduledDate || null,
              actualDate: paymentDraft.actualDate || null,
            });
            paymentsCreated += 1;
            const createdRecords: FinancialRecord[] = [];

            for (const income of paymentDraft.incomes) {
              const incomeAmount = parseNumericAmount(income.amount);
              if (!Number.isFinite(incomeAmount) || incomeAmount < 0) {
                continue;
              }

              const record = await createFinancialRecord({
                paymentId: payment.id,
                amount: incomeAmount,
                date: income.date || null,
                description: income.description,
                source: income.source,
                note: income.note,
              });
              createdRecords.push(record);
            }

            for (const expense of paymentDraft.expenses) {
              const expenseAmount = parseNumericAmount(expense.amount);
              if (!Number.isFinite(expenseAmount) || expenseAmount < 0) {
                continue;
              }

              const record = await createFinancialRecord({
                paymentId: payment.id,
                amount: -Math.abs(expenseAmount),
                date: expense.date || null,
                description: expense.description,
                source: expense.source,
                note: expense.note,
              });
              createdRecords.push(record);
            }

            const paymentWithRecords: Payment = {
              ...payment,
              financialRecords: createdRecords.length
                ? [...createdRecords, ...(payment.financialRecords ?? [])]
                : payment.financialRecords,
            };
            policyPaymentsTotal += amount;
            if (payment.actualDate) {
              policyPaymentsPaid += amount;
              dealPaymentsPaidDelta += amount;
            }
            dealPaymentsTotalDelta += amount;
            syncPolicyTotals();
            updateAppData((prev) => ({
              payments: [paymentWithRecords, ...prev.payments],
              financialRecords:
                createdRecords.length > 0
                  ? [...createdRecords, ...prev.financialRecords]
                  : prev.financialRecords,
            }));
          }
        } catch (err) {
          if (paymentsCreated === 0) {
            try {
              await deletePolicy(created.id);
              updateAppData((prev) => ({
                policies: prev.policies.filter((policy) => policy.id !== created.id),
              }));
            } catch (cleanupErr) {
              console.error('Failed to delete policy after payment failure', cleanupErr);
            }
          }
          throw err;
        }

        if (dealPaymentsTotalDelta || dealPaymentsPaidDelta) {
          updateAppData((prev) => ({
            deals: adjustPaymentsTotals(
              prev.deals,
              dealId,
              dealPaymentsTotalDelta,
              dealPaymentsPaidDelta,
            ),
          }));
        }

        let refreshFailed = false;
        try {
          const refreshedDeal = mergeDealWithHydratedQuotes(
            await fetchDeal(dealId),
            dealsById.get(dealId),
          );
          updateAppData((prev) => ({
            deals: prev.deals.some((currentDeal) => currentDeal.id === refreshedDeal.id)
              ? prev.deals.map((currentDeal) =>
                  currentDeal.id === refreshedDeal.id ? refreshedDeal : currentDeal,
                )
              : [refreshedDeal, ...prev.deals],
          }));
          selectDealById(refreshedDeal.id);
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
      adjustPaymentsTotals,
      clients,
      closePolicyModal,
      dealFilters,
      dealsById,
      invalidateDealPoliciesCache,
      invalidateDealsCache,
      loadDealPolicies,
      mergeDealWithHydratedQuotes,
      policySourceFileIds,
      refreshDealsWithSelection,
      salesChannels,
      selectDealById,
      setError,
      setIsSyncing,
      updateAppData,
    ],
  );

  const handleUpdatePolicy = useCallback(
    async (policyId: string, values: PolicyFormValues) => {
      setIsSyncing(true);
      invalidateDealsCache();
      try {
        const {
          number,
          insuranceCompanyId,
          insuranceTypeId,
          isVehicle,
          brand,
          model,
          vin,
          counterparty,
          note,
          salesChannelId,
          startDate,
          endDate,
          clientId: selectedPolicyClientId,
          clientName: selectedPolicyClientName,
          payments: paymentDrafts = [],
        } = values;

        const currentPolicy = policies.find((policy) => policy.id === policyId);
        if (!currentPolicy) {
          throw new Error('Не удалось найти полис для обновления.');
        }
        invalidateDealPoliciesCache(currentPolicy.dealId);

        const statementById = new Map(
          (statements ?? []).map((statement) => [statement.id, statement]),
        );
        const existingPayments = payments.filter(
          (payment) => payment.policyId === policyId && !payment.deletedAt,
        );
        const existingPaymentById = new Map(
          existingPayments.map((payment) => [payment.id, payment]),
        );
        const existingRecords = existingPayments
          .flatMap((payment) => payment.financialRecords ?? [])
          .filter((record) => !record.deletedAt);
        const existingRecordById = new Map(existingRecords.map((record) => [record.id, record]));

        const draftPaymentIds = new Set(
          paymentDrafts.map((draft) => draft.id).filter(Boolean) as string[],
        );
        const paymentsToDelete = existingPayments.filter(
          (payment) => !draftPaymentIds.has(payment.id),
        );

        const getRecordDraftIds = (draft: (typeof paymentDrafts)[number]) => {
          const ids: string[] = [];
          for (const income of draft.incomes ?? []) {
            if (income.id) ids.push(income.id);
          }
          for (const expense of draft.expenses ?? []) {
            if (expense.id) ids.push(expense.id);
          }
          return ids;
        };

        const isDraftStatementLinked = (recordId: string) => {
          const record = existingRecordById.get(recordId);
          if (!record?.statementId) {
            return false;
          }
          const statement = statementById.get(record.statementId);
          return Boolean(statement && !statement.paidAt);
        };

        for (const payment of paymentsToDelete) {
          const paymentRecords = existingRecords.filter(
            (record) => record.paymentId === payment.id,
          );
          const blocked = paymentRecords.find(
            (record) => record.statementId && isDraftStatementLinked(record.id),
          );
          if (blocked) {
            throw new Error('Сначала уберите запись из ведомости');
          }
        }
        for (const draft of paymentDrafts) {
          if (!draft.id) continue;
          const submittedRecordIds = new Set(getRecordDraftIds(draft));
          const paymentRecords = existingRecords.filter((record) => record.paymentId === draft.id);
          for (const record of paymentRecords) {
            if (!submittedRecordIds.has(record.id) && isDraftStatementLinked(record.id)) {
              throw new Error('Сначала уберите запись из ведомости');
            }
          }
        }

        let resolvedPolicyClientId = selectedPolicyClientId;
        const normalizedPolicyClientName = selectedPolicyClientName?.trim();
        if (!resolvedPolicyClientId && normalizedPolicyClientName) {
          const normalizedLower = normalizedPolicyClientName.toLowerCase();
          if (
            currentPolicy.clientId &&
            currentPolicy.clientName?.toLowerCase() === normalizedLower
          ) {
            resolvedPolicyClientId = currentPolicy.clientId;
          } else {
            const matchedClient = clients.find(
              (client) => client.name.toLowerCase() === normalizedLower,
            );
            if (matchedClient) {
              resolvedPolicyClientId = matchedClient.id;
            } else {
              const createdClient = await createClient({ name: normalizedPolicyClientName });
              updateAppData((prev) => ({ clients: [createdClient, ...prev.clients] }));
              resolvedPolicyClientId = createdClient.id;
            }
          }
        }
        const updated = await updatePolicy(policyId, {
          number,
          insuranceCompanyId,
          insuranceTypeId,
          isVehicle,
          brand,
          model,
          vin,
          counterparty,
          note,
          salesChannelId,
          startDate,
          endDate,
          clientId: resolvedPolicyClientId || currentPolicy.clientId,
        });
        updateAppData((prev) => ({
          policies: prev.policies.map((policy) => (policy.id === updated.id ? updated : policy)),
        }));

        const parsePaymentAmount = (value?: string | null) => {
          const parsed = parseNumericAmount(value ?? '');
          return Number.isFinite(parsed) ? parsed : 0;
        };

        const parseRecordAmount = (value: string | null | undefined, sign: 1 | -1) => {
          const parsed = parseNumericAmount(value ?? '');
          if (!Number.isFinite(parsed)) {
            return parsed;
          }
          const abs = Math.abs(parsed);
          return sign === -1 ? -abs : abs;
        };

        const affectedDealIds = new Set<string>();
        if (currentPolicy.dealId) {
          affectedDealIds.add(currentPolicy.dealId);
        }

        for (const payment of paymentsToDelete) {
          await deletePayment(payment.id);
          const paymentAmount = parseAmountValue(payment.amount);
          const paymentPaid = payment.actualDate ? paymentAmount : 0;
          updateAppData((prev) => ({
            payments: prev.payments.filter((item) => item.id !== payment.id),
            financialRecords: prev.financialRecords.filter(
              (record) => record.paymentId !== payment.id,
            ),
            policies: adjustPaymentsTotals(
              prev.policies,
              payment.policyId,
              -paymentAmount,
              -paymentPaid,
            ),
            deals: adjustPaymentsTotals(prev.deals, payment.dealId, -paymentAmount, -paymentPaid),
          }));
        }

        for (const draft of paymentDrafts) {
          const draftAmount = parsePaymentAmount(draft.amount);
          const draftScheduled = draft.scheduledDate ? draft.scheduledDate : null;
          const draftActual = draft.actualDate ? draft.actualDate : null;
          const draftDescription = draft.description ?? '';

          let paymentId = draft.id;
          let paymentEntity = paymentId ? existingPaymentById.get(paymentId) : undefined;

          if (paymentId) {
            const previousPayment = paymentEntity;
            if (previousPayment) {
              const previousAmount = parseAmountValue(previousPayment.amount);
              const previousPaid = previousPayment.actualDate ? previousAmount : 0;
              const nextPaid = draftActual ? draftAmount : 0;

              const needsUpdate =
                parseAmountValue(previousPayment.amount) !== draftAmount ||
                (previousPayment.description ?? '') !== draftDescription ||
                (previousPayment.scheduledDate ?? null) !== draftScheduled ||
                (previousPayment.actualDate ?? null) !== draftActual;

              if (needsUpdate) {
                const updatedPayment = await updatePayment(paymentId, {
                  policyId,
                  dealId: currentPolicy.dealId ?? undefined,
                  amount: draftAmount,
                  description: draftDescription,
                  scheduledDate: draftScheduled,
                  actualDate: draftActual,
                });

                updateAppData((prev) => ({
                  payments: prev.payments.map((payment) =>
                    payment.id === updatedPayment.id ? updatedPayment : payment,
                  ),
                  policies: adjustPaymentsTotals(
                    prev.policies,
                    policyId,
                    draftAmount - previousAmount,
                    nextPaid - previousPaid,
                  ),
                  deals: adjustPaymentsTotals(
                    prev.deals,
                    currentPolicy.dealId,
                    draftAmount - previousAmount,
                    nextPaid - previousPaid,
                  ),
                }));
                paymentEntity = updatedPayment;
              }
            }
          } else {
            const createdPayment = await createPayment({
              dealId: currentPolicy.dealId,
              policyId,
              amount: draftAmount,
              description: draftDescription,
              scheduledDate: draftScheduled,
              actualDate: draftActual,
            });
            paymentId = createdPayment.id;
            paymentEntity = createdPayment;

            const paidDelta = createdPayment.actualDate ? draftAmount : 0;
            updateAppData((prev) => ({
              payments: [createdPayment, ...prev.payments],
              policies: adjustPaymentsTotals(prev.policies, policyId, draftAmount, paidDelta),
              deals: adjustPaymentsTotals(prev.deals, currentPolicy.dealId, draftAmount, paidDelta),
            }));
          }

          if (!paymentId || !paymentEntity) {
            continue;
          }

          const paymentRecords = existingRecords.filter((record) => record.paymentId === paymentId);
          const submittedIncomeIds = new Set(
            (draft.incomes ?? []).map((record) => record.id).filter(Boolean) as string[],
          );
          const submittedExpenseIds = new Set(
            (draft.expenses ?? []).map((record) => record.id).filter(Boolean) as string[],
          );
          const submittedRecordIds = new Set([...submittedIncomeIds, ...submittedExpenseIds]);

          const recordsToDelete = paymentRecords.filter(
            (record) => !submittedRecordIds.has(record.id),
          );
          for (const record of recordsToDelete) {
            await deleteFinancialRecord(record.id);
            updateAppData((prev) => ({
              financialRecords: prev.financialRecords.filter((item) => item.id !== record.id),
              payments: prev.payments.map((payment) =>
                payment.id === record.paymentId
                  ? {
                      ...payment,
                      financialRecords: (payment.financialRecords ?? []).filter(
                        (item) => item.id !== record.id,
                      ),
                    }
                  : payment,
              ),
            }));
          }

          const updateOrCreateRecord = async (
            recordDraft: (typeof draft.incomes)[number],
            sign: 1 | -1,
          ) => {
            const amount = parseRecordAmount(recordDraft.amount, sign);
            if (!Number.isFinite(amount)) {
              return;
            }

            const payload = {
              amount,
              date: recordDraft.date ? recordDraft.date : null,
              description: recordDraft.description ?? '',
              source: recordDraft.source ?? '',
              note: recordDraft.note ?? '',
            };

            if (recordDraft.id) {
              const existing = existingRecordById.get(recordDraft.id);
              if (existing) {
                const existingAmount = parseNumericAmount(existing.amount ?? '');
                const existingDate = existing.date ?? null;
                const existingDescription = (existing.description ?? '').trim();
                const existingSource = (existing.source ?? '').trim();
                const existingNote = (existing.note ?? '').trim();

                const nextDescription = (payload.description ?? '').trim();
                const nextSource = (payload.source ?? '').trim();
                const nextNote = (payload.note ?? '').trim();

                const hasChanges =
                  (Number.isFinite(existingAmount) ? existingAmount : 0) !== payload.amount ||
                  (existingDate ?? null) !== (payload.date ?? null) ||
                  existingDescription !== nextDescription ||
                  existingSource !== nextSource ||
                  existingNote !== nextNote;

                if (!hasChanges) {
                  return;
                }

                const statement = existing.statementId
                  ? statementById.get(existing.statementId)
                  : undefined;
                if (statement?.paidAt) {
                  throw new Error('Нельзя изменять записи в выплаченной ведомости.');
                }
              }
              const updatedRecord = await updateFinancialRecord(recordDraft.id, payload);
              updateAppData((prev) => ({
                financialRecords: prev.financialRecords.map((record) =>
                  record.id === updatedRecord.id ? updatedRecord : record,
                ),
                payments: prev.payments.map((payment) =>
                  payment.id === updatedRecord.paymentId
                    ? {
                        ...payment,
                        financialRecords: (payment.financialRecords ?? []).map((record) =>
                          record.id === updatedRecord.id ? updatedRecord : record,
                        ),
                      }
                    : payment,
                ),
              }));
              return;
            }

            const createdRecord = await createFinancialRecord({
              paymentId,
              ...payload,
            });
            updateAppData((prev) => ({
              financialRecords: [createdRecord, ...prev.financialRecords],
              payments: prev.payments.map((payment) =>
                payment.id === createdRecord.paymentId
                  ? {
                      ...payment,
                      financialRecords: [...(payment.financialRecords ?? []), createdRecord],
                    }
                  : payment,
              ),
            }));
          };

          for (const income of draft.incomes ?? []) {
            await updateOrCreateRecord(income, 1);
          }
          for (const expense of draft.expenses ?? []) {
            await updateOrCreateRecord(expense, -1);
          }
        }

        if (affectedDealIds.size) {
          await syncDealsByIds(Array.from(affectedDealIds));
          await Promise.all(
            Array.from(affectedDealIds).map((dealId) => loadDealPolicies(dealId, { force: true })),
          );
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
      adjustPaymentsTotals,
      clients,
      invalidateDealPoliciesCache,
      invalidateDealsCache,
      loadDealPolicies,
      payments,
      policies,
      setError,
      setIsSyncing,
      statements,
      syncDealsByIds,
      updateAppData,
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

  return {
    policyDealId,
    policyPrefill,
    policyDefaultCounterparty,
    editingPolicy,
    setEditingPolicy,
    closePolicyModal,
    handlePolicyDraftReady,
    handleRequestAddPolicy,
    handleRequestEditPolicy,
    handleAddPolicy,
    handleUpdatePolicy,
    handleDeletePolicy,
    policyDealExecutorName: policyDealId
      ? (dealsById.get(policyDealId)?.executorName ?? null)
      : null,
    editingPolicyExecutorName: editingPolicy
      ? (dealsById.get(editingPolicy.dealId)?.executorName ?? null)
      : null,
  };
};
