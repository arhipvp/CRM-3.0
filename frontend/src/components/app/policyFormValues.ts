import type { FinancialRecord, Payment, Policy } from '../../types';
import type { PaymentDraft, PolicyFormValues } from '../forms/addPolicy/types';
import { sortPaymentDraftEntries } from '../forms/addPolicy/paymentDraftOrdering';
import { splitFinancialRecords } from './financialRecordDrafts';

const buildPaymentDraft = (payment: Payment, financialRecords: FinancialRecord[]): PaymentDraft => {
  const records =
    payment.financialRecords ??
    financialRecords.filter((record) => record.paymentId === payment.id);
  const { incomes, expenses } = splitFinancialRecords(records);
  return {
    id: payment.id,
    amount: payment.amount,
    description: payment.description,
    scheduledDate: payment.scheduledDate ?? '',
    actualDate: payment.actualDate ?? '',
    incomes,
    expenses,
  };
};

export const buildPolicyFormValues = (
  policy: Policy,
  payments: Payment[],
  financialRecords: FinancialRecord[],
  dealPolicies: Policy[],
): PolicyFormValues => ({
  number: policy.number,
  insuranceCompanyId: policy.insuranceCompanyId,
  insuranceTypeId: policy.insuranceTypeId,
  isVehicle: policy.isVehicle,
  brand: policy.brand,
  model: policy.model,
  vin: policy.vin,
  counterparty: policy.counterparty,
  note: policy.note,
  salesChannelId: policy.salesChannelId,
  renewedById: policy.renewedById ?? null,
  renewsPolicyId: dealPolicies.find((candidate) => candidate.renewedById === policy.id)?.id ?? null,
  startDate: policy.startDate,
  endDate: policy.endDate,
  clientId: policy.clientId ?? policy.insuredClientId,
  clientName: policy.clientName ?? policy.insuredClientName,
  payments: sortPaymentDraftEntries(
    payments.map((payment) => buildPaymentDraft(payment, financialRecords)),
  ).map((entry) => entry.payment),
});
