import type { Payment, Policy } from '../../types';
import { formatCurrency, formatDate } from '../views/dealsView/helpers';
import { POLICY_PLACEHOLDER } from './text';

const fallback = (value?: string | null, empty = POLICY_PLACEHOLDER) =>
  value && value.trim() ? value : empty;

const describeCount = (count: number, one: string, many: string) =>
  count === 1 ? `${count} ${one}` : `${count} ${many}`;

const isCascoTypeName = (value?: string | null) => {
  const normalized = (value ?? '').toLowerCase().replace(/[^\p{L}\p{N}]/gu, '');
  return normalized.includes('каско') || normalized.includes('casco');
};

const formatNullableBoolean = (value?: boolean | null) => {
  if (value === null || value === undefined) {
    return POLICY_PLACEHOLDER;
  }
  return value ? 'Да' : 'Нет';
};

export interface PolicyCardModel {
  number: string;
  startDate: string;
  endDate: string;
  client: string;
  insuranceCompany: string;
  salesChannel: string;
  sum: string;
  insuranceType: string;
  brand: string;
  model: string;
  vin: string;
  deductible: string;
  officialDealer: string;
  gap: string;
  hasCascoDetails: boolean;
  note: string;
  paymentsCount: number;
  paymentsCountLabel: string;
  dealId: string;
  clientId: string | null;
}

export const buildPolicyCardModel = (policy: Policy, payments: Payment[]): PolicyCardModel => {
  const paymentsCount = payments.length;
  const isCasco = isCascoTypeName(policy.insuranceType);
  const hasCascoDetails = isCasco
    ? policy.deductible != null || policy.officialDealer != null || policy.gap != null
    : false;
  return {
    number: fallback(policy.number),
    startDate: formatDate(policy.startDate),
    endDate: formatDate(policy.endDate),
    client: fallback(policy.clientName ?? policy.insuredClientName),
    insuranceCompany: fallback(policy.insuranceCompany),
    salesChannel: fallback(policy.salesChannelName ?? policy.salesChannel),
    sum: `${formatCurrency(policy.paymentsPaid)} / ${formatCurrency(policy.paymentsTotal)}`,
    insuranceType: fallback(policy.insuranceType),
    brand: fallback(policy.brand),
    model: fallback(policy.model),
    vin: fallback(policy.vin),
    deductible: formatCurrency(String(policy.deductible ?? 0)),
    officialDealer: formatNullableBoolean(policy.officialDealer),
    gap: formatNullableBoolean(policy.gap),
    hasCascoDetails,
    note: fallback(policy.note, 'Без примечания'),
    paymentsCount,
    paymentsCountLabel: describeCount(paymentsCount, 'запись', 'записей'),
    dealId: policy.dealId,
    clientId: policy.clientId ?? policy.insuredClientId ?? null,
  };
};
