import { Client, Deal, DealStatus, Payment, Policy, Task } from "./types";

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
  createdAt: raw.created_at,
  updatedAt: raw.updated_at,
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

export async function createClient(data: { name: string; phone?: string; birthDate?: string | null; }): Promise<Client> {
  const payload = await request<any>("/clients/", {
    method: "POST",
    body: JSON.stringify({
      name: data.name,
      phone: data.phone,
      birth_date: data.birthDate || null,
    }),
  });
  return mapClient(payload);
}

export async function updateClient(id: string, data: { name: string; phone?: string; birthDate?: string | null; }): Promise<Client> {
  const payload = await request<any>(`/clients/${id}/`, {
    method: "PATCH",
    body: JSON.stringify({
      name: data.name,
      phone: data.phone,
      birth_date: data.birthDate || null,
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




