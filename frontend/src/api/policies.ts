import type {
  Payment,
  PoliciesKPI,
  Policy,
  PolicyRecognitionResult,
  SellerDashboardResponse,
} from '../types';
import { request } from './request';
import {
  buildQueryString,
  FilterParams,
  PaginatedResponse,
  toNullableString,
  toOptionalString,
  toStringValue,
  unwrapList,
} from './helpers';
import { mapPayment, mapPolicy } from './mappers';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const POLICY_DRAFT_ID_LABELS = {
  dealId: 'Сделка',
  insuranceCompanyId: 'Страховая компания',
  insuranceTypeId: 'Тип страхования',
  clientId: 'Страхователь',
  salesChannelId: 'Канал продаж',
  policyId: 'Полис',
  paymentId: 'Платёж',
  financialRecordId: 'Финансовая запись',
};

const assertUuid = (value: string | undefined | null, label: string, required = false) => {
  const normalized = value?.trim();
  if (!normalized) {
    if (required) {
      throw new Error(`${label}: укажите значение.`);
    }
    return;
  }
  if (!UUID_PATTERN.test(normalized)) {
    throw new Error(`${label}: должен быть корректным UUID.`);
  }
};

const validatePolicyDraftPayload = (
  data: PolicyDraftPayload,
  options: { requireDeal: boolean },
) => {
  assertUuid(data.dealId, POLICY_DRAFT_ID_LABELS.dealId, options.requireDeal);
  assertUuid(data.insuranceCompanyId, POLICY_DRAFT_ID_LABELS.insuranceCompanyId, true);
  assertUuid(data.insuranceTypeId, POLICY_DRAFT_ID_LABELS.insuranceTypeId, true);
  assertUuid(data.clientId, POLICY_DRAFT_ID_LABELS.clientId);
  assertUuid(data.salesChannelId, POLICY_DRAFT_ID_LABELS.salesChannelId);

  (data.payments ?? []).forEach((payment) => {
    assertUuid(payment.id, POLICY_DRAFT_ID_LABELS.paymentId);
    [...(payment.incomes ?? []), ...(payment.expenses ?? [])].forEach((record) => {
      assertUuid(record.id, POLICY_DRAFT_ID_LABELS.financialRecordId);
    });
  });
};

export async function fetchPolicies(filters?: FilterParams): Promise<Policy[]> {
  const qs = buildQueryString(filters);
  const payload = await request(`/policies/${qs}`);
  return unwrapList<Record<string, unknown>>(payload).map(mapPolicy);
}

export async function fetchPolicy(id: string): Promise<Policy> {
  const payload = await request<Record<string, unknown>>(`/policies/${id}/`);
  return mapPolicy(payload);
}

export async function fetchPoliciesWithPagination(
  filters?: FilterParams,
): Promise<PaginatedResponse<Policy>> {
  const qs = buildQueryString(filters);
  const payload = await request<PaginatedResponse<Record<string, unknown>>>(`/policies/${qs}`);
  return {
    count: payload.count || 0,
    next: payload.next || null,
    previous: payload.previous || null,
    results: unwrapList<Record<string, unknown>>(payload).map(mapPolicy),
  };
}

export async function createPolicy(data: {
  dealId: string;
  number: string;
  insuranceCompanyId: string;
  insuranceTypeId: string;
  clientId?: string;
  isVehicle: boolean;
  brand?: string;
  model?: string;
  vin?: string;
  deductible?: number | null;
  officialDealer?: boolean | null;
  gap?: boolean | null;
  counterparty?: string;
  note?: string;
  salesChannelId?: string;
  startDate?: string | null;
  endDate?: string | null;
  sourceFileId?: string | null;
  sourceFileIds?: string[];
}): Promise<Policy> {
  const bodyPayload: Record<string, unknown> = {
    deal: data.dealId,
    number: data.number,
    insurance_company: data.insuranceCompanyId,
    insurance_type: data.insuranceTypeId,
    is_vehicle: data.isVehicle,
    brand: data.brand || '',
    model: data.model || '',
    vin: data.vin || '',
    deductible: data.deductible ?? 0,
    official_dealer: data.officialDealer ?? null,
    gap: data.gap ?? null,
    counterparty: data.counterparty || '',
    note: data.note || '',
    sales_channel: data.salesChannelId || null,
    start_date: data.startDate || null,
    end_date: data.endDate || null,
    client: data.clientId || null,
  };
  if (data.sourceFileId) {
    bodyPayload.source_file_id = data.sourceFileId;
  }
  if (data.sourceFileIds && data.sourceFileIds.length) {
    bodyPayload.source_file_ids = data.sourceFileIds;
  }
  const payload = await request<Record<string, unknown>>('/policies/', {
    method: 'POST',
    body: JSON.stringify(bodyPayload),
  });
  return mapPolicy(payload);
}

interface PolicyDraftFinancialRecordPayload {
  id?: string;
  amount: string | number;
  date?: string | null;
  description?: string;
  source?: string;
  note?: string;
}

interface PolicyDraftPaymentPayload {
  id?: string;
  amount: string | number;
  description?: string;
  scheduledDate?: string | null;
  actualDate?: string | null;
  incomes?: PolicyDraftFinancialRecordPayload[];
  expenses?: PolicyDraftFinancialRecordPayload[];
}

interface PolicyDraftPayload {
  dealId?: string;
  number: string;
  insuranceCompanyId: string;
  insuranceTypeId: string;
  clientId?: string;
  clientName?: string;
  isVehicle: boolean;
  brand?: string;
  model?: string;
  vin?: string;
  deductible?: number | null;
  officialDealer?: boolean | null;
  gap?: boolean | null;
  counterparty?: string;
  note?: string;
  salesChannelId?: string;
  startDate?: string | null;
  endDate?: string | null;
  sourceFileId?: string | null;
  sourceFileIds?: string[];
  payments?: PolicyDraftPaymentPayload[];
}

export interface PolicyDraftSaveResult {
  policy: Policy;
  payments: Payment[];
}

const mapDraftRecord = (record: PolicyDraftFinancialRecordPayload) => ({
  id: record.id,
  amount: record.amount,
  date: record.date || null,
  description: record.description || '',
  source: record.source || '',
  note: record.note || '',
});

const buildPolicyDraftBody = (data: PolicyDraftPayload): Record<string, unknown> => {
  const bodyPayload: Record<string, unknown> = {
    number: data.number,
    insurance_company: data.insuranceCompanyId,
    insurance_type: data.insuranceTypeId,
    is_vehicle: data.isVehicle,
    brand: data.brand || '',
    model: data.model || '',
    vin: data.vin || '',
    deductible: data.deductible ?? 0,
    official_dealer: data.officialDealer ?? null,
    gap: data.gap ?? null,
    counterparty: data.counterparty || '',
    note: data.note || '',
    sales_channel: data.salesChannelId || null,
    start_date: data.startDate || null,
    end_date: data.endDate || null,
    client: data.clientId || null,
    client_name: data.clientName || '',
    payments: (data.payments ?? []).map((payment) => ({
      id: payment.id,
      amount: payment.amount,
      description: payment.description || '',
      scheduled_date: payment.scheduledDate || null,
      actual_date: payment.actualDate || null,
      incomes: (payment.incomes ?? []).map(mapDraftRecord),
      expenses: (payment.expenses ?? []).map(mapDraftRecord),
    })),
  };
  if (data.dealId) {
    bodyPayload.deal = data.dealId;
  }
  if (data.sourceFileId) {
    bodyPayload.source_file_id = data.sourceFileId;
  }
  if (data.sourceFileIds && data.sourceFileIds.length) {
    bodyPayload.source_file_ids = data.sourceFileIds;
  }
  return bodyPayload;
};

const mapPolicyDraftSaveResult = (payload: Record<string, unknown>): PolicyDraftSaveResult => ({
  policy: mapPolicy((payload.policy ?? payload) as Record<string, unknown>),
  payments: Array.isArray(payload.payments)
    ? (payload.payments as Record<string, unknown>[]).map(mapPayment)
    : [],
});

export async function createPolicyDraft(data: PolicyDraftPayload): Promise<PolicyDraftSaveResult> {
  validatePolicyDraftPayload(data, { requireDeal: true });
  const payload = await request<Record<string, unknown>>('/policies/draft/', {
    method: 'POST',
    body: JSON.stringify(buildPolicyDraftBody(data)),
  });
  return mapPolicyDraftSaveResult(payload);
}

export async function updatePolicyDraft(
  id: string,
  data: PolicyDraftPayload,
): Promise<PolicyDraftSaveResult> {
  assertUuid(id, POLICY_DRAFT_ID_LABELS.policyId, true);
  validatePolicyDraftPayload(data, { requireDeal: false });
  const payload = await request<Record<string, unknown>>(`/policies/${id}/draft/`, {
    method: 'PATCH',
    body: JSON.stringify(buildPolicyDraftBody(data)),
  });
  return mapPolicyDraftSaveResult(payload);
}

export async function deletePolicy(id: string): Promise<void> {
  await request(`/policies/${id}/`, { method: 'DELETE' });
}

export async function recognizeDealPolicies(
  dealId: string,
  fileIds: string[],
): Promise<{ results: PolicyRecognitionResult[] }> {
  const payload = await request<{ results?: unknown[] }>('/policies/recognize/', {
    method: 'POST',
    body: JSON.stringify({ deal_id: dealId, file_ids: fileIds }),
  });
  const rawResults = Array.isArray(payload?.results)
    ? (payload.results as Record<string, unknown>[])
    : [];
  return {
    results: rawResults.map((raw) => {
      const item = raw as Record<string, unknown>;
      const statusValue = toStringValue(item.status ?? item.state);
      return {
        fileId: toStringValue(item.fileId ?? item.file_id),
        fileName: toNullableString(item.fileName ?? item.file_name),
        status: statusValue === 'parsed' ? 'parsed' : statusValue === 'exists' ? 'exists' : 'error',
        message: toOptionalString(item.message),
        transcript: toNullableString(item.transcript ?? item.transcript_text),
        data:
          typeof item.data === 'object' && item.data !== null
            ? (item.data as Record<string, unknown>)
            : undefined,
      };
    }),
  };
}

export async function fetchVehicleBrands(): Promise<string[]> {
  const payload = await request('/policies/vehicle-brands/');
  return unwrapList<string>(payload);
}

export async function fetchVehicleModels(brand?: string): Promise<string[]> {
  const query = brand ? `?brand=${encodeURIComponent(brand)}` : '';
  const payload = await request(`/policies/vehicle-models/${query}`);
  return unwrapList<string>(payload);
}

export async function fetchSellerDashboard(
  params?: {
    startDate?: string;
    endDate?: string;
  },
  options?: RequestInit,
): Promise<SellerDashboardResponse> {
  const searchParams = new URLSearchParams();
  if (params?.startDate) {
    searchParams.set('start_date', params.startDate);
  }
  if (params?.endDate) {
    searchParams.set('end_date', params.endDate);
  }
  const query = searchParams.toString();
  const payload = await request<Record<string, unknown>>(
    `/dashboard/seller/${query ? `?${query}` : ''}`,
    options,
  );
  const rawPolicies = Array.isArray(payload.policies) ? payload.policies : [];
  const rawPaymentsByDay = Array.isArray(payload.payments_by_day) ? payload.payments_by_day : [];
  const rawTasksByDay = Array.isArray(payload.tasks_completed_by_day)
    ? payload.tasks_completed_by_day
    : [];
  const rawTasksByExecutor = Array.isArray(payload.tasks_completed_by_executor)
    ? payload.tasks_completed_by_executor
    : [];
  const rawPolicyExpirations = Array.isArray(payload.policy_expirations_by_day)
    ? payload.policy_expirations_by_day
    : [];
  const rawNextContacts = Array.isArray(payload.next_contacts_by_day)
    ? payload.next_contacts_by_day
    : [];
  const rawFinancialTotals =
    payload.financial_totals && typeof payload.financial_totals === 'object'
      ? (payload.financial_totals as Record<string, unknown>)
      : {};
  const rawFinancialByCompanyType = Array.isArray(payload.financial_by_company_type)
    ? payload.financial_by_company_type
    : [];
  return {
    rangeStart: toStringValue(payload.start_date ?? payload.startDate ?? ''),
    rangeEnd: toStringValue(payload.end_date ?? payload.endDate ?? ''),
    totalPaid: toStringValue(payload.total_paid ?? payload.totalPaid ?? '0'),
    tasksCurrent: Number(payload.tasks_current ?? payload.tasksCurrent ?? 0),
    tasksCompleted: Number(payload.tasks_completed ?? payload.tasksCompleted ?? 0),
    paymentsByDay: rawPaymentsByDay.map((item) => {
      const record = item as Record<string, unknown>;
      return {
        date: toStringValue(record.date),
        total: toStringValue(record.total ?? '0'),
      };
    }),
    tasksCompletedByDay: rawTasksByDay.map((item) => {
      const record = item as Record<string, unknown>;
      return {
        date: toStringValue(record.date),
        count: Number(record.count ?? 0),
      };
    }),
    tasksCompletedByExecutor: rawTasksByExecutor.map((item) => {
      const record = item as Record<string, unknown>;
      return {
        date: toStringValue(record.date),
        executorId: toNullableString(record.executor_id ?? record.executorId),
        executorName: toStringValue(record.executor_name ?? record.executorName ?? 'Неизвестный'),
        count: Number(record.count ?? 0),
      };
    }),
    policyExpirationsByDay: rawPolicyExpirations.map((item) => {
      const record = item as Record<string, unknown>;
      return {
        date: toStringValue(record.date),
        count: Number(record.count ?? 0),
      };
    }),
    nextContactsByDay: rawNextContacts.map((item) => {
      const record = item as Record<string, unknown>;
      return {
        date: toStringValue(record.date),
        count: Number(record.count ?? 0),
      };
    }),
    financialTotals: {
      incomeTotal: toStringValue(
        rawFinancialTotals.income_total ?? rawFinancialTotals.incomeTotal ?? '0',
      ),
      expenseTotal: toStringValue(
        rawFinancialTotals.expense_total ?? rawFinancialTotals.expenseTotal ?? '0',
      ),
      netTotal: toStringValue(rawFinancialTotals.net_total ?? rawFinancialTotals.netTotal ?? '0'),
      recordsCount: Number(
        rawFinancialTotals.records_count ?? rawFinancialTotals.recordsCount ?? 0,
      ),
    },
    financialByCompanyType: rawFinancialByCompanyType.map((item) => {
      const record = item as Record<string, unknown>;
      return {
        insuranceCompanyId: toNullableString(
          record.insurance_company_id ?? record.insuranceCompanyId,
        ),
        insuranceCompanyName: toStringValue(
          record.insurance_company_name ?? record.insuranceCompanyName ?? 'Не указано',
        ),
        insuranceTypeId: toNullableString(record.insurance_type_id ?? record.insuranceTypeId),
        insuranceTypeName: toStringValue(
          record.insurance_type_name ?? record.insuranceTypeName ?? 'Не указано',
        ),
        incomeTotal: toStringValue(record.income_total ?? record.incomeTotal ?? '0'),
        expenseTotal: toStringValue(record.expense_total ?? record.expenseTotal ?? '0'),
        netTotal: toStringValue(record.net_total ?? record.netTotal ?? '0'),
        recordsCount: Number(record.records_count ?? record.recordsCount ?? 0),
      };
    }),
    policies: rawPolicies.map((item) => {
      const record = item as Record<string, unknown>;
      return {
        id: toStringValue(record.id),
        number: toStringValue(record.number),
        insuranceCompany: toStringValue(record.insurance_company ?? record.insuranceCompany ?? ''),
        insuranceType: toStringValue(record.insurance_type ?? record.insuranceType ?? ''),
        clientName: toNullableString(record.client_name ?? record.clientName),
        insuredClientName: toNullableString(record.insured_client_name ?? record.insuredClientName),
        startDate: toNullableString(record.start_date ?? record.startDate),
        paidAmount: toStringValue(record.paid_amount ?? record.paidAmount ?? '0'),
      };
    }),
  };
}

interface PolicyUpdatePayload {
  number: string;
  insuranceCompanyId: string;
  insuranceTypeId: string;
  isVehicle: boolean;
  brand?: string;
  model?: string;
  vin?: string;
  deductible?: number | null;
  officialDealer?: boolean | null;
  gap?: boolean | null;
  counterparty?: string;
  note?: string;
  salesChannelId?: string;
  startDate?: string | null;
  endDate?: string | null;
  clientId?: string;
}

export async function updatePolicy(id: string, data: PolicyUpdatePayload): Promise<Policy> {
  const bodyPayload: Record<string, unknown> = {
    number: data.number,
    insurance_company: data.insuranceCompanyId,
    insurance_type: data.insuranceTypeId,
    is_vehicle: data.isVehicle,
    brand: data.brand || '',
    model: data.model || '',
    vin: data.vin || '',
    deductible: data.deductible ?? 0,
    official_dealer: data.officialDealer ?? null,
    gap: data.gap ?? null,
    counterparty: data.counterparty || '',
    note: data.note || '',
    sales_channel: data.salesChannelId || null,
    start_date: data.startDate || null,
    end_date: data.endDate || null,
    client: data.clientId || null,
  };
  const payload = await request<Record<string, unknown>>(`/policies/${id}/`, {
    method: 'PATCH',
    body: JSON.stringify(bodyPayload),
  });
  return mapPolicy(payload);
}

export async function updatePolicyRenewed(id: string, isRenewed: boolean): Promise<Policy> {
  const payload = await request<Record<string, unknown>>(`/policies/${id}/`, {
    method: 'PATCH',
    body: JSON.stringify({ is_renewed: isRenewed }),
  });
  return mapPolicy(payload);
}

export async function movePolicy(id: string, targetDealId: string): Promise<Policy> {
  const payload = await request<Record<string, unknown>>(`/policies/${id}/move/`, {
    method: 'POST',
    body: JSON.stringify({ deal: targetDealId }),
  });
  return mapPolicy(payload);
}

export async function fetchPoliciesKPI(
  filters?: FilterParams,
  options?: RequestInit,
): Promise<PoliciesKPI> {
  const qs = buildQueryString(filters);
  const payload = await request<Record<string, unknown>>(`/policies/kpi/${qs}`, options);
  return {
    total: Number(payload.total ?? 0),
    problemCount: Number(payload.problem_count ?? payload.problemCount ?? 0),
    dueCount: Number(payload.due_count ?? payload.dueCount ?? 0),
    expiringSoonCount: Number(payload.expiring_soon_count ?? payload.expiringSoonCount ?? 0),
    expiringDays: Number(payload.expiring_days ?? payload.expiringDays ?? 30),
  };
}
