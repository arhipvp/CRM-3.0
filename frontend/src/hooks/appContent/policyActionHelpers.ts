import type { PolicyFormValues } from '../../components/forms/addPolicy/types';
import type { Client, FinancialRecord, SalesChannel } from '../../types';
import { formatAmountValue, matchSalesChannel } from '../../utils/appContent';
import {
  buildCommissionIncomeNote,
  shouldAutofillCommissionNote,
} from '../../utils/financialRecordNotes';
import {
  buildPolicyDraftFromRecognition,
  normalizeStringValue,
} from '../../utils/policyRecognition';
import { parseNumericAmount } from '../../utils/parseNumericAmount';

export type FinancialRecordUpdateDraft = {
  amount: number;
  date: string | null;
  description: string;
  source: string;
  note: string;
};

export type PolicyRecognitionDraft = {
  values: PolicyFormValues;
  insuranceCompanyName?: string;
  insuranceTypeName?: string;
  sourceFileIds: string[];
};

export const normalizeFinancialRecordText = (value?: string | null) => (value ?? '').trim();

export const buildFinancialRecordUpdateDraft = (
  record: Pick<FinancialRecord, 'amount' | 'date' | 'description' | 'source' | 'note'>,
): FinancialRecordUpdateDraft => ({
  amount: Number.isFinite(parseNumericAmount(record.amount ?? ''))
    ? parseNumericAmount(record.amount ?? '')
    : 0,
  date: record.date ?? null,
  description: normalizeFinancialRecordText(record.description),
  source: normalizeFinancialRecordText(record.source),
  note: normalizeFinancialRecordText(record.note),
});

export const hasFinancialRecordDraftChanges = (
  existing: Pick<FinancialRecord, 'amount' | 'date' | 'description' | 'source' | 'note'>,
  next: FinancialRecordUpdateDraft,
) => {
  const normalizedExisting = buildFinancialRecordUpdateDraft(existing);
  return (
    normalizedExisting.amount !== next.amount ||
    normalizedExisting.date !== next.date ||
    normalizedExisting.description !== next.description ||
    normalizedExisting.source !== next.source ||
    normalizedExisting.note !== next.note
  );
};

export const parsePolicyAmount = (value?: string | null) => {
  const parsed = parseNumericAmount(value ?? '');
  return Number.isFinite(parsed) ? parsed : 0;
};

export const formatPolicyAmount = formatAmountValue;

export const parsePolicyRecordAmount = (value: string | null | undefined, sign: 1 | -1) => {
  const parsed = parseNumericAmount(value ?? '');
  if (!Number.isFinite(parsed)) {
    return parsed;
  }
  const abs = Math.abs(parsed);
  return sign === -1 ? -abs : abs;
};

export const buildPolicyRecognitionDraft = ({
  parsed,
  clients,
  salesChannels,
  fileId,
  parsedFileIds,
}: {
  parsed: Record<string, unknown>;
  clients: Client[];
  salesChannels: SalesChannel[];
  fileId?: string | null;
  parsedFileIds?: string[];
}): PolicyRecognitionDraft | null => {
  if (!parsed) {
    return null;
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
  const recognizedInsuranceType = normalizeStringValue(
    policyObj.insurance_type ??
      policyObj.insuranceType ??
      parsed.insurance_type ??
      parsed.insuranceType,
  );
  const sourceFileIds = parsedFileIds?.length
    ? Array.from(new Set(parsedFileIds.filter((id): id is string => Boolean(id))))
    : fileId
      ? [fileId]
      : [];

  return {
    values: {
      ...draft,
      salesChannelId: matchedChannel?.id,
      payments: paymentsWithNotes,
      clientId: matchedPolicyClient?.id ?? undefined,
      clientName: matchedPolicyClient?.name ?? (recognizedPolicyClientName || undefined),
    },
    insuranceCompanyName: normalizeStringValue(policyObj.insurance_company),
    insuranceTypeName: recognizedInsuranceType,
    sourceFileIds,
  };
};
