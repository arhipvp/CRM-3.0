import { createEmptyRecord } from '../components/forms/addPolicy/types';
import type { PaymentDraft, PolicyFormValues } from '../components/forms/addPolicy/types';

const pickRecognitionValue = (
  parsed: Record<string, unknown>,
  policy: Record<string, unknown>,
  keys: string[],
): unknown => {
  for (const key of keys) {
    const policyValue = policy[key];
    if (policyValue !== undefined && policyValue !== null) {
      return policyValue;
    }
    const rootValue = parsed[key];
    if (rootValue !== undefined && rootValue !== null) {
      return rootValue;
    }
  }
  return undefined;
};

export const normalizeStringValue = (value?: unknown): string => {
  if (value === undefined || value === null) {
    return '';
  }
  if (typeof value === 'string') {
    return value.trim();
  }
  if (typeof value === 'number' && Number.isFinite(value)) {
    return String(value);
  }
  if (typeof value === 'boolean') {
    return value ? 'true' : 'false';
  }
  return '';
};

const toOptionalString = (value?: unknown): string | undefined => {
  const normalized = normalizeStringValue(value);
  return normalized ? normalized : undefined;
};

const parseBooleanValue = (value?: unknown): boolean => {
  if (typeof value === 'boolean') {
    return value;
  }
  if (typeof value === 'number') {
    return value !== 0;
  }
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    return ['1', 'true', 'yes', 'vehicle', 'car'].includes(normalized);
  }
  return false;
};

const normalizePaymentAmount = (value?: unknown): string => {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value.toString();
  }
  if (typeof value === 'string') {
    const cleaned = value.replace(/[^\d.,-]/g, '').replace(',', '.');
    const parsed = parseFloat(cleaned);
    if (!Number.isNaN(parsed)) {
      return parsed.toString();
    }
  }
  return '';
};

const normalizeDateValue = (value?: unknown): string => {
  if (!value) {
    return '';
  }
  if (value instanceof Date) {
    return value.toISOString().split('T')[0];
  }
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
      return trimmed;
    }
    const calendarMatch = trimmed.match(/(\d{1,2})[./-](\d{1,2})[./-](\d{2,4})/);
    if (calendarMatch) {
      const [, day, month, yearRaw] = calendarMatch;
      const year = yearRaw.length === 2 ? `20${yearRaw}` : yearRaw;
      const paddedMonth = month.padStart(2, '0');
      const paddedDay = day.padStart(2, '0');
      return `${year}-${paddedMonth}-${paddedDay}`;
    }
    const parsed = new Date(trimmed.replace(/,.*$/, ''));
    if (!Number.isNaN(parsed.getTime())) {
      return parsed.toISOString().split('T')[0];
    }
  }
  return '';
};

const buildPaymentDraft = (entry: Record<string, unknown>): PaymentDraft => {
  const amount = normalizePaymentAmount(
    entry.amount ??
      entry.payment_amount ??
      entry.sum ??
      entry.value ??
      entry.total ??
      entry.premium,
  );
  const scheduledDate =
    normalizeDateValue(entry.payment_date ?? entry.scheduledDate ?? entry.scheduled_date) ||
    normalizeDateValue(entry.date);
  const description = normalizeStringValue(entry.description ?? entry.note ?? entry.details);
  return {
    amount: amount || '0',
    description,
    scheduledDate: scheduledDate || '',
    actualDate: '',
    incomes: [
      {
        ...createEmptyRecord(),
        amount: '1',
        date: '',
      },
    ],
    expenses: [],
  };
};

const buildPaymentDrafts = (
  parsed: Record<string, unknown>,
  policyData: Record<string, unknown>,
): PaymentDraft[] => {
  const rawPayments = parsed.payments ?? policyData.payments;
  if (!Array.isArray(rawPayments) || rawPayments.length === 0) {
    return [];
  }
  return rawPayments
    .map((entry) => (typeof entry === 'object' && entry !== null ? entry : {}))
    .map((entry) => buildPaymentDraft(entry as Record<string, unknown>));
};

export const buildPolicyDraftFromRecognition = (
  parsed: Record<string, unknown>,
): PolicyFormValues => {
  const policyData = (parsed.policy ?? {}) as Record<string, unknown>;
  const vehicleBrand = normalizeStringValue(
    pickRecognitionValue(parsed, policyData, ['brand', 'vehicle_brand', 'make']),
  );
  const vehicleModel = normalizeStringValue(
    pickRecognitionValue(parsed, policyData, ['model', 'vehicle_model', 'type']),
  );
  const vehicleVin = normalizeStringValue(
    pickRecognitionValue(parsed, policyData, ['vin', 'vehicle_vin', 'vehicleIdentificationNumber']),
  );
  const hasVehicleInfo = Boolean(vehicleBrand || vehicleModel || vehicleVin);
  return {
    number: normalizeStringValue(
      pickRecognitionValue(parsed, policyData, ['number', 'policy_number', 'policyNumber']),
    ),
    insuranceCompanyId: '',
    insuranceTypeId: '',
    isVehicle:
      parseBooleanValue(
        pickRecognitionValue(parsed, policyData, ['is_vehicle', 'vehicle', 'transport']),
      ) || hasVehicleInfo,
    brand: vehicleBrand,
    model: vehicleModel,
    vin: vehicleVin,
    counterparty: normalizeStringValue(
      pickRecognitionValue(parsed, policyData, ['counterparty', 'contractor', 'seller']),
    ),
    salesChannelId: '',
    startDate: toOptionalString(
      pickRecognitionValue(parsed, policyData, ['start_date', 'startDate', 'begin_date']),
    ),
    endDate: toOptionalString(
      pickRecognitionValue(parsed, policyData, ['end_date', 'endDate', 'finish_date']),
    ),
    payments: buildPaymentDrafts(parsed, policyData),
    insuredClientId: '',
    insuredClientName: toOptionalString(
      pickRecognitionValue(parsed, policyData, [
        'insured_client_name',
        'insuredClientName',
        'client_name',
        'clientName',
      ]),
    ),
  };
};
