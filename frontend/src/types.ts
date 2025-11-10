// Fix: Implemented type definitions for the application's data structures.
export type DealStatus = 'Новая' | 'Расчет' | 'Переговоры' | 'Оформление' | 'Ожидает продления' | 'Закрыта';
export type PolicyType = 'Авто' | 'Имущество' | 'Жизнь' | 'Здоровье';
export type PaymentStatus = 'Оплачен' | 'Просрочен' | 'Ожидает';
export type FinancialTransactionType = 'Доход' | 'Расход';

export interface Client {
  id: string;
  name: string;
  email: string;
  phone: string;
  address: string;
  birthDate?: string;
  notes?: string;
}

export interface Subtask {
  id: string;
  description: string;
  completed: boolean;
}

export interface Task {
  id: string;
  description: string;
  completed: boolean;
  assignee: string;
  dueDate: string;
  subtasks?: Subtask[];
  attachments?: FileAttachment[];
}

export interface Note {
  id: string;
  content: string;
  createdAt: string;
  status: 'active' | 'archived';
}

export interface Quote {
  id: string;
  insurer: string;
  insuranceType: string;
  sumInsured: number;
  premium: number;
  deductible: string;
  comments: string;
}

export interface FileAttachment {
  id: string;
  name: string;
  size: number;
  url: string;
}

export interface ChatMessage {
  id: string;
  sender: string;
  text: string;
  timestamp: string;
}

export interface ActivityLog {
  id: string;
  timestamp: string;
  user: string;
  action: string;
}

export interface Deal {
  id: string;
  title: string;
  clientId: string;
  status: DealStatus;
  owner: string;
  assistant?: string;
  summary: string;
  nextReviewDate: string;
  tasks: Task[];
  notes: Note[];
  quotes: Quote[];
  files: FileAttachment[];
  chat: ChatMessage[];
  activityLog: ActivityLog[];
}

export interface Policy {
  id: string;
  policyNumber: string;
  type: PolicyType;
  startDate: string;
  endDate: string;
  counterparty: string;
  salesChannel: string;
  clientId: string;
  dealId: string;
  carBrand?: string;
  carModel?: string;
  vin?: string;
  notes?: string;
}

export interface Payment {
  id: string;
  policyId: string;
  clientId: string;
  amount: number;
  dueDate: string;
  status: PaymentStatus;
}

export interface FinancialTransaction {
  id: string;
  description: string;
  amount: number;
  type: FinancialTransactionType;
  date: string; // planned date
  paymentDate?: string; // actual payment date
  dealId?: string;
  policyId?: string;
}
