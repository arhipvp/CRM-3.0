import { ActivityLog, Client, Deal, DealStatus, FinancialTransaction, Payment, Policy, Quote, Task, ChatMessage } from "./types";

const envBase = import.meta.env.VITE_API_URL;
const API_BASE = (envBase && envBase.trim() !== "" ? envBase : "/api/v1").replace(/\/$/, "");
async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, {
    headers: {
      "Content-Type": "application/json",
      ...options.headers,
    },
    ...options,
  });

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

const toCamel = (value: any) => value === null || value === undefined ? undefined : value;

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
  insurer: raw.insurer,
  insuranceType: raw.insurance_type,
  sumInsured: raw.sum_insured,
  premium: raw.premium,
  deductible: raw.deductible || undefined,
  comments: raw.comments || undefined,
  createdAt: raw.created_at,
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
  nextReviewDate: raw.next_review_date,
  source: raw.source,
  lossReason: raw.loss_reason,
  channel: raw.channel,
  createdAt: raw.created_at,
  quotes: Array.isArray(raw.quotes) ? raw.quotes.map(mapQuote) : [],
  documents: Array.isArray(raw.documents) ? raw.documents.map((d: any) => ({
    id: d.id,
    title: d.title,
    file: d.file,
    file_size: d.file_size,
    mime_type: d.mime_type,
    created_at: d.created_at,
  })) : [],
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

const mapPayment = (raw: any): Payment => ({
  id: raw.id,
  dealId: raw.deal,
  amount: raw.amount,
  description: raw.description,
  scheduledDate: raw.scheduled_date,
  actualDate: raw.actual_date,
  status: raw.status,
  createdAt: raw.created_at,
});

const mapTask = (raw: any): Task => ({
  id: raw.id,
  title: raw.title,
  description: raw.description,
  dealId: raw.deal,
  status: raw.status,
  priority: raw.priority,
  dueAt: raw.due_at,
  remindAt: raw.remind_at,
  checklist: Array.isArray(raw.checklist) ? raw.checklist : [],
  createdAt: raw.created_at,
});

const mapFinancialTransaction = (raw: any): FinancialTransaction => ({
  id: raw.id,
  dealId: raw.deal,
  dealTitle: raw.deal_title,
  transactionType: raw.transaction_type,
  transactionTypeDisplay: raw.transaction_type_display,
  amount: raw.amount,
  description: raw.description,
  transactionDate: raw.transaction_date,
  source: raw.source,
  category: raw.category,
  note: raw.note,
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

export async function fetchClients(): Promise<Client[]> {
  const payload = await request<any>("/clients/");
  return unwrapList(payload).map(mapClient);
}

export async function fetchDeals(): Promise<Deal[]> {
  const payload = await request<any>("/deals/");
  return unwrapList(payload).map(mapDeal);
}

export async function fetchPolicies(): Promise<Policy[]> {
  const payload = await request<any>("/policies/");
  return unwrapList(payload).map(mapPolicy);
}

export async function fetchPayments(): Promise<Payment[]> {
  const payload = await request<any>("/payments/");
  return unwrapList(payload).map(mapPayment);
}

export async function fetchTasks(): Promise<Task[]> {
  const payload = await request<any>("/tasks/");
  return unwrapList(payload).map(mapTask);
}

export async function createClient(data: { name: string; phone?: string; birthDate?: string | null; notes?: string | null; }): Promise<Client> {
  const payload = await request<any>("/clients/", {
    method: "POST",
    body: JSON.stringify({
      name: data.name,
      phone: data.phone,
      birth_date: data.birthDate || null,
      notes: data.notes ?? "",
    }),
  });
  return mapClient(payload);
}

export async function updateClient(id: string, data: { name: string; phone?: string; birthDate?: string | null; notes?: string | null; }): Promise<Client> {
  const payload = await request<any>(`/clients/${id}/`, {
    method: "PATCH",
    body: JSON.stringify({
      name: data.name,
      phone: data.phone,
      birth_date: data.birthDate || null,
      notes: data.notes ?? "",
    }),
  });
  return mapClient(payload);
}

export async function createDeal(data: { title: string; description?: string; clientId: string; expectedClose?: string | null; }): Promise<Deal> {
  const payload = await request<any>("/deals/", {
    method: "POST",
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
    method: "PATCH",
    body: JSON.stringify({ status }),
  });
  return mapDeal(payload);
}

export async function updatePayment(id: string, data: Partial<Pick<Payment, "status" | "actualDate" | "scheduledDate" | "description" | "amount">>): Promise<Payment> {
  const payload = await request<any>(`/payments/${id}/`, {
    method: "PATCH",
    body: JSON.stringify({
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
  insurer: string;
  insuranceType: string;
  sumInsured: number;
  premium: number;
  deductible?: string;
  comments?: string;
}): Promise<Quote> {
  const payload = await request<any>("/quotes/", {
    method: "POST",
    body: JSON.stringify({
      deal: data.dealId,
      insurer: data.insurer,
      insurance_type: data.insuranceType,
      sum_insured: data.sumInsured,
      premium: data.premium,
      deductible: data.deductible,
      comments: data.comments,
    }),
  });
  return mapQuote(payload);
}

export async function deleteQuote(id: string): Promise<void> {
  await request(`/quotes/${id}/`, { method: "DELETE" });
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
  const payload = await request<any>("/policies/", {
    method: "POST",
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
  amount: number;
  description?: string;
  scheduledDate?: string | null;
  actualDate?: string | null;
  status?: "planned" | "partial" | "paid";
}): Promise<Payment> {
  const payload = await request<any>("/payments/", {
    method: "POST",
    body: JSON.stringify({
      deal: data.dealId || null,
      amount: data.amount,
      description: data.description || "",
      scheduled_date: data.scheduledDate || null,
      actual_date: data.actualDate || null,
      status: data.status || "planned",
    }),
  });
  return mapPayment(payload);
}

export async function deletePolicy(id: string): Promise<void> {
  await request(`/policies/${id}/`, { method: "DELETE" });
}

export async function uploadDocument(dealId: string, file: File): Promise<any> {
  const formData = new FormData();
  formData.append("file", file);
  formData.append("title", file.name);
  formData.append("deal", dealId);
  formData.append("mime_type", file.type);

  const response = await fetch(`${API_BASE}/documents/`, {
    method: "POST",
    body: formData,
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || `Не удалось загрузить файл: ${response.status}`);
  }

  return (await response.json()) as any;
}

export async function deleteDocument(id: string): Promise<void> {
  await request(`/documents/${id}/`, { method: "DELETE" });
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

export async function createChatMessage(dealId: string, authorName: string, body: string): Promise<ChatMessage> {
  const payload = await request<any>("/chat_messages/", {
    method: "POST",
    body: JSON.stringify({
      deal: dealId,
      author_name: authorName,
      body: body,
    }),
  });
  return mapChatMessage(payload);
}

export async function deleteChatMessage(id: string): Promise<void> {
  await request(`/chat_messages/${id}/`, { method: "DELETE" });
}

export async function fetchFinancialTransactions(): Promise<FinancialTransaction[]> {
  const payload = await request<any>("/financial_transactions/");
  return unwrapList(payload).map(mapFinancialTransaction);
}

export async function createFinancialTransaction(data: {
  dealId?: string;
  transactionType: "income" | "expense";
  amount: number;
  description?: string;
  transactionDate: string;
  source?: string;
  category?: string;
  note?: string;
}): Promise<FinancialTransaction> {
  const payload = await request<any>("/financial_transactions/", {
    method: "POST",
    body: JSON.stringify({
      deal: data.dealId || null,
      transaction_type: data.transactionType,
      amount: data.amount,
      description: data.description || "",
      transaction_date: data.transactionDate,
      source: data.source || "",
      category: data.category || "",
      note: data.note || "",
    }),
  });
  return mapFinancialTransaction(payload);
}

export async function updateFinancialTransaction(
  id: string,
  data: Partial<Omit<FinancialTransaction, "id" | "createdAt">>
): Promise<FinancialTransaction> {
  const payload = await request<any>(`/financial_transactions/${id}/`, {
    method: "PATCH",
    body: JSON.stringify({
      deal: data.dealId || null,
      transaction_type: data.transactionType,
      amount: data.amount,
      description: data.description || "",
      transaction_date: data.transactionDate,
      source: data.source || "",
      category: data.category || "",
      note: data.note || "",
    }),
  });
  return mapFinancialTransaction(payload);
}

export async function deleteFinancialTransaction(id: string): Promise<void> {
  await request(`/financial_transactions/${id}/`, { method: "DELETE" });
}

export async function fetchActivityLogs(dealId: string): Promise<ActivityLog[]> {
  const payload = await request<any>(`/activity_logs/?deal=${dealId}`);
  return unwrapList(payload).map(mapActivityLog);
}




