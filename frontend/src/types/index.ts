// User type
export interface User {
  id: string;
  username: string;
  roles: string[];
  firstName?: string;
  lastName?: string;
}

// Client type
export interface Client {
  id: string;
  name: string;
  phone?: string | null;
  birthDate?: string | null;
  notes?: string | null;
  createdAt: string;
  updatedAt: string;
}

// Quote type
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

// Deal Status type
export type DealStatus = 'open' | 'won' | 'lost' | 'on_hold';

// Document type
export interface Document {
  id: string;
  title: string;
  file: string;
  file_size?: number;
  mime_type?: string;
  created_at: string;
}


export interface SalesChannel {
  id: string;
  name: string;
  description?: string;
  createdAt: string;
  updatedAt: string;
  deletedAt?: string | null;
}

// Deal type
export interface Deal {
  id: string;
  title: string;
  description?: string;
  clientId: string;
  clientName: string;
  status: DealStatus;
  stageName?: string;
  expectedClose?: string | null;
  nextContactDate?: string | null;
  source?: string;
  lossReason?: string;
  createdAt: string;
  quotes?: Quote[];
  documents?: Document[];
  seller?: string | null;
  executor?: string | null;
  sellerName?: string | null;
  executorName?: string | null;
}

// Policy type
export interface Policy {
  id: string;
  number: string;
  insuranceCompanyId: string;
  insuranceCompany: string;
  insuranceTypeId: string;
  insuranceType: string;
  dealId: string;
  isVehicle: boolean;
  brand?: string;
  model?: string;
  vin?: string;
  counterparty?: string;
  salesChannel?: string;
  salesChannelId?: string;
  salesChannelName?: string;
  startDate?: string | null;
  endDate?: string | null;
  status?: string;
  createdAt: string;
}

// Payment Status type
export type PaymentStatus = 'planned' | 'partial' | 'paid';

// Financial Record type
export interface FinancialRecord {
  id: string;
  paymentId: string;
  paymentDescription?: string;
  paymentAmount?: number;
  amount: number;
  date?: string | null;
  description: string;
  source: string;
  note?: string;
  recordType?: string;
  createdAt: string;
  updatedAt: string;
  deletedAt?: string | null;
}

// Payment type
export interface Payment {
  id: string;
  dealId: string;
  dealTitle: string;
  policyId?: string;
  policyNumber?: string;
  policyInsuranceType?: string;
  amount: number;
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

// Task type
export interface Task {
  id: string;
  title: string;
  description?: string;
  dealId: string;
  assignee?: string | null;
  assigneeName?: string | null;
  status: string;
  priority: string;
  dueAt?: string | null;
  remindAt?: string | null;
  checklist?: any[];
  createdAt: string;
}

// Chat Message type
export interface ChatMessage {
  id: string;
  deal: string;
  author_name?: string;
  author_username?: string;
  author?: string;
  body: string;
  created_at: string;
}

// Activity Log type
export interface ActivityLog {
  id: string;
  deal: string;
  actionType: string;
  actionTypeDisplay: string;
  description?: string;
  user?: string;
  userUsername?: string;
  oldValue?: any;
  newValue?: any;
  createdAt: string;
  objectId?: string;
  objectType?: string;
  objectName?: string | null;
}
