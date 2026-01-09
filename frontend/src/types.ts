export type DealStatus = 'open' | 'won' | 'lost' | 'on_hold';
export type TaskStatus = 'todo' | 'in_progress' | 'done' | 'overdue' | 'canceled';
export type TaskPriority = 'low' | 'normal' | 'high' | 'urgent';

export type ActivityActionType =
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

export type FinancialRecordType = 'Доход' | 'Расход';
export type StatementType = 'income' | 'expense';
export type StatementStatus = 'draft' | 'paid';

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
  email?: string | null;
  birthDate?: string | null;
  notes?: string | null;
  createdAt: string;
  updatedAt: string;
  driveFolderId?: string | null;
}

export interface Quote {
  id: string;
  dealId: string;
  sellerId?: string | null;
  sellerName?: string | null;
  insuranceCompanyId: string;
  insuranceCompany: string;
  insuranceTypeId: string;
  insuranceType: string;
  sumInsured: number;
  premium: number;
  deductible?: string;
  comments?: string;
  createdAt: string;
  deletedAt?: string | null;
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

export interface KnowledgeCitation {
  sourceId: string;
  documentId: string;
  title: string;
  fileUrl?: string | null;
}

export interface KnowledgeNotebook {
  id: string;
  name: string;
  description?: string | null;
  createdAt?: string | null;
  updatedAt?: string | null;
}

export interface KnowledgeSource {
  id: string;
  title?: string | null;
  embedded?: boolean | null;
  fileUrl?: string | null;
  createdAt?: string | null;
  updatedAt?: string | null;
}

export interface KnowledgeSourceDetail {
  id: string;
  title?: string | null;
  content?: string | null;
  createdAt?: string | null;
  updatedAt?: string | null;
  assetUrl?: string | null;
  fileUrl?: string | null;
}

export interface KnowledgeChatSession {
  id: string;
  title?: string | null;
  notebookId?: string | null;
  createdAt?: string | null;
  updatedAt?: string | null;
  messageCount?: number | null;
}

export interface KnowledgeSavedAnswer {
  id: string;
  question: string;
  answer: string;
  citations: KnowledgeCitation[];
  createdAt: string;
  updatedAt: string;
}


export interface SalesChannel {
  id: string;
  name: string;
  description?: string;
  createdAt: string;
  updatedAt: string;
  deletedAt?: string | null;
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

export interface PolicyRecognitionResult {
  fileId: string;
  fileName?: string | null;
  status: 'parsed' | 'error' | 'exists';
  message?: string;
  transcript?: string | null;
  data?: Record<string, unknown>;
}

export interface ChatMessage {
  id: string;
  deal: string;
  author_name: string;
  author_username?: string | null;
  author_display_name: string;
  author?: string | null;
  body: string;
  created_at: string;
  showDeleteButton?: boolean;
}

export interface Deal {
  id: string;
  title: string;
  description?: string;
  clientId: string;
  clientName?: string;
  status: DealStatus;
  stageName?: string;
  expectedClose?: string | null;
  nextContactDate?: string | null;
  source?: string;
  lossReason?: string;
  closingReason?: string;
  createdAt: string;
  quotes: Quote[];
  documents: Document[];
  driveFolderId?: string | null;
  deletedAt?: string | null;
  seller?: string | null;
  executor?: string | null;
  sellerName?: string | null;
  executorName?: string | null;
  paymentsPaid?: string;
  paymentsTotal?: string;
}

export interface DealMergeResponse {
  targetDeal: Deal;
  mergedDealIds: string[];
  movedCounts: Record<string, number>;
}

export interface ClientMergeResponse {
  targetClient: Client;
  mergedClientIds: string[];
  movedCounts: Record<string, number>;
}

export interface Policy {
  id: string;
  number: string;
  insuranceCompanyId: string;
  insuranceCompany: string;
  insuranceTypeId: string;
  insuranceType: string;
  dealId: string;
  dealTitle?: string;
  clientId?: string;
  clientName?: string;
  insuredClientId?: string;
  insuredClientName?: string;
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
  status: string;
  paymentsPaid?: string;
  paymentsTotal?: string;
  createdAt: string;
  updatedAt?: string;
  driveFolderId?: string | null;
}

export interface FinancialRecord {
  id: string;
  paymentId: string;
  statementId?: string | null;
  paymentDescription?: string;
  paymentAmount?: string;
  paymentPaidBalance?: string;
  paymentPaidEntries?: Array<{
    amount: string;
    date: string;
  }>;
  amount: string; // Положительное = доход, отрицательное = расход
  date?: string | null;
  description?: string;
  source?: string;
  note?: string;
  recordType?: FinancialRecordType; // Вычисляемое поле
  createdAt: string;
  updatedAt: string;
  deletedAt?: string | null;
}

export interface Payment {
  id: string;
  dealId?: string;
  dealTitle?: string;
  dealClientName?: string;
  policyId?: string;
  policyNumber?: string;
  policyInsuranceType?: string;
  amount: string;
  description?: string;
  note?: string;
  scheduledDate?: string | null;
  actualDate?: string | null;
  financialRecords?: FinancialRecord[];
  canDelete?: boolean;
  createdAt: string;
  updatedAt: string;
  deletedAt?: string | null;
}

export interface Statement {
  id: string;
  name: string;
  statementType: StatementType;
  status: StatementStatus;
  counterparty?: string | null;
  paidAt?: string | null;
  comment?: string | null;
  createdBy?: string | null;
  driveFolderId?: string | null;
  recordsCount?: number;
  totalAmount?: string;
  createdAt: string;
  updatedAt: string;
  deletedAt?: string | null;
}

export type FinancialRecordCreationContext = {
  paymentId: string;
  recordType: 'income' | 'expense';
};

export interface PaymentModalState {
  policyId?: string;
  paymentId?: string;
}

export interface FinancialRecordModalState {
  paymentId?: string;
  recordId?: string;
}

export interface SellerDashboardPolicy {
  id: string;
  number: string;
  insuranceCompany: string;
  insuranceType: string;
  clientName?: string | null;
  insuredClientName?: string | null;
  startDate?: string | null;
  paidAmount: string;
}

export interface SellerDashboardPaymentsByDay {
  date: string;
  total: string;
}

export interface SellerDashboardTasksByDay {
  date: string;
  count: number;
}

export interface SellerDashboardTasksByExecutor {
  date: string;
  executorId?: string | null;
  executorName: string;
  count: number;
}

export interface SellerDashboardResponse {
  rangeStart: string;
  rangeEnd: string;
  totalPaid: string;
  tasksCurrent: number;
  tasksCompleted: number;
  paymentsByDay: SellerDashboardPaymentsByDay[];
  tasksCompletedByDay: SellerDashboardTasksByDay[];
  tasksCompletedByExecutor: SellerDashboardTasksByExecutor[];
  policies: SellerDashboardPolicy[];
}

export interface Note {
  id: string;
  dealId: string;
  dealTitle?: string;
  body: string;
  authorName?: string | null;
  attachments?: DriveFile[];
  createdAt: string;
  updatedAt: string;
  deletedAt?: string | null;
}

export interface ActivityLog {
  id: string;
  deal: string;
  actionType: ActivityActionType;
  actionTypeDisplay: string;
  description: string;
  user?: string | null;
  userUsername?: string | null;
  oldValue?: string;
  newValue?: string;
  createdAt: string;
  objectId?: string;
  objectType?: string;
  objectName?: string | null;
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
  dealTitle?: string;
  clientName?: string;
  createdByName?: string | null;
  assignee?: string | null;
  assigneeName?: string | null;
  status: TaskStatus;
  priority: TaskPriority;
  dueAt?: string | null;
  remindAt?: string | null;
  checklist: ChecklistItem[];
  createdAt: string;
  completedAt?: string | null;
  completedByName?: string | null;
  deletedAt?: string | null;
}
