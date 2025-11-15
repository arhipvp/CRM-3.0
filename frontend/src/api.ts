import {
  ActivityLog,
  ChatMessage,
  Client,
  Deal,
  DealStatus,
  FinancialRecord,
  InsuranceCompany,
  InsuranceType,
  Payment,
  PaymentStatus,
  Policy,
  Quote,
  Task,
  User,
} from './types';

const envBase = import.meta.env.VITE_API_URL;
const API_BASE = (envBase && envBase.trim() !== '' ? envBase : '/api/v1').replace(/\/$/, '');

// ============ Auth Token Management ============
const TOKEN_KEY = 'jwt_access_token';
const REFRESH_TOKEN_KEY = 'jwt_refresh_token';

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
    user_roles: any[];
    roles: string[];
    date_joined: string;
  };
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

export async function getCurrentUser(): Promise<any> {
  return request<any>('/auth/me/');
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
async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(typeof options.headers === 'object' && options.headers !== null
      ? Object.fromEntries(Object.entries(options.headers as any))
      : {}),
  };

  // Add JWT token to headers
  const token = getAccessToken();
  const hadToken = Boolean(token);
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
    console.log(`API request ${path}: token present (${token.substring(0, 20)}...)`);
  } else {
    console.log(`API request ${path}: NO TOKEN FOUND`);
  }

  const response = await fetch(`${API_BASE}${path}`, {
    headers,
    ...options,
  });

  // Handle 401 Unauthorized - redirect to login
  if (response.status === 401) {
    console.warn(`Unauthorized (401) on ${path}. Clearing tokens${hadToken ? ' and redirecting to login.' : '.'}`);
    clearTokens();
    if (hadToken) {
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

function unwrapList<T>(payload: T[] | { results: T[] }): T[] {
  if (Array.isArray(payload)) {
    return payload;
  }
  if (payload && Array.isArray((payload as any).results)) {
    return (payload as any).results;
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
  [key: string]: any;
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

const toCamel = (value: any) => (value === null || value === undefined ? undefined : value);

const mapClient = (raw: any): Client => ({
  id: raw.id,
  name: raw.name,
  phone: toCamel(raw.phone),
  birthDate: raw.birth_date ?? null,
  notes: raw.notes ?? null,
  createdAt: raw.created_at,
  updatedAt: raw.updated_at,
});

const mapQuote = (raw: any): Quote => ({
  id: raw.id,
  dealId: raw.deal,
  insuranceCompanyId: raw.insurance_company,
  insuranceCompany: raw.insurance_company_name ?? raw.insurer ?? "",
  insuranceTypeId: raw.insurance_type,
  insuranceType: raw.insurance_type_name ?? raw.insurance_type ?? "",
  sumInsured: raw.sum_insured,
  premium: raw.premium,
  deductible: raw.deductible || undefined,
  comments: raw.comments || undefined,
  createdAt: raw.created_at,
});

const mapInsuranceCompany = (raw: any): InsuranceCompany => ({
  id: raw.id,
  name: raw.name,
  description: raw.description || undefined,
  createdAt: raw.created_at,
  updatedAt: raw.updated_at,
  deletedAt: raw.deleted_at ?? null,
});

const mapInsuranceType = (raw: any): InsuranceType => ({
  id: raw.id,
  name: raw.name,
  description: raw.description || undefined,
  createdAt: raw.created_at,
  updatedAt: raw.updated_at,
  deletedAt: raw.deleted_at ?? null,
});

const mapDeal = (raw: any): Deal => ({
  id: raw.id,
  title: raw.title,
  description: raw.description,
  clientId: raw.client,
  clientName: raw.client_name,
  status: raw.status as DealStatus,
  stageName: raw.stage_name,
  probability: raw.probability ?? 0,
  expectedClose: raw.expected_close,
  nextContactDate: raw.next_contact_date,
  source: raw.source,
  lossReason: raw.loss_reason,
  channel: raw.channel,
  createdAt: raw.created_at,
  quotes: Array.isArray(raw.quotes) ? raw.quotes.map(mapQuote) : [],
  documents: Array.isArray(raw.documents)
    ? raw.documents.map((d: any) => ({
        id: d.id,
        title: d.title,
        file: d.file,
        file_size: d.file_size,
        mime_type: d.mime_type,
        created_at: d.created_at,
      }))
    : [],
  seller: raw.seller,
  executor: raw.executor,
  sellerName: raw.seller_name ?? null,
  executorName: raw.executor_name ?? null,
});

const mapUser = (raw: any): User => ({
  id: String(raw.id),
  username: raw.username,
  roles: Array.isArray(raw.roles)
    ? raw.roles
    : Array.isArray(raw.user_roles)
    ? raw.user_roles
        .map((ur: any) => ur.role?.name)
        .filter((name) => typeof name === 'string')
    : [],
});

const mapPolicy = (raw: any): Policy => ({
  id: raw.id,
  number: raw.number,
  insuranceCompany: raw.insurance_company,
  insuranceType: raw.insurance_type,
  dealId: raw.deal,
  vin: raw.vin,
  startDate: raw.start_date,
  endDate: raw.end_date,
  amount: raw.amount,
  status: raw.status,
  createdAt: raw.created_at,
});

const mapFinancialRecord = (raw: any): FinancialRecord => ({
  id: raw.id,
  paymentId: raw.payment,
  paymentDescription: raw.payment_description,
  paymentAmount: raw.payment_amount,
  amount: raw.amount,
  date: raw.date,
  description: raw.description,
  source: raw.source,
  note: raw.note,
  recordType: raw.record_type,
  createdAt: raw.created_at,
  updatedAt: raw.updated_at,
  deletedAt: raw.deleted_at,
});

const mapPayment = (raw: any): Payment => ({
  id: raw.id,
  dealId: raw.deal,
  dealTitle: raw.deal_title,
  policyId: raw.policy,
  policyNumber: raw.policy_number,
  policyInsuranceType: raw.policy_insurance_type,
  amount: raw.amount,
  description: raw.description,
  scheduledDate: raw.scheduled_date,
  actualDate: raw.actual_date,
  status: raw.status,
  financialRecords: Array.isArray(raw.financial_records)
    ? raw.financial_records.map(mapFinancialRecord)
    : [],
  canDelete: raw.can_delete,
  createdAt: raw.created_at,
  updatedAt: raw.updated_at,
  deletedAt: raw.deleted_at,
});

const mapTask = (raw: any): Task => ({
  id: raw.id,
  title: raw.title,
  description: raw.description,
  dealId: raw.deal,
  assignee: raw.assignee ? String(raw.assignee) : null,
  assigneeName: raw.assignee_name ?? raw.assignee_username ?? null,
  status: raw.status,
  priority: raw.priority,
  dueAt: raw.due_at,
  remindAt: raw.remind_at,
  checklist: Array.isArray(raw.checklist) ? raw.checklist : [],
  createdAt: raw.created_at,
});

const mapActivityLog = (raw: any): ActivityLog => ({
  id: raw.id,
  deal: raw.deal,
  actionType: raw.action_type,
  actionTypeDisplay: raw.action_type_display,
  description: raw.description,
  user: raw.user,
  userUsername: raw.user_username,
  oldValue: raw.old_value,
  newValue: raw.new_value,
  createdAt: raw.created_at,
});

export async function fetchClients(filters?: FilterParams): Promise<Client[]> {
  const qs = buildQueryString(filters || {});
  const payload = await request<any>(`/clients/${qs}`);
  return unwrapList(payload).map(mapClient);
}

export async function fetchUsers(filters?: FilterParams): Promise<User[]> {
  const qs = buildQueryString(filters || {});
  const payload = await request<any>(`/users/${qs}`);
  return unwrapList(payload).map(mapUser);
}

export async function fetchInsuranceCompanies(
  filters?: FilterParams
): Promise<InsuranceCompany[]> {
  const qs = buildQueryString(filters || {});
  const payload = await request<any>(`/insurance_companies/${qs}`);
  return unwrapList(payload).map(mapInsuranceCompany);
}

export async function fetchInsuranceTypes(
  filters?: FilterParams
): Promise<InsuranceType[]> {
  const qs = buildQueryString(filters || {});
  const payload = await request<any>(`/insurance_types/${qs}`);
  return unwrapList(payload).map(mapInsuranceType);
}

export async function fetchDeals(filters?: FilterParams): Promise<Deal[]> {
  const qs = buildQueryString(filters || {});
  const payload = await request<any>(`/deals/${qs}`);
  return unwrapList(payload).map(mapDeal);
}

export async function fetchPolicies(filters?: FilterParams): Promise<Policy[]> {
  const qs = buildQueryString(filters || {});
  const payload = await request<any>(`/policies/${qs}`);
  return unwrapList(payload).map(mapPolicy);
}

export async function fetchPayments(filters?: FilterParams): Promise<Payment[]> {
  const qs = buildQueryString(filters || {});
  const payload = await request<any>(`/payments/${qs}`);
  return unwrapList(payload).map(mapPayment);
}

export async function fetchTasks(filters?: FilterParams): Promise<Task[]> {
  const qs = buildQueryString(filters || {});
  const payload = await request<any>(`/tasks/${qs}`);
  return unwrapList(payload).map(mapTask);
}

// Paginated fetch variants for use in views
export async function fetchClientsWithPagination(
  filters?: FilterParams
): Promise<PaginatedResponse<Client>> {
  const qs = buildQueryString(filters || {});
  const payload = await request<any>(`/clients/${qs}`);
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
  const payload = await request<any>(`/deals/${qs}`);
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
  const payload = await request<any>(`/policies/${qs}`);
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
  const payload = await request<any>(`/payments/${qs}`);
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
  const payload = await request<any>(`/tasks/${qs}`);
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
  const payload = await request<any>('/clients/', {
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
  const payload = await request<any>(`/clients/${id}/`, {
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
}): Promise<Deal> {
  const payload = await request<any>('/deals/', {
    method: 'POST',
    body: JSON.stringify({
      title: data.title,
      description: data.description,
      client: data.clientId,
      expected_close: data.expectedClose || null,
    }),
  });
  return mapDeal(payload);
}

export async function updateDealStatus(id: string, status: DealStatus): Promise<Deal> {
  const payload = await request<any>(`/deals/${id}/`, {
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
    probability?: number;
    stageName?: string;
  }
): Promise<Deal> {
  const payload = await request<any>(`/deals/${id}/`, {
    method: 'PATCH',
    body: JSON.stringify({
      title: data.title,
      description: data.description,
      client: data.clientId,
      next_contact_date: data.nextContactDate || null,
      expected_close: data.expectedClose || null,
      probability: data.probability,
      stage_name: data.stageName,
    }),
  });
  return mapDeal(payload);
}

export async function updatePayment(
  id: string,
  data: Partial<{
    dealId: string;
    policyId: string;
    status: PaymentStatus;
    actualDate: string | null;
    scheduledDate: string | null;
    description: string;
    amount: number;
  }>
): Promise<Payment> {
  const payload = await request<any>(`/payments/${id}/`, {
    method: 'PATCH',
    body: JSON.stringify({
      deal: data.dealId,
      policy: data.policyId,
      status: data.status,
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
  const payload = await request<any>('/quotes/', {
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

export async function deleteQuote(id: string): Promise<void> {
  await request(`/quotes/${id}/`, { method: 'DELETE' });
}

export async function createPolicy(data: {
  dealId: string;
  number: string;
  insuranceCompany: string;
  insuranceType: string;
  vin?: string;
  startDate?: string | null;
  endDate?: string | null;
  amount: number;
}): Promise<Policy> {
  const payload = await request<any>('/policies/', {
    method: 'POST',
    body: JSON.stringify({
      deal: data.dealId,
      number: data.number,
      insurance_company: data.insuranceCompany,
      insurance_type: data.insuranceType,
      vin: data.vin,
      start_date: data.startDate || null,
      end_date: data.endDate || null,
      amount: data.amount,
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
  status?: 'planned' | 'partial' | 'paid';
}): Promise<Payment> {
  const payload = await request<any>('/payments/', {
    method: 'POST',
    body: JSON.stringify({
      deal: data.dealId || null,
      policy: data.policyId || null,
      amount: data.amount,
      description: data.description || '',
      scheduled_date: data.scheduledDate || null,
      actual_date: data.actualDate || null,
      status: data.status || 'planned',
    }),
  });
  return mapPayment(payload);
}

export async function deletePolicy(id: string): Promise<void> {
  await request(`/policies/${id}/`, { method: 'DELETE' });
}

export async function uploadDocument(dealId: string, file: File): Promise<any> {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('title', file.name);
  formData.append('deal', dealId);
  formData.append('mime_type', file.type);

  const response = await fetch(`${API_BASE}/documents/`, {
    method: 'POST',
    body: formData,
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || `Не удалось загрузить файл: ${response.status}`);
  }

  return (await response.json()) as any;
}

export async function deleteDocument(id: string): Promise<void> {
  await request(`/documents/${id}/`, { method: 'DELETE' });
}

const mapChatMessage = (raw: any): ChatMessage => ({
  id: raw.id,
  deal: raw.deal,
  author_name: raw.author_name,
  author_username: raw.author_username,
  author: raw.author,
  body: raw.body,
  created_at: raw.created_at,
});

export async function fetchChatMessages(dealId: string): Promise<ChatMessage[]> {
  const payload = await request<any>(`/chat_messages/?deal=${dealId}`);
  return unwrapList(payload).map(mapChatMessage);
}

export async function createChatMessage(
  dealId: string,
  authorName: string,
  body: string
): Promise<ChatMessage> {
  const payload = await request<any>('/chat_messages/', {
    method: 'POST',
    body: JSON.stringify({
      deal: dealId,
      author_name: authorName,
      body: body,
    }),
  });
  return mapChatMessage(payload);
}

export async function deleteChatMessage(id: string): Promise<void> {
  await request(`/chat_messages/${id}/`, { method: 'DELETE' });
}

export async function fetchFinancialRecords(): Promise<FinancialRecord[]> {
  const payload = await request<any>('/financial_records/');
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
  const payload = await request<any>('/financial_records/', {
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
  const payload = await request<any>(`/financial_records/${id}/`, {
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

export async function fetchActivityLogs(dealId: string): Promise<ActivityLog[]> {
  const payload = await request<any>(`/activity_logs/?deal=${dealId}`);
  return unwrapList(payload).map(mapActivityLog);
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

  const payload = await request<any>('/tasks/', {
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

  const payload = await request<any>(`/tasks/${id}/`, {
    method: 'PATCH',
    body: JSON.stringify(body),
  });
  return mapTask(payload);
}

export async function deleteTask(id: string): Promise<void> {
  await request(`/tasks/${id}/`, { method: 'DELETE' });
}
