export type DealStatus = "open" | "won" | "lost" | "on_hold";
export type PaymentStatus = "planned" | "partial" | "paid";
export type TaskStatus = "todo" | "in_progress" | "done" | "overdue" | "canceled";
export type TaskPriority = "low" | "normal" | "high" | "urgent";

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

export interface Payment {
  id: string;
  dealId?: string;
  amount: string;
  description?: string;
  scheduledDate?: string | null;
  actualDate?: string | null;
  status: PaymentStatus;
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
