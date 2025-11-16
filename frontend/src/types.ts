export type DealStatus = 'open' | 'won' | 'lost' | 'on_hold';
export type PaymentStatus = 'planned' | 'partial' | 'paid';
export type TaskStatus = 'todo' | 'in_progress' | 'done' | 'overdue' | 'canceled';
export type TaskPriority = 'low' | 'normal' | 'high' | 'urgent';

export interface User {
  id: string;
  username: string;
  roles: string[];
  firstName?: string;
  lastName?: string;
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
  insuranceCompanyId: string;
  insuranceCompany: string;
  insuranceTypeId: string;
  insuranceType: string;
  sumInsured: number;
  premium: number;
  deductible?: string;
  comments?: string;
  createdAt: string;
}

export interface InsuranceCompany {
  id: string;
  name: string;
  description?: string;
  createdAt: string;
  updatedAt: string;
  deletedAt?: string | null;
}

export interface InsuranceType {
  id: string;
  name: string;
  description?: string;
  createdAt: string;
  updatedAt: string;
  deletedAt?: string | null;
}

export interface Document {
  id: string;
  title: string;
  file?: string | null;
  file_size: number;
  mime_type: string;
  created_at: string;
}

export interface DriveFile {
  id: string;
  name: string;
  mimeType: string;
  size?: number | null;
  createdAt?: string | null;
  modifiedAt?: string | null;
  webViewLink?: string | null;
  isFolder: boolean;
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
  nextContactDate?: string | null;
  source?: string;
  lossReason?: string;
  channel?: string;
  createdAt: string;
  quotes: Quote[];
  documents: Document[];
  driveFolderId?: string | null;
}

export interface Policy {
  id: string;
  number: string;
  insuranceCompanyId: string;
  insuranceCompany: string;
  insuranceTypeId: string;
  insuranceType: string;
  dealId: string;
  clientId?: string;
  clientName?: string;
  isVehicle: boolean;
  brand?: string;
  model?: string;
  vin?: string;
  counterparty?: string;
  startDate?: string | null;
  endDate?: string | null;
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
  recordType?: 'Доход' | 'Расход'; // Вычисляемое поле
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
  note?: string;
  scheduledDate?: string | null;
  actualDate?: string | null;
  status: PaymentStatus;
  financialRecords?: FinancialRecord[];
  canDelete?: boolean;
  createdAt: string;
  updatedAt: string;
  deletedAt?: string | null;
}

export interface Note {
  id: string;
  dealId: string;
  dealTitle?: string;
  body: string;
  authorName?: string | null;
  createdAt: string;
  updatedAt: string;
  deletedAt?: string | null;
}

export interface ActivityLog {
  id: string;
  deal: string;
  actionType:
    | 'created'
    | 'status_changed'
    | 'stage_changed'
    | 'description_updated'
    | 'assigned'
    | 'policy_created'
    | 'quote_added'
    | 'document_uploaded'
    | 'payment_created'
    | 'comment_added'
    | 'custom';
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
