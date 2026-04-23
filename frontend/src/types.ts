export type DealStatus = 'open' | 'won' | 'lost' | 'on_hold';
export type TaskStatus = 'todo' | 'in_progress' | 'done' | 'overdue' | 'canceled';
export type TaskPriority = 'low' | 'normal' | 'high' | 'urgent';
export type PolicyStatus = 'active' | 'inactive' | 'expired' | 'canceled';

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
  isCounterparty?: boolean;
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
  deductible?: number | null;
  officialDealer: boolean;
  gap: boolean;
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
  parentId?: string | null;
}

export interface PolicyRecognitionResult {
  fileId: string;
  fileName?: string | null;
  status: 'parsed' | 'error' | 'exists';
  message?: string;
  transcript?: string | null;
  data?: Record<string, unknown>;
}

export interface PolicyIssuanceLogEntry {
  timestamp: string;
  level: string;
  step?: string;
  message: string;
}

export interface PolicyIssuanceStatus {
  id: string;
  provider: string;
  product: string;
  status: 'queued' | 'running' | 'waiting_manual' | 'succeeded' | 'failed' | 'canceled';
  step: string;
  manualStepReason?: string;
  manualStepInstructions?: string;
  externalPolicyNumber?: string;
  lastError?: string;
  startedAt?: string | null;
  finishedAt?: string | null;
  updatedAt: string;
  createdAt: string;
  vncHint?: string;
  log: PolicyIssuanceLogEntry[];
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
  clientActiveDealsCount?: number;
  status: DealStatus;
  stageName?: string;
  isPinned?: boolean;
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
  mailboxId?: number | null;
  mailboxEmail?: string | null;
  paymentsPaid?: string;
  paymentsTotal?: string;
  visibleUsers?: string[];
}

export interface DealTimeTrackingSummary {
  enabled: boolean;
  tickSeconds: number;
  confirmIntervalSeconds: number;
  myTotalSeconds: number;
  myTotalHuman: string;
}

export interface DealTimeTrackingTickResponse {
  enabled: boolean;
  tickSeconds: number;
  confirmIntervalSeconds: number;
  counted: boolean;
  bucketStart?: string | null;
  myTotalSeconds: number;
  reason?: string;
}

export interface DealMergeResponse {
  resultDeal: Deal;
  mergedDealIds: string[];
  movedCounts: Record<string, number>;
  warnings?: string[];
  details?: Record<string, unknown>;
}

export interface DealSimilarityCandidate {
  deal: Deal;
  score: number;
  confidence: 'high' | 'medium' | 'low';
  reasons: string[];
  matchedFields: Record<string, unknown>;
  mergeBlockers: string[];
}

export interface DealSimilarityResponse {
  targetDeal: Deal;
  candidates: DealSimilarityCandidate[];
  meta: {
    totalChecked: number;
    returned: number;
    scoringVersion: string;
  };
}

export interface ClientSimilarityCandidate {
  client: Client;
  score: number;
  confidence: 'high' | 'medium' | 'low';
  reasons: string[];
  matchedFields: Record<string, boolean>;
}

export interface ClientSimilarResponse {
  targetClient: Client;
  candidates: ClientSimilarityCandidate[];
  meta: {
    totalChecked: number;
    returned: number;
    scoringVersion: string;
  };
}

export interface ClientMergeResponse {
  targetClient: Client;
  mergedClientIds: string[];
  movedCounts: Record<string, number>;
  warnings?: string[];
  details?: Record<string, unknown>;
}

export interface ClientMergePreviewResponse {
  targetClientId: string;
  sourceClientIds: string[];
  includeDeleted: boolean;
  previewSnapshotId: string;
  movedCounts: Record<string, number>;
  items: Record<string, Array<Record<string, unknown>>>;
  canonicalProfile: {
    name: string;
    phone: string;
    email?: string | null;
    notes: string;
    candidates?: Record<string, string[]>;
  };
  drivePlan: Array<Record<string, unknown>>;
  warnings: string[];
}

export interface DealMergePreviewResponse {
  targetDealId: string;
  sourceDealIds: string[];
  includeDeleted: boolean;
  movedCounts: Record<string, number>;
  items: Record<string, Array<Record<string, unknown>>>;
  drivePlan: Array<Record<string, unknown>>;
  warnings: string[];
  finalDealDraft?: {
    title: string;
    description?: string;
    clientId: string;
    expectedClose?: string | null;
    executorId?: string | null;
    sellerId?: string | null;
    source?: string;
    nextContactDate?: string | null;
    visibleUserIds?: string[];
  };
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
  note?: string;
  salesChannel?: string;
  salesChannelId?: string;
  salesChannelName?: string;
  renewedById?: string | null;
  renewedByNumber?: string | null;
  isRenewed?: boolean;
  startDate?: string | null;
  endDate?: string | null;
  status: PolicyStatus;
  computedStatus?: 'problem' | 'due' | 'expired' | 'active';
  paymentsPaid?: string;
  paymentsTotal?: string;
  createdAt: string;
  updatedAt?: string;
  driveFolderId?: string | null;
}

export interface PoliciesKPI {
  total: number;
  problemCount: number;
  dueCount: number;
  expiringSoonCount: number;
  expiringDays: number;
}

export interface FinancialRecord {
  id: string;
  paymentId: string;
  statementId?: string | null;
  paymentDescription?: string;
  paymentAmount?: string;
  paymentActualDate?: string | null;
  paymentScheduledDate?: string | null;
  dealId?: string | null;
  dealTitle?: string | null;
  dealClientName?: string | null;
  policyId?: string | null;
  policyNumber?: string | null;
  policyInsuranceType?: string | null;
  policyClientName?: string | null;
  policyInsuredClientName?: string | null;
  salesChannelName?: string | null;
  paymentPaidBalance?: string;
  paymentPaidEntries?: Array<{
    amount: string;
    date: string;
  }>;
  amount: string; // На этапе совместимости знак сохраняется в amount
  date?: string | null;
  description?: string;
  source?: string;
  note?: string;
  recordType?: FinancialRecordType; // Основной тип записи из API, знак служит fallback
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

export interface SellerDashboardDayCount {
  date: string;
  count: number;
}

export interface SellerDashboardTasksByExecutor {
  date: string;
  executorId?: string | null;
  executorName: string;
  count: number;
}

export interface SellerDashboardFinancialTotals {
  incomeTotal: string;
  expenseTotal: string;
  netTotal: string;
  recordsCount: number;
}

export interface SellerDashboardFinancialByCompanyTypeRow {
  insuranceCompanyId?: string | null;
  insuranceCompanyName: string;
  insuranceTypeId?: string | null;
  insuranceTypeName: string;
  incomeTotal: string;
  expenseTotal: string;
  netTotal: string;
  recordsCount: number;
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
  policyExpirationsByDay: SellerDashboardDayCount[];
  nextContactsByDay: SellerDashboardDayCount[];
  financialTotals: SellerDashboardFinancialTotals;
  financialByCompanyType: SellerDashboardFinancialByCompanyTypeRow[];
  policies: SellerDashboardPolicy[];
}

export interface Note {
  id: string;
  dealId: string;
  dealTitle?: string;
  body: string;
  authorName?: string | null;
  attachments?: DriveFile[];
  isImportant: boolean;
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
