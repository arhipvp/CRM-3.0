import type {
  Citation,
  Conversation,
  DocumentItem,
  Health,
  Message,
  ProvidersResponse,
  Usage,
  UsageSummary,
} from "../types";

const API = "/api";

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API}${path}`, init);
  if (!response.ok) {
    const body = await response.json().catch(() => null);
    throw new Error(body?.detail || "Не удалось выполнить запрос.");
  }
  if (response.status === 204) return undefined as T;
  return response.json() as Promise<T>;
}

function collection<T>(
  value: T[] | { items?: T[]; documents?: T[]; conversations?: T[] },
): T[] {
  if (Array.isArray(value)) return value;
  return value.items ?? value.documents ?? value.conversations ?? [];
}

export async function getDocuments(): Promise<DocumentItem[]> {
  return collection(
    await request<DocumentItem[] | { documents?: DocumentItem[] }>(
      "/documents",
    ),
  );
}

export async function uploadDocuments(files: File[]): Promise<DocumentItem[]> {
  const data = new FormData();
  files.forEach((file) => data.append("files", file));
  const result = await request<DocumentItem[] | { documents?: DocumentItem[] }>(
    "/documents",
    { method: "POST", body: data },
  );
  return collection(result);
}

export function deleteDocument(id: string): Promise<void> {
  return request<void>(`/documents/${id}`, { method: "DELETE" });
}

export async function getConversations(): Promise<Conversation[]> {
  return collection(
    await request<Conversation[] | { conversations?: Conversation[] }>(
      "/conversations",
    ),
  );
}

export function createConversation(): Promise<Conversation> {
  return request<Conversation>("/conversations", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: "{}",
  });
}

export function getConversation(id: string): Promise<Conversation> {
  return request<Message[]>(`/conversations/${id}/messages`).then(
    (messages) => ({ id, title: "", messages }),
  );
}

export function deleteConversation(id: string): Promise<void> {
  return request<void>(`/conversations/${id}`, { method: "DELETE" });
}

export function getHealth(): Promise<Health> {
  return request<Health>("/health");
}

export function getProviders(): Promise<ProvidersResponse> {
  return request<ProvidersResponse>("/providers");
}

export function getUsage(): Promise<UsageSummary> {
  return request<UsageSummary>("/usage");
}

type StreamUpdate = {
  token?: string;
  content?: string;
  text?: string;
  citations?: Citation[];
  done?: boolean;
  error?: string;
  usage?: Usage;
  request_status?: string;
};

function decodeEvent(data: string, event?: string): StreamUpdate | undefined {
  if (!data || data === "[DONE]") return { done: true };
  if (event === "sources") {
    try {
      return { citations: JSON.parse(data) as Citation[] };
    } catch {
      return undefined;
    }
  }
  if (event === "delta") return { token: data };
  if (event === "error") return { error: data };
  try {
    return JSON.parse(data) as StreamUpdate;
  } catch {
    return { token: data };
  }
}

export async function streamMessage(
  conversationId: string,
  content: string,
  provider: string,
  model: string,
  onUpdate: (value: StreamUpdate) => void,
): Promise<void> {
  const response = await fetch(
    `${API}/conversations/${conversationId}/messages`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "text/event-stream",
      },
      body: JSON.stringify({ content, provider, model }),
    },
  );
  if (!response.ok || !response.body)
    throw new Error("Не удалось получить ответ помощника.");

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  while (true) {
    const result = await reader.read();
    if (result.done) break;
    buffer += decoder
      .decode(result.value, { stream: true })
      .replace(/\r\n/g, "\n");
    const parts = buffer.split("\n\n");
    buffer = parts.pop() ?? "";
    for (const raw of parts) {
      const event = raw
        .split("\n")
        .find((line) => line.startsWith("event:"))
        ?.slice(6)
        .trim();
      const data = raw
        .split("\n")
        .filter((line) => line.startsWith("data:"))
        .map((line) => line.slice(5).trimStart())
        .join("\n");
      const update = decodeEvent(data, event);
      if (update) onUpdate(update);
    }
  }
  const finalEvent = buffer
    .split("\n")
    .find((line) => line.startsWith("event:"))
    ?.slice(6)
    .trim();
  const final = decodeEvent(
    buffer
      .split("\n")
      .filter((line) => line.startsWith("data:"))
      .map((line) => line.slice(5).trimStart())
      .join("\n"),
    finalEvent,
  );
  if (final) onUpdate(final);
}

export type { Message };
