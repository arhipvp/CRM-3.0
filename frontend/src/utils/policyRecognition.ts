import type { PolicyFormValues } from '../components/forms/addPolicy/types';

const pickRecognitionValue = (
  parsed: Record<string, unknown>,
  policy: Record<string, unknown>,
  keys: string[]
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

export const buildPolicyDraftFromRecognition = (parsed: Record<string, unknown>): PolicyFormValues => {
  const policyData = (parsed.policy ?? {}) as Record<string, unknown>;
  return {
    number: normalizeStringValue(
      pickRecognitionValue(parsed, policyData, ['number', 'policy_number', 'policyNumber'])
    ),
    insuranceCompanyId: '',
    insuranceTypeId: '',
    isVehicle: parseBooleanValue(
      pickRecognitionValue(parsed, policyData, ['is_vehicle', 'vehicle', 'transport'])
    ),
    brand: normalizeStringValue(pickRecognitionValue(parsed, policyData, ['brand'])),
    model: normalizeStringValue(pickRecognitionValue(parsed, policyData, ['model'])),
    vin: normalizeStringValue(pickRecognitionValue(parsed, policyData, ['vin'])),
    counterparty: normalizeStringValue(
      pickRecognitionValue(parsed, policyData, ['counterparty', 'contractor', 'seller'])
    ),
    salesChannelId: '',
    startDate: toOptionalString(
      pickRecognitionValue(parsed, policyData, ['start_date', 'startDate', 'begin_date'])
    ),
    endDate: toOptionalString(
      pickRecognitionValue(parsed, policyData, ['end_date', 'endDate', 'finish_date'])
    ),
    payments: [],
    insuredClientId: '',
    insuredClientName: toOptionalString(
      pickRecognitionValue(parsed, policyData, [
        'insured_client_name',
        'insuredClientName',
        'client_name',
        'clientName',
      ])
    ),
  };
};
