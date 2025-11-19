import {
  ActivityLog,
  ChatMessage,
  Client,
  Deal,
  DealStatus,
  DriveFile,
  FinancialRecord,
  InsuranceCompany,
  InsuranceType,
  Note,
  Payment,
  Policy,
  PolicyRecognitionResult,
  SalesChannel,
  Quote,
  Task,
  User,
} from './types';

const envBase = import.meta.env.VITE_API_URL;
const API_BASE = (envBase && envBase.trim() !== '' ? envBase : '/api/v1').replace(/\/$/, '');

// ============ Auth Token Management ============
const TOKEN_KEY = 'jwt_access_token';
const REFRESH_TOKEN_KEY = 'jwt_refresh_token';
const REFRESH_ENDPOINT = '/auth/refresh/';

export function getAccessToken(): string | null {
  return typeof window !== 'undefined' ? localStorage.getItem(TOKEN_KEY) : null;
}

export function setAccessToken(token: string): void {
  if (typeof window !== 'undefined') {
    localStorage.setItem(TOKEN_KEY, token);
  }
}

export function setRefreshToken(token: string): void {
  if (typeof window !== 'undefined') {
    localStorage.setItem(REFRESH_TOKEN_KEY, token);
  }
}

export function getRefreshToken(): string | null {
  return typeof window !== 'undefined' ? localStorage.getItem(REFRESH_TOKEN_KEY) : null;
}

export function clearTokens(): void {
  if (typeof window !== 'undefined') {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(REFRESH_TOKEN_KEY);
  }
}

interface RefreshResponse {
  access: string;
  refresh?: string;
}

async function refreshAccessToken(): Promise<boolean> {
  const refreshToken = getRefreshToken();
  if (!refreshToken) {
    return false;
  }

  try {
    const response = await fetch(`${API_BASE}${REFRESH_ENDPOINT}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ refresh: refreshToken }),
    });

    if (!response.ok) {
      console.warn(`Token refresh failed with status ${response.status}`);
      return false;
    }

    const data = (await response.json()) as RefreshResponse;
    if (!data.access) {
      console.warn('Token refresh response missing new access token');
      return false;
    }

    setAccessToken(data.access);
    if (data.refresh) {
      setRefreshToken(data.refresh);
    }

    console.log('Access token renewed via refresh token');
    return true;
  } catch (error) {
    console.error('Refreshing access token failed', error);
    return false;
  }
}

// ============ Auth API Functions ============
export interface LoginResponse {
  access: string;
  refresh: string;
  user: {
    id: number;
    username: string;
    email: string;
    first_name: string;
    last_name: string;
    is_active: boolean;
    is_staff: boolean;
    user_roles: UserRole[];
    roles: string[];
    date_joined: string;
  };
}

export interface UserRole {
  role?: {
    name?: string;
  };
}

export interface CurrentUserResponse {
  id: number;
  username: string;
  first_name?: string | null;
  last_name?: string | null;
  email?: string | null;
  is_authenticated?: boolean;
  is_staff?: boolean;
  is_superuser?: boolean;
  user_roles?: UserRole[];
  roles?: string[];
}

export async function login(username: string, password: string): Promise<LoginResponse> {
  const response = await fetch(`${API_BASE}/auth/login/`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ username, password }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || 'Ошибка входа');
  }

  const data = (await response.json()) as LoginResponse;
  setAccessToken(data.access);
  setRefreshToken(data.refresh);
  console.log('Login successful, tokens saved:', {
    access: data.access?.substring(0, 20) + '...',
    hasToken: !!getAccessToken(),
  });
  return data;
}

export function logout(): void {
  clearTokens();
}

export async function getCurrentUser(): Promise<CurrentUserResponse> {
  return request<CurrentUserResponse>('/auth/me/');
}

function redirectToLogin(): void {
  if (typeof window === 'undefined') {
    return;
  }
  const loginPath = '/login';
  if (window.location.pathname !== loginPath) {
    window.location.replace(loginPath);
  } else {
    window.location.reload();
  }
}

// ============ Custom Error Class for API Errors ============
export class APIError extends Error {
  status: number;
  path: string;

  constructor(message: string, status: number, path: string) {
    super(message);
    this.name = 'APIError';
    this.status = status;
    this.path = path;
  }
}

// ============ API Request Helper ============
async function request<T = unknown>(
  path: string,
  options: RequestInit = {},
  refreshAttempted = false
): Promise<T> {
  const { headers: customHeaders, ...requestOptions } = options;
  const headers = new Headers(customHeaders as HeadersInit);
  const isFormData = requestOptions.body instanceof FormData;

  if (isFormData) {
    headers.delete('Content-Type');
  } else if (!headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  const token = getAccessToken();
  const refreshToken = getRefreshToken();
  const hadToken = Boolean(token);
  const hadRefreshToken = Boolean(refreshToken);
  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
    console.log(`API request ${path}: token present (${token.substring(0, 20)}...)`);
  } else {
    console.log(`API request ${path}: NO TOKEN FOUND`);
  }

  const response = await fetch(`${API_BASE}${path}`, {
    headers,
    ...requestOptions,
  });

  // Handle 401 Unauthorized - redirect to login
  if (response.status === 401) {
    if (!refreshAttempted && (await refreshAccessToken())) {
      return request(path, options, true);
    }
    const hadAnyTokens = hadToken || hadRefreshToken;
    console.warn(
      `Unauthorized (401) on ${path}. Clearing tokens${hadAnyTokens ? ' and redirecting to login.' : '.'}`
    );
    clearTokens();
    if (hadAnyTokens) {
      redirectToLogin();
    }
    throw new APIError('Unauthorized', 401, path);
  }

  // Handle 403 Forbidden - throw error for component to handle
  if (response.status === 403) {
    const text = await response.text();
    let detail = 'Доступ запрещен';
    try {
      const json = JSON.parse(text);
      if (json.detail) {
        detail = json.detail;
      }
    } catch (e) {
      // Keep default message if response is not JSON
    }
    console.warn(`Forbidden (403) on ${path}: ${detail}`);
    throw new APIError(detail, 403, path);
  }

  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || `Запрос ${path} завершился с ошибкой ${response.status}`);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return (await response.json()) as T;
}

function isResultsPayload(value: unknown): value is { results: unknown[] } {
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  return (
    'results' in value &&
    Array.isArray((value as { results: unknown[] }).results)
  );
}

function unwrapList<T>(payload: unknown): T[] {
  if (Array.isArray(payload)) {
    return payload as T[];
  }
  if (isResultsPayload(payload)) {
    return payload.results as T[];
  }
  return [];
}

// ============ Pagination & Filtering Types ============
export interface PaginatedResponse<T> {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
}

export interface FilterParams {
  page?: number;
  page_size?: number;
  search?: string;
  ordering?: string;
  [key: string]: unknown;
}

// Helper to build query string from filter params
function buildQueryString(params: FilterParams): string {
  const queryParams = new URLSearchParams();
  if (!params || Object.keys(params).length === 0) {
    return '';
  }
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') {
      queryParams.append(key, String(value));
    }
  });
  const qs = queryParams.toString();
  return qs ? `?${qs}` : '';
}

const toOptionalString = (value: unknown): string | undefined =>
  value === undefined || value === null ? undefined : String(value);

const toNullableString = (value: unknown): string | null =>
  value === undefined || value === null ? null : String(value);

const toStringValue = (value: unknown, fallback = ''): string =>
  value === undefined || value === null ? fallback : String(value);

const toNumberValue = (value: unknown, fallback = 0): number => {
  if (typeof value === 'number') {
    return value;
  }
  if (value === undefined || value === null || value === '') {
    return fallback;
  }
  const parsed = Number(value);
  return Number.isNaN(parsed) ? fallback : parsed;
};

const toNullableNumber = (value: unknown): number | null => {
  if (typeof value === 'number') {
    return value;
  }
  if (value === undefined || value === null || value === '') {
    return null;
  }
  const parsed = Number(value);
  return Number.isNaN(parsed) ? null : parsed;
};

const mapClient = (raw: Record<string, unknown>): Client => ({
  id: toStringValue(raw.id),
  name: toStringValue(raw.name),
  phone: toOptionalString(raw.phone),
  birthDate: toNullableString(raw.birth_date ?? raw.birthDate),
  notes: toNullableString(raw.notes),
  createdAt: toStringValue(raw.created_at),
  updatedAt: toStringValue(raw.updated_at),
});

const mapQuote = (raw: Record<string, unknown>): Quote => ({
  id: toStringValue(raw.id),
  dealId: toStringValue(raw.deal),
  insuranceCompanyId: toStringValue(raw.insurance_company),
  insuranceCompany: toStringValue(raw.insurance_company_name ?? raw.insurer ?? ''),
  insuranceTypeId: toStringValue(raw.insurance_type),
  insuranceType: toStringValue(raw.insurance_type_name ?? raw.insurance_type ?? ''),
  sumInsured: toNumberValue(raw.sum_insured),
  premium: toNumberValue(raw.premium),
  deductible: toOptionalString(raw.deductible),
  comments: toOptionalString(raw.comments),
  createdAt: toStringValue(raw.created_at),
});

const mapInsuranceCompany = (raw: Record<string, unknown>): InsuranceCompany => ({
  id: toStringValue(raw.id),
  name: toStringValue(raw.name),
  description: toOptionalString(raw.description),
  createdAt: toStringValue(raw.created_at),
  updatedAt: toStringValue(raw.updated_at),
  deletedAt: toNullableString(raw.deleted_at),
});

const mapInsuranceType = (raw: Record<string, unknown>): InsuranceType => ({
  id: toStringValue(raw.id),
  name: toStringValue(raw.name),
  description: toOptionalString(raw.description),
  createdAt: toStringValue(raw.created_at),
  updatedAt: toStringValue(raw.updated_at),
  deletedAt: toNullableString(raw.deleted_at),
});

const DEAL_STATUSES: DealStatus[] = ['open', 'won', 'lost', 'on_hold'];
const resolveDealStatus = (value: unknown): DealStatus =>
  typeof value === 'string' && DEAL_STATUSES.includes(value as DealStatus) ? (value as DealStatus) : 'open';

const mapDeal = (raw: Record<string, unknown>): Deal => {
  const quoteList = Array.isArray(raw.quotes) ? raw.quotes : [];
  const documentList = Array.isArray(raw.documents) ? raw.documents : [];
  return {
    id: toStringValue(raw.id),
    title: toStringValue(raw.title),
    description: toOptionalString(raw.description),
    clientId: toStringValue(raw.client),
    clientName: toOptionalString(raw.client_name),
    status: resolveDealStatus(raw.status),
    stageName: toOptionalString(raw.stage_name),
    expectedClose: raw.expected_close === undefined ? undefined : toNullableString(raw.expected_close),
    nextContactDate:
      raw.next_contact_date === undefined ? undefined : toNullableString(raw.next_contact_date),
    source: toOptionalString(raw.source),
    lossReason: toOptionalString(raw.loss_reason),
    createdAt: toStringValue(raw.created_at),
    quotes: quoteList.map((quote) => mapQuote(quote as Record<string, unknown>)),
    documents: documentList.map((doc) => {
      const record = doc as Record<string, unknown>;
      return {
        id: toStringValue(record.id),
        title: toStringValue(record.title),
        file: toOptionalString(record.file),
        file_size: toNumberValue(record.file_size ?? record.fileSize),
        mime_type: toStringValue(record.mime_type ?? record.mimeType),
        created_at: toStringValue(record.created_at ?? record.createdAt),
      };
    }),
    driveFolderId: raw.drive_folder_id === undefined ? null : toNullableString(raw.drive_folder_id),
    paymentsPaid: toStringValue(raw.payments_paid ?? raw.paymentsPaid ?? '0'),
    paymentsTotal: toStringValue(raw.payments_total ?? raw.paymentsTotal ?? '0'),
    seller: toNullableString(raw.seller),
    executor: toNullableString(raw.executor),
    sellerName: toNullableString(raw.seller_name),
    executorName: toNullableString(raw.executor_name),
  };
};

const mapSalesChannel = (raw: Record<string, unknown>): SalesChannel => ({
  id: toStringValue(raw.id),
  name: toStringValue(raw.name),
  description: toOptionalString(raw.description) ?? '',
  createdAt: toStringValue(raw.created_at),
  updatedAt: toStringValue(raw.updated_at),
  deletedAt: toNullableString(raw.deleted_at),
});

const mapDriveFile = (raw: Record<string, unknown>): DriveFile => {
  const sizeValue = raw.size ?? raw.file_size ?? raw.fileSize;
  return {
    id: toStringValue(raw.id),
    name: toStringValue(raw.name),
    mimeType: toStringValue(raw.mime_type ?? raw.mimeType ?? ''),
    size: toNullableNumber(sizeValue),
    createdAt: toNullableString(raw.created_at ?? raw.createdAt),
    modifiedAt: toNullableString(raw.modified_at ?? raw.modifiedAt),
    webViewLink: toNullableString(raw.web_view_link ?? raw.webViewLink),
    isFolder: Boolean(raw.is_folder ?? raw.isFolder ?? false),
  };
};

export interface DriveFilesResponse {
  files: DriveFile[];
  folderId?: string | null;
}

const mapUser = (raw: Record<string, unknown>): User => {
  const legacyRoles = Array.isArray(raw.roles)
    ? (raw.roles as unknown[])
        .map(toOptionalString)
        .filter((role): role is string => Boolean(role))
    : [];
  const userRoleEntries = Array.isArray(raw.user_roles)
    ? (raw.user_roles as unknown[])
        .map((entry) => {
          if (typeof entry !== 'object' || entry === null) {
            return undefined;
          }
          const record = entry as Record<string, unknown>;
          return toOptionalString(record.role?.name);
        })
        .filter((name): name is string => Boolean(name))
    : [];

  return {
    id: toStringValue(raw.id),
    username: toStringValue(raw.username),
    firstName: toOptionalString(raw.first_name ?? raw.firstName),
    lastName: toOptionalString(raw.last_name ?? raw.lastName),
    roles: userRoleEntries.length > 0 ? userRoleEntries : legacyRoles,
  };
};

const mapPolicy = (raw: Record<string, unknown>): Policy => ({
  id: toStringValue(raw.id),
  number: toStringValue(raw.number),
  insuranceCompanyId: toStringValue(raw.insurance_company),
  insuranceCompany: toStringValue(raw.insurance_company_name ?? raw.insurance_company ?? ''),
  insuranceTypeId: toStringValue(raw.insurance_type),
  insuranceType: toStringValue(raw.insurance_type_name ?? raw.insurance_type ?? ''),
  dealId: toStringValue(raw.deal),
  clientId: toOptionalString(raw.client),
  clientName: toOptionalString(raw.client_name ?? raw.client),
  isVehicle: Boolean(raw.is_vehicle ?? raw.vehicle),
  brand: toOptionalString(raw.brand),
  model: toOptionalString(raw.model),
  vin: toOptionalString(raw.vin),
  counterparty: toOptionalString(raw.counterparty),
  salesChannel: toOptionalString(raw.sales_channel_name ?? raw.sales_channel),
  salesChannelId: toOptionalString(raw.sales_channel),
  salesChannelName: toOptionalString(raw.sales_channel_name ?? raw.sales_channel),
  startDate: raw.start_date === undefined ? undefined : toNullableString(raw.start_date),
  endDate: raw.end_date === undefined ? undefined : toNullableString(raw.end_date),
  status: toStringValue(raw.status),
  paymentsPaid: toStringValue(raw.payments_paid ?? raw.paymentsPaid ?? '0'),
  paymentsTotal: toStringValue(raw.payments_total ?? raw.paymentsTotal ?? '0'),
  createdAt: toStringValue(raw.created_at),
});

const mapFinancialRecord = (raw: Record<string, unknown>): FinancialRecord => ({
  id: toStringValue(raw.id),
  paymentId: toStringValue(raw.payment),
  paymentDescription: toOptionalString(raw.payment_description),
  paymentAmount: toOptionalString(raw.payment_amount),
  amount: toStringValue(raw.amount),
  date: raw.date === undefined ? undefined : toNullableString(raw.date),
  description: toOptionalString(raw.description),
  source: toOptionalString(raw.source),
  note: toOptionalString(raw.note),
  recordType: toOptionalString(raw.record_type),
  createdAt: toStringValue(raw.created_at),
  updatedAt: toStringValue(raw.updated_at),
  deletedAt: toNullableString(raw.deleted_at),
});

const mapPayment = (raw: Record<string, unknown>): Payment => ({
  id: toStringValue(raw.id),
  dealId: toOptionalString(raw.deal),
  dealTitle: toOptionalString(raw.deal_title),
  policyId: toOptionalString(raw.policy),
  policyNumber: toOptionalString(raw.policy_number),
  policyInsuranceType: toOptionalString(raw.policy_insurance_type),
  amount: toStringValue(raw.amount),
  description: toOptionalString(raw.description),
  note: toOptionalString(raw.note),
  scheduledDate:
    raw.scheduled_date === undefined ? undefined : toNullableString(raw.scheduled_date),
  actualDate: raw.actual_date === undefined ? undefined : toNullableString(raw.actual_date),
  financialRecords: Array.isArray(raw.financial_records)
    ? (raw.financial_records as unknown[]).map((record) =>
        mapFinancialRecord(record as Record<string, unknown>)
      )
    : [],
  canDelete: Boolean(raw.can_delete ?? raw.canDelete),
  createdAt: toStringValue(raw.created_at),
  updatedAt: toStringValue(raw.updated_at),
  deletedAt: toNullableString(raw.deleted_at),
});

const mapTask = (raw: Record<string, unknown>): Task => {
  const checklistItems = Array.isArray(raw.checklist)
    ? (raw.checklist as unknown[]).map((item) => {
        if (typeof item !== 'object' || item === null) {
          return { label: '', done: false };
        }
        const record = item as Record<string, unknown>;
        return {
          label: toStringValue(record.label),
          done: Boolean(record.done),
        };
      })
    : [];

  return {
    id: toStringValue(raw.id),
    title: toStringValue(raw.title),
    description: toOptionalString(raw.description),
    dealId: toOptionalString(raw.deal),
    assignee: toNullableString(raw.assignee),
    assigneeName: toNullableString(raw.assignee_name ?? raw.assignee_username),
    status: toStringValue(raw.status),
    priority: toStringValue(raw.priority),
    dueAt: raw.due_at === undefined ? undefined : toNullableString(raw.due_at),
    remindAt: raw.remind_at === undefined ? undefined : toNullableString(raw.remind_at),
    checklist: checklistItems,
    createdAt: toStringValue(raw.created_at),
  };
};

const mapActivityLog = (raw: Record<string, unknown>): ActivityLog => ({
  id: toStringValue(raw.id),
  deal: toStringValue(raw.deal),
  actionType: toStringValue(raw.action_type),
  actionTypeDisplay: toStringValue(raw.action_type_display),
  description: toOptionalString(raw.description) ?? '',
  user: toOptionalString(raw.user),
  userUsername: toOptionalString(raw.user_username),
  oldValue: toOptionalString(raw.old_value),
  newValue: toOptionalString(raw.new_value),
  objectId: toOptionalString(raw.object_id),
  objectType: toOptionalString(raw.object_type),
  objectName: toOptionalString(raw.object_name),
  createdAt: toStringValue(raw.created_at),
});

const mapNote = (raw: Record<string, unknown>): Note => ({
  id: toStringValue(raw.id),
  dealId: toStringValue(raw.deal),
  dealTitle: toOptionalString(raw.deal_title ?? raw.dealTitle),
  body: toStringValue(raw.body ?? ''),
  authorName: toNullableString(raw.author_name ?? raw.authorName),
  createdAt: toStringValue(raw.created_at),
  updatedAt: toStringValue(raw.updated_at),
  deletedAt: toNullableString(raw.deleted_at),
});

export async function fetchClients(filters?: FilterParams): Promise<Client[]> {
  const qs = buildQueryString(filters || {});
  const payload = await request(`/clients/${qs}`);
  return unwrapList(payload).map(mapClient);
}

export async function fetchUsers(filters?: FilterParams): Promise<User[]> {
  const qs = buildQueryString(filters || {});
  const payload = await request(`/users/${qs}`);
  return unwrapList(payload).map(mapUser);
}

export async function fetchInsuranceCompanies(
  filters?: FilterParams
): Promise<InsuranceCompany[]> {
  const qs = buildQueryString(filters || {});
  const payload = await request(`/insurance_companies/${qs}`);
  return unwrapList(payload).map(mapInsuranceCompany);
}

export async function fetchInsuranceTypes(
  filters?: FilterParams
): Promise<InsuranceType[]> {
  const qs = buildQueryString(filters || {});
  const payload = await request(`/insurance_types/${qs}`);
  return unwrapList(payload).map(mapInsuranceType);
}

export async function fetchSalesChannels(): Promise<SalesChannel[]> {
  const payload = await request('/sales_channels/');
  return unwrapList(payload).map(mapSalesChannel);
}

export async function fetchDeals(filters?: FilterParams): Promise<Deal[]> {
  const qs = buildQueryString(filters || {});
  const payload = await request(`/deals/${qs}`);
  return unwrapList(payload).map(mapDeal);
}

export async function fetchDealDriveFiles(
  dealId: string
): Promise<DriveFilesResponse> {
  const payload = await request<{ files?: unknown[]; folder_id?: string | null }>(
    `/deals/${dealId}/drive-files/`
  );
  const rawFiles = Array.isArray(payload?.files) ? payload.files : [];
  return {
    files: rawFiles.map(mapDriveFile),
    folderId: payload?.folder_id ?? null,
  };
}

export async function uploadDealDriveFile(
  dealId: string,
  file: File
): Promise<DriveFile> {
  const formData = new FormData();
  formData.append('file', file);

  const payload = await request<{ file?: unknown; folder_id?: string | null }>(
    `/deals/${dealId}/drive-files/`,
    {
      method: 'POST',
      body: formData,
    }
  );

  if (!payload?.file) {
    throw new Error('Не удалось загрузить файл в Google Drive');
  }

  return mapDriveFile(payload.file);
}

export async function recognizeDealPolicies(
  dealId: string,
  fileIds: string[]
): Promise<{ results: PolicyRecognitionResult[] }> {
  const payload = await request<{ results?: unknown[] }>('/policies/recognize/', {
    method: 'POST',
    body: JSON.stringify({ deal_id: dealId, file_ids: fileIds }),
  });
  const rawResults = Array.isArray(payload?.results) ? payload.results : [];
  return {
    results: rawResults.map((item) => ({
      fileId: item.fileId,
      fileName: item.fileName ?? null,
      status: item.status === 'parsed' ? 'parsed' : 'error',
      message: item.message,
      transcript: item.transcript ?? null,
      data: item.data ?? null,
    })),
  };
}

export async function fetchPolicies(filters?: FilterParams): Promise<Policy[]> {
  const qs = buildQueryString(filters || {});
  const payload = await request(`/policies/${qs}`);
  return unwrapList(payload).map(mapPolicy);
}

export async function fetchPayments(filters?: FilterParams): Promise<Payment[]> {
  const qs = buildQueryString(filters || {});
  const payload = await request(`/payments/${qs}`);
  return unwrapList(payload).map(mapPayment);
}

export async function fetchTasks(filters?: FilterParams): Promise<Task[]> {
  const qs = buildQueryString(filters || {});
  const payload = await request(`/tasks/${qs}`);
  return unwrapList(payload).map(mapTask);
}

// Paginated fetch variants for use in views
export async function fetchClientsWithPagination(
  filters?: FilterParams
): Promise<PaginatedResponse<Client>> {
  const qs = buildQueryString(filters || {});
  const payload = await request(`/clients/${qs}`);
  return {
    count: payload.count || 0,
    next: payload.next || null,
    previous: payload.previous || null,
    results: unwrapList(payload).map(mapClient),
  };
}

export async function fetchDealsWithPagination(
  filters?: FilterParams
): Promise<PaginatedResponse<Deal>> {
  const qs = buildQueryString(filters || {});
  const payload = await request(`/deals/${qs}`);
  return {
    count: payload.count || 0,
    next: payload.next || null,
    previous: payload.previous || null,
    results: unwrapList(payload).map(mapDeal),
  };
}

export async function fetchPoliciesWithPagination(
  filters?: FilterParams
): Promise<PaginatedResponse<Policy>> {
  const qs = buildQueryString(filters || {});
  const payload = await request(`/policies/${qs}`);
  return {
    count: payload.count || 0,
    next: payload.next || null,
    previous: payload.previous || null,
    results: unwrapList(payload).map(mapPolicy),
  };
}

export async function fetchPaymentsWithPagination(
  filters?: FilterParams
): Promise<PaginatedResponse<Payment>> {
  const qs = buildQueryString(filters || {});
  const payload = await request(`/payments/${qs}`);
  return {
    count: payload.count || 0,
    next: payload.next || null,
    previous: payload.previous || null,
    results: unwrapList(payload).map(mapPayment),
  };
}

export async function fetchTasksWithPagination(
  filters?: FilterParams
): Promise<PaginatedResponse<Task>> {
  const qs = buildQueryString(filters || {});
  const payload = await request(`/tasks/${qs}`);
  return {
    count: payload.count || 0,
    next: payload.next || null,
    previous: payload.previous || null,
    results: unwrapList(payload).map(mapTask),
  };
}

export async function createClient(data: {
  name: string;
  phone?: string;
  birthDate?: string | null;
  notes?: string | null;
}): Promise<Client> {
  const payload = await request('/clients/', {
    method: 'POST',
    body: JSON.stringify({
      name: data.name,
      phone: data.phone,
      birth_date: data.birthDate || null,
      notes: data.notes ?? '',
    }),
  });
  return mapClient(payload);
}

export async function updateClient(
  id: string,
  data: { name: string; phone?: string; birthDate?: string | null; notes?: string | null }
): Promise<Client> {
  const payload = await request(`/clients/${id}/`, {
    method: 'PATCH',
    body: JSON.stringify({
      name: data.name,
      phone: data.phone,
      birth_date: data.birthDate || null,
      notes: data.notes ?? '',
    }),
  });
  return mapClient(payload);
}

export async function createDeal(data: {
  title: string;
  description?: string;
  clientId: string;
  expectedClose?: string | null;
  executorId?: string | null;
  source?: string;
}): Promise<Deal> {
  const payload = await request('/deals/', {
    method: 'POST',
    body: JSON.stringify({
      title: data.title,
      description: data.description,
      client: data.clientId,
      expected_close: data.expectedClose || null,
      executor: data.executorId || null,
      source: data.source?.trim() ?? '',
    }),
  });
  return mapDeal(payload);
}

export async function updateDealStatus(id: string, status: DealStatus): Promise<Deal> {
  const payload = await request(`/deals/${id}/`, {
    method: 'PATCH',
    body: JSON.stringify({ status }),
  });
  return mapDeal(payload);
}

export async function updateDeal(
  id: string,
  data: {
    title?: string;
    description?: string;
    clientId?: string;
    nextContactDate?: string | null;
    expectedClose?: string | null;
    stageName?: string;
    executorId?: string | null;
    source?: string | null;
  }
): Promise<Deal> {
  const body: Record<string, unknown> = {
    title: data.title,
    description: data.description,
    client: data.clientId,
    next_contact_date: data.nextContactDate || null,
    expected_close: data.expectedClose || null,
    stage_name: data.stageName,
  };
  if ('executorId' in data) {
    body.executor = data.executorId || null;
  }
  if ('source' in data) {
    body.source = data.source ?? null;
  }
  const payload = await request(`/deals/${id}/`, {
    method: 'PATCH',
    body: JSON.stringify(body),
  });
  return mapDeal(payload);
}

export async function updatePayment(
  id: string,
  data: Partial<{
    dealId: string;
    policyId: string;
    actualDate: string | null;
    scheduledDate: string | null;
    description: string;
    amount: number;
  }>
): Promise<Payment> {
  const payload = await request(`/payments/${id}/`, {
    method: 'PATCH',
    body: JSON.stringify({
      deal: data.dealId,
      policy: data.policyId,
      actual_date: data.actualDate,
      scheduled_date: data.scheduledDate,
      description: data.description,
      amount: data.amount,
    }),
  });
  return mapPayment(payload);
}

export async function createQuote(data: {
  dealId: string;
  insuranceCompanyId: string;
  insuranceTypeId: string;
  sumInsured: number;
  premium: number;
  deductible?: string;
  comments?: string;
}): Promise<Quote> {
  const payload = await request('/quotes/', {
    method: 'POST',
    body: JSON.stringify({
      deal: data.dealId,
      insurance_company: data.insuranceCompanyId,
      insurance_type: data.insuranceTypeId,
      sum_insured: data.sumInsured,
      premium: data.premium,
      deductible: data.deductible,
      comments: data.comments,
    }),
  });
  return mapQuote(payload);
}

export async function updateQuote(
  id: string,
  data: {
    insuranceCompanyId: string;
    insuranceTypeId: string;
    sumInsured: number;
    premium: number;
    deductible?: string;
    comments?: string;
  }
): Promise<Quote> {
  const payload = await request(`/quotes/${id}/`, {
    method: 'PATCH',
    body: JSON.stringify({
      insurance_company: data.insuranceCompanyId,
      insurance_type: data.insuranceTypeId,
      sum_insured: data.sumInsured,
      premium: data.premium,
      deductible: data.deductible,
      comments: data.comments,
    }),
  });
  return mapQuote(payload);
}

export async function deleteQuote(id: string): Promise<void> {
  await request(`/quotes/${id}/`, { method: 'DELETE' });
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
  counterparty?: string;
  salesChannelId?: string;
  startDate?: string | null;
  endDate?: string | null;
}): Promise<Policy> {
  const payload = await request('/policies/', {
    method: 'POST',
    body: JSON.stringify({
      deal: data.dealId,
      number: data.number,
      insurance_company: data.insuranceCompanyId,
      insurance_type: data.insuranceTypeId,
      is_vehicle: data.isVehicle,
      brand: data.brand || '',
      model: data.model || '',
      vin: data.vin || '',
      counterparty: data.counterparty || '',
      sales_channel: data.salesChannelId || null,
      start_date: data.startDate || null,
      end_date: data.endDate || null,
      client: data.clientId || null,
    }),
  });
  return mapPolicy(payload);
}

export async function createPayment(data: {
  dealId?: string;
  policyId?: string;
  amount: number;
  description?: string;
  scheduledDate?: string | null;
  actualDate?: string | null;
}): Promise<Payment> {
  const payload = await request('/payments/', {
    method: 'POST',
    body: JSON.stringify({
      deal: data.dealId || null,
      policy: data.policyId || null,
      amount: data.amount,
      description: data.description || '',
      scheduled_date: data.scheduledDate || null,
      actual_date: data.actualDate || null,
    }),
  });
  return mapPayment(payload);
}

export async function deletePolicy(id: string): Promise<void> {
  await request(`/policies/${id}/`, { method: 'DELETE' });
}

const mapChatMessage = (raw: Record<string, unknown>): ChatMessage => ({
  id: toStringValue(raw.id),
  deal: toStringValue(raw.deal),
  author_name: toStringValue(raw.author_name),
  author_username: toNullableString(raw.author_username),
  author: toNullableString(raw.author),
  body: toStringValue(raw.body),
  created_at: toStringValue(raw.created_at),
});

export async function fetchChatMessages(dealId: string): Promise<ChatMessage[]> {
  const payload = await request(`/chat_messages/?deal=${dealId}`);
  return unwrapList(payload).map(mapChatMessage);
}

export async function createChatMessage(
  dealId: string,
  body: string
): Promise<ChatMessage> {
  const payload = await request('/chat_messages/', {
    method: 'POST',
    body: JSON.stringify({
      deal: dealId,
      body,
    }),
  });
  return mapChatMessage(payload);
}

export async function deleteChatMessage(id: string): Promise<void> {
  await request(`/chat_messages/${id}/`, { method: 'DELETE' });
}

export async function fetchFinancialRecords(): Promise<FinancialRecord[]> {
  const payload = await request('/financial_records/');
  return unwrapList(payload).map(mapFinancialRecord);
}

export async function createFinancialRecord(data: {
  paymentId: string;
  amount: number;
  date?: string | null;
  description?: string;
  source?: string;
  note?: string;
}): Promise<FinancialRecord> {
  const payload = await request('/financial_records/', {
    method: 'POST',
    body: JSON.stringify({
      payment: data.paymentId,
      amount: data.amount,
      date: data.date || null,
      description: data.description || '',
      source: data.source || '',
      note: data.note || '',
    }),
  });
  return mapFinancialRecord(payload);
}

export async function updateFinancialRecord(
  id: string,
  data: Partial<{
    amount: number;
    date: string | null;
    description: string;
    source: string;
    note: string;
  }>
): Promise<FinancialRecord> {
  const payload = await request(`/financial_records/${id}/`, {
    method: 'PATCH',
    body: JSON.stringify({
      amount: data.amount,
      date: data.date,
      description: data.description,
      source: data.source,
      note: data.note,
    }),
  });
  return mapFinancialRecord(payload);
}

export async function deleteFinancialRecord(id: string): Promise<void> {
  await request(`/financial_records/${id}/`, { method: 'DELETE' });
}

export async function fetchDealHistory(dealId: string): Promise<ActivityLog[]> {
  const payload = await request(`/deals/${dealId}/history/`);
  if (!Array.isArray(payload)) {
    return [];
  }
  return payload.map(mapActivityLog);
}

export async function fetchDealNotes(
  dealId: string,
  archived?: boolean
): Promise<Note[]> {
  const params: FilterParams = { deal: dealId };
  if (archived !== undefined) {
    params.archived = archived ? 'true' : 'false';
  }
  const qs = buildQueryString(params);
  const payload = await request(`/notes/${qs}`);
  return unwrapList(payload).map(mapNote);
}

export async function createNote(dealId: string, body: string): Promise<Note> {
  const payload = await request('/notes/', {
    method: 'POST',
    body: JSON.stringify({
      deal: dealId,
      body,
    }),
  });
  return mapNote(payload);
}

export async function archiveNote(id: string): Promise<void> {
  await request(`/notes/${id}/`, { method: 'DELETE' });
}

export async function restoreNote(id: string): Promise<Note> {
  const payload = await request(`/notes/${id}/restore/`, {
    method: 'POST',
  });
  return mapNote(payload);
}

export async function createTask(data: {
  dealId: string;
  title: string;
  description?: string;
  priority: string;
  dueAt?: string | null;
  status?: string;
  assigneeId?: string | null;
}): Promise<Task> {
  const body: Record<string, unknown> = {
    deal: data.dealId,
    title: data.title,
    description: data.description || '',
    priority: data.priority,
    due_at: data.dueAt || null,
    status: data.status || 'todo',
  };
  if (data.assigneeId) {
    body.assignee = data.assigneeId;
  }

  const payload = await request('/tasks/', {
    method: 'POST',
    body: JSON.stringify(body),
  });
  return mapTask(payload);
}

export async function updateTask(
  id: string,
  data: Partial<{
    title: string;
    description: string;
    priority: string;
    dueAt: string | null;
    status: string;
    assigneeId?: string | null;
  }>
): Promise<Task> {
  const body: Record<string, unknown> = {
    title: data.title,
    description: data.description,
    priority: data.priority,
    due_at: data.dueAt,
    status: data.status,
  };
  if ('assigneeId' in data) {
    body.assignee = data.assigneeId === '' ? null : data.assigneeId;
  }

  const payload = await request(`/tasks/${id}/`, {
    method: 'PATCH',
    body: JSON.stringify(body),
  });
  return mapTask(payload);
}

export async function deleteTask(id: string): Promise<void> {
  await request(`/tasks/${id}/`, { method: 'DELETE' });
}
