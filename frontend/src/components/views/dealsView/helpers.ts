import type { DealStatus, FinancialRecord, Payment, Policy, PolicyRecognitionResult } from '../../../types';

const DATE_FORMATTER = new Intl.DateTimeFormat('ru-RU', {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
});

export const statusLabels: Record<DealStatus, string> = {
  open: 'В работе',
  won: 'Выиграна',
  lost: 'Закрыта (проигрыш)',
  on_hold: 'На паузе',
};

export const closedDealStatuses: DealStatus[] = ['won', 'lost'];

export const DEAL_TABS = [
  { id: 'overview', label: 'Обзор' },
  { id: 'tasks', label: 'Задачи' },
  { id: 'quotes', label: 'Расчёты' },
  { id: 'policies', label: 'Полисы' },
  { id: 'chat', label: 'Чат' },
  { id: 'files', label: 'Файлы' },
  { id: 'history', label: 'История' },
] as const;

export type DealTabId = (typeof DEAL_TABS)[number]['id'];

export const formatDate = (value?: string | null) => {
  if (!value) {
    return '—';
  }
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return '—';
  }
  return DATE_FORMATTER.format(parsed);
};

export const formatDateTime = (value?: string | null) => {
  if (!value) {
    return '—';
  }
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return '—';
  }
  return parsed.toLocaleString('ru-RU');
};

export const QUICK_NEXT_CONTACT_OPTIONS = [
  { label: 'Завтра', days: 1 },
  { label: 'Через 2 дня', days: 2 },
  { label: 'Неделя', days: 7 },
] as const;

export const getDatePlusDays = (days: number) => {
  const target = new Date();
  target.setDate(target.getDate() + days);
  const year = target.getFullYear();
  const month = String(target.getMonth() + 1).padStart(2, '0');
  const day = String(target.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

export const getDeadlineTone = (value?: string | null) => {
  if (!value) {
    return 'text-slate-400';
  }
  const today = new Date();
  const deadline = new Date(value);
  const diffDays = Math.ceil((deadline.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

  if (diffDays <= 0) {
    return 'text-red-700';
  }
  if (diffDays <= 3) {
    return 'text-red-600';
  }
  if (diffDays <= 7) {
    return 'text-orange-600';
  }
  if (diffDays <= 14) {
    return 'text-orange-500';
  }
  return 'text-slate-500';
};

export const formatCurrency = (value?: string) => {
  const amount = Number(value ?? 0);
  return amount.toLocaleString('ru-RU', { style: 'currency', currency: 'RUB' });
};

export const formatDriveDate = (value?: string | null) => {
  if (!value) {
    return '—';
  }
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return '—';
  }
  return parsed.toLocaleString('ru-RU');
};

export const formatDriveFileSize = (bytes?: number | null) => {
  if (bytes === undefined || bytes === null) {
    return '-';
  }
  if (bytes === 0) {
    return '0 Б';
  }
  const k = 1024;
  const sizes = ['Б', 'КБ', 'МБ', 'ГБ'];
  const i = Math.min(
    Math.floor(Math.log(bytes) / Math.log(k)),
    sizes.length - 1
  );
  return `${(bytes / Math.pow(k, i)).toFixed(1).replace(/\.0$/, '')} ${sizes[i]}`;
};

export const formatDeletedAt = (value?: string | null) => {
  if (!value) {
    return '—';
  }
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return '—';
  }
  return parsed.toLocaleString('ru-RU');
};

export const getUserDisplayName = (user: { firstName?: string | null; lastName?: string | null; username: string }) => {
  const fullName = [user.firstName, user.lastName].filter(Boolean).join(' ').trim();
  return fullName || user.username;
};

export const getDriveItemIcon = (isFolder: boolean) => (isFolder ? '📁' : '📄');

export type PolicySortKey =
  | 'number'
  | 'insuranceCompany'
  | 'insuranceType'
  | 'client'
  | 'salesChannel'
  | 'startDate'
  | 'endDate'
  | 'transport';

export const getPolicyTransportSummary = (policy: Policy) =>
  policy.isVehicle
    ? `${policy.brand || '—'} / ${policy.model || '—'} / ${policy.vin || '—'}`
    : 'Без транспорта';

export const getPolicySortValue = (policy: Policy, key: PolicySortKey) => {
  switch (key) {
    case 'number':
      return policy.number ?? '';
    case 'insuranceCompany':
      return policy.insuranceCompany ?? '';
    case 'insuranceType':
      return policy.insuranceType ?? '';
    case 'client':
      return (
        policy.insuredClientName ??
        policy.clientName ??
        policy.clientId ??
        ''
      );
    case 'salesChannel':
      return policy.salesChannelName ?? policy.salesChannel ?? '';
    case 'startDate':
      return policy.startDate ? new Date(policy.startDate).getTime() : 0;
    case 'endDate':
      return policy.endDate ? new Date(policy.endDate).getTime() : 0;
    case 'transport':
      return getPolicyTransportSummary(policy);
    default:
      return '';
  }
};

export const formatRecognitionSummary = (result: PolicyRecognitionResult) => {
  if (result.status === 'parsed') {
    return 'Полис распознан, можно перейти к заполнению.';
  }
  return result.message ?? 'Ошибка при распознавании полиса';
};

const isPaymentDeleted = (payment: Payment) => Boolean(payment.deletedAt);
const isRecordDeleted = (record: FinancialRecord) => Boolean(record.deletedAt);
const hasPaymentBeenPaid = (payment: Payment) => Boolean((payment.actualDate ?? '').trim());
const hasRecordBeenPaid = (record: FinancialRecord) => Boolean((record.date ?? '').trim());

export const getPaymentFinancialRecords = (payment: Payment, allFinancialRecords: FinancialRecord[]) => {
  if (payment.financialRecords && payment.financialRecords.length > 0) {
    return payment.financialRecords;
  }
  return allFinancialRecords.filter((record) => record.paymentId === payment.id);
};

export const hasUnpaidFinancialActivity = (
  payment: Payment,
  allFinancialRecords: FinancialRecord[]
) => {
  if (isPaymentDeleted(payment)) {
    return false;
  }
  if (!hasPaymentBeenPaid(payment)) {
    return true;
  }
  const records = getPaymentFinancialRecords(payment, allFinancialRecords);
  return records.some((record) => !isRecordDeleted(record) && !hasRecordBeenPaid(record));
};

export const policyHasUnpaidActivity = (
  policyId: string,
  paymentsByPolicyMap: Map<string, Payment[]>,
  allFinancialRecords: FinancialRecord[]
) => {
  const policyPayments = paymentsByPolicyMap.get(policyId) ?? [];
  return policyPayments.some((payment) => hasUnpaidFinancialActivity(payment, allFinancialRecords));
};
