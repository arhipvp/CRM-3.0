import type { Payment, Policy } from '../../types';
import { formatCurrency, formatDate } from '../views/dealsView/helpers';
import { POLICY_PLACEHOLDER } from './text';
import { normalizePolicyStatusLabel } from './policyStatus';

const fallback = (value?: string | null, empty = POLICY_PLACEHOLDER) =>
  value && value.trim() ? value : empty;

const describeCount = (count: number, one: string, many: string) =>
  count === 1 ? `${count} ${one}` : `${count} ${many}`;

export interface PolicyCardModel {
  number: string;
  startDate: string;
  endDate: string;
  statusRaw: string;
  statusLabel: string;
  client: string;
  insuranceCompany: string;
  salesChannel: string;
  sum: string;
  insuranceType: string;
  brand: string;
  model: string;
  vin: string;
  paymentsCount: number;
  paymentsCountLabel: string;
  dealId: string;
  clientId: string | null;
}

export const buildPolicyCardModel = (policy: Policy, payments: Payment[]): PolicyCardModel => {
  const paymentsCount = payments.length;
  const statusRaw = (policy.status ?? '').trim();
  return {
    number: fallback(policy.number),
    startDate: formatDate(policy.startDate),
    endDate: formatDate(policy.endDate),
    statusRaw,
    statusLabel: statusRaw ? normalizePolicyStatusLabel(statusRaw) : POLICY_PLACEHOLDER,
    client: fallback(policy.insuredClientName ?? policy.clientName),
    insuranceCompany: fallback(policy.insuranceCompany),
    salesChannel: fallback(policy.salesChannel),
    sum: `${formatCurrency(policy.paymentsPaid)} / ${formatCurrency(policy.paymentsTotal)}`,
    insuranceType: fallback(policy.insuranceType),
    brand: fallback(policy.brand),
    model: fallback(policy.model),
    vin: fallback(policy.vin),
    paymentsCount,
    paymentsCountLabel: describeCount(paymentsCount, 'запись', 'записей'),
    dealId: policy.dealId,
    clientId: policy.insuredClientId ?? policy.clientId ?? null,
  };
};
