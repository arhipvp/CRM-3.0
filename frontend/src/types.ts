export type DealStatus = "open" | "won" | "lost" | "on_hold";
export type PaymentStatus = "planned" | "partial" | "paid";
export type TaskStatus = "todo" | "in_progress" | "done" | "overdue" | "canceled";
export type TaskPriority = "low" | "normal" | "high" | "urgent";

export interface User {
  id: string;
  username: string;
  roles: string[];
}

export interface Client {
  id: string;
  name: string;
  phone?: string;
  birthDate?: string | null;
  notes?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Quote {
  id: string;
  dealId: string;
  insurer: string;
  insuranceType: string;
  sumInsured: string;
  premium: string;
  deductible?: string;
  comments?: string;
  createdAt: string;
}

export interface Document {
  id: string;
  title: string;
  file?: string | null;
  file_size: number;
  mime_type: string;
  created_at: string;
}

export interface ChatMessage {
  id: string;
  deal: string;
  author_name: string;
  author_username?: string | null;
  author?: string | null;
  body: string;
  created_at: string;
}

export interface Deal {
  id: string;
  title: string;
  description?: string;
  clientId: string;
  clientName?: string;
  status: DealStatus;
  stageName?: string;
  probability: number;
  expectedClose?: string | null;
  nextReviewDate?: string | null;
  source?: string;
  lossReason?: string;
  channel?: string;
  createdAt: string;
  quotes: Quote[];
  documents: Document[];
}

export interface Policy {
  id: string;
  number: string;
  insuranceCompany: string;
  insuranceType: string;
  dealId: string;
  vin?: string;
  startDate?: string | null;
  endDate?: string | null;
  amount: string;
  status: string;
  createdAt: string;
}

export interface FinancialRecord {
  id: string;
  paymentId: string;
  paymentDescription?: string;
  paymentAmount?: string;
  amount: string; // Положительное = доход, отрицательное = расход
  date?: string | null;
  description?: string;
  source?: string;
  note?: string;
  recordType?: "Доход" | "Расход"; // Вычисляемое поле
  createdAt: string;
  updatedAt: string;
  deletedAt?: string | null;
}

export interface Payment {
  id: string;
  dealId?: string;
  dealTitle?: string;
  policyId?: string;
  policyNumber?: string;
  policyInsuranceType?: string;
  amount: string;
  description?: string;
  scheduledDate?: string | null;
  actualDate?: string | null;
  status: PaymentStatus;
  financialRecords?: FinancialRecord[];
  canDelete?: boolean;
  createdAt: string;
  updatedAt: string;
  deletedAt?: string | null;
}

export interface ActivityLog {
  id: string;
  deal: string;
  actionType: "created" | "status_changed" | "stage_changed" | "description_updated" | "assigned" | "policy_created" | "quote_added" | "document_uploaded" | "payment_created" | "comment_added" | "custom";
  actionTypeDisplay: string;
  description: string;
  user?: string | null;
  userUsername?: string | null;
  oldValue?: string;
  newValue?: string;
  createdAt: string;
}

export interface ChecklistItem {
  label: string;
  done: boolean;
}

export interface Task {
  id: string;
  title: string;
  description?: string;
  dealId?: string;
  status: TaskStatus;
  priority: TaskPriority;
  dueAt?: string | null;
  remindAt?: string | null;
  checklist: ChecklistItem[];
  createdAt: string;
}
