export type DocumentStatus = "queued" | "indexing" | "ready" | "failed";

export interface SourceLocation {
  page?: number;
  sheet?: string;
  slide?: number;
  attachment_name?: string;
}

export interface DocumentItem {
  id: string;
  filename: string;
  status: DocumentStatus;
  size?: number;
  error?: string;
  created_at?: string;
  source_count?: number;
}

export interface Citation {
  id?: string;
  document_id: string;
  filename: string;
  excerpt?: string;
  location?: SourceLocation;
}

export interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  citations?: Citation[];
  created_at?: string;
  provider?: string;
  model?: string;
  usage?: Usage;
  request_status?: string;
}

export interface Usage {
  provider: string;
  model: string;
  input_tokens?: number | null;
  output_tokens?: number | null;
  total_tokens?: number | null;
  cost_rub?: number | null;
}

export interface ProviderInfo {
  id: "codex" | "polza";
  label: string;
  available: boolean;
  models: string[];
  default_model?: string | null;
  billing?: string;
  error?: string;
}

export interface ProvidersResponse {
  providers: ProviderInfo[];
}

export interface UsageSummary {
  providers: Array<{
    provider: string;
    requests: number;
    cost_rub: number;
    input_tokens: number;
    output_tokens: number;
    total_tokens: number;
  }>;
  requests: number;
  cost_rub: number;
}

export interface Conversation {
  id: string;
  title: string;
  created_at?: string;
  updated_at?: string;
  messages?: Message[];
}

export interface Health {
  qdrant?: boolean | { status?: string };
  embeddings?: boolean | { status?: string };
  codex?: boolean | { status?: string };
}
