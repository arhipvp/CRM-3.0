import type {
  ActivityActionType,
  ActivityLog,
  ChatMessage,
  Client,
  Deal,
  DealStatus,
  DriveFile,
  FinancialRecord,
  FinancialRecordType,
  InsuranceCompany,
  InsuranceType,
  KnowledgeCitation,
  KnowledgeChatSession,
  KnowledgeNotebook,
  KnowledgeSource,
  KnowledgeSourceDetail,
  KnowledgeSavedAnswer,
  Note,
  Payment,
  Policy,
  PolicyStatus,
  Quote,
  SalesChannel,
  Statement,
  Task,
  TaskPriority,
  TaskStatus,
  User,
} from '../types';
import {
  toNullableNumber,
  toNumberValue,
  toOptionalString,
  toNullableString,
  toStringValue,
} from './helpers';

const DEAL_STATUSES: DealStatus[] = ['open', 'won', 'lost', 'on_hold'];
const TASK_STATUSES: TaskStatus[] = ['todo', 'in_progress', 'done', 'overdue', 'canceled'];
const TASK_PRIORITIES: TaskPriority[] = ['low', 'normal', 'high', 'urgent'];
const POLICY_STATUSES: PolicyStatus[] = ['active', 'inactive', 'expired', 'canceled'];
const ACTIVITY_ACTION_TYPES: ActivityActionType[] = [
  'created',
  'status_changed',
  'stage_changed',
  'description_updated',
  'assigned',
  'policy_created',
  'quote_added',
  'document_uploaded',
  'payment_created',
  'comment_added',
  'custom',
];
const FINANCIAL_RECORD_TYPES: FinancialRecordType[] = ['Доход', 'Расход'];

const resolveStringUnion = <T extends string>(
  value: unknown,
  allowed: readonly T[],
  fallback: T,
): T => (typeof value === 'string' && allowed.includes(value as T) ? (value as T) : fallback);

const resolveOptionalStringUnion = <T extends string>(
  value: unknown,
  allowed: readonly T[],
): T | undefined =>
  typeof value === 'string' && allowed.includes(value as T) ? (value as T) : undefined;

const resolveRoleName = (value: unknown): string | undefined => {
  if (typeof value !== 'object' || value === null) {
    return undefined;
  }
  const record = value as Record<string, unknown>;
  return toOptionalString(record.name);
};

const resolveDealStatus = (value: unknown): DealStatus =>
  resolveStringUnion(value, DEAL_STATUSES, 'open');
const resolveTaskStatus = (value: unknown): TaskStatus =>
  resolveStringUnion(value, TASK_STATUSES, 'todo');
const resolveTaskPriority = (value: unknown): TaskPriority =>
  resolveStringUnion(value, TASK_PRIORITIES, 'normal');
const resolvePolicyStatus = (value: unknown): PolicyStatus =>
  resolveStringUnion(value, POLICY_STATUSES, 'active');
const resolveActivityActionType = (value: unknown): ActivityActionType =>
  resolveStringUnion(value, ACTIVITY_ACTION_TYPES, 'custom');
const resolveFinancialRecordType = (value: unknown): FinancialRecordType | undefined =>
  resolveOptionalStringUnion(value, FINANCIAL_RECORD_TYPES);

export const mapClient = (raw: Record<string, unknown>): Client => ({
  id: toStringValue(raw.id),
  name: toStringValue(raw.name),
  phone: toOptionalString(raw.phone),
  email: toNullableString(raw.email),
  birthDate: toNullableString(raw.birth_date ?? raw.birthDate),
  notes: toNullableString(raw.notes),
  createdAt: toStringValue(raw.created_at),
  updatedAt: toStringValue(raw.updated_at),
  driveFolderId: raw.drive_folder_id === undefined ? null : toNullableString(raw.drive_folder_id),
});

export const mapQuote = (raw: Record<string, unknown>): Quote => ({
  id: toStringValue(raw.id),
  dealId: toStringValue(raw.deal),
  sellerId: toNullableString(raw.seller),
  sellerName: toNullableString(raw.seller_name ?? raw.sellerName),
  insuranceCompanyId: toStringValue(raw.insurance_company),
  insuranceCompany: toStringValue(raw.insurance_company_name ?? raw.insurer ?? ''),
  insuranceTypeId: toStringValue(raw.insurance_type),
  insuranceType: toStringValue(raw.insurance_type_name ?? raw.insurance_type ?? ''),
  sumInsured: toNumberValue(raw.sum_insured),
  premium: toNumberValue(raw.premium),
  deductible: toOptionalString(raw.deductible),
  officialDealer: Boolean(raw.official_dealer ?? raw.officialDealer ?? false),
  gap: Boolean(raw.gap ?? false),
  comments: toOptionalString(raw.comments),
  createdAt: toStringValue(raw.created_at),
  deletedAt: raw.deleted_at === undefined ? null : toNullableString(raw.deleted_at),
});

export const mapInsuranceCompany = (raw: Record<string, unknown>): InsuranceCompany => ({
  id: toStringValue(raw.id),
  name: toStringValue(raw.name),
  description: toOptionalString(raw.description),
  createdAt: toStringValue(raw.created_at),
  updatedAt: toStringValue(raw.updated_at),
  deletedAt: toNullableString(raw.deleted_at),
});

export const mapInsuranceType = (raw: Record<string, unknown>): InsuranceType => ({
  id: toStringValue(raw.id),
  name: toStringValue(raw.name),
  description: toOptionalString(raw.description),
  createdAt: toStringValue(raw.created_at),
  updatedAt: toStringValue(raw.updated_at),
  deletedAt: toNullableString(raw.deleted_at),
});

export const mapDeal = (raw: Record<string, unknown>): Deal => {
  const quoteList = Array.isArray(raw.quotes) ? raw.quotes : [];
  const documentList = Array.isArray(raw.documents) ? raw.documents : [];
  const activeDealsCount = toNullableNumber(
    raw.client_active_deals_count ?? raw.clientActiveDealsCount,
  );
  return {
    id: toStringValue(raw.id),
    title: toStringValue(raw.title),
    description: toOptionalString(raw.description),
    clientId: toStringValue(raw.client),
    clientName: toOptionalString(raw.client_name),
    clientActiveDealsCount: activeDealsCount ?? undefined,
    status: resolveDealStatus(raw.status),
    stageName: toOptionalString(raw.stage_name),
    isPinned: Boolean(raw.is_pinned ?? raw.isPinned ?? false),
    expectedClose:
      raw.expected_close === undefined ? undefined : toNullableString(raw.expected_close),
    nextContactDate:
      raw.next_contact_date === undefined ? undefined : toNullableString(raw.next_contact_date),
    source: toOptionalString(raw.source),
    lossReason: toOptionalString(raw.loss_reason),
    closingReason: toOptionalString(raw.closing_reason),
    createdAt: toStringValue(raw.created_at),
    quotes: quoteList.map((quote) => mapQuote(quote as Record<string, unknown>)),
    documents: documentList.map((doc) => {
      const record = doc as Record<string, unknown>;
      return {
        id: toStringValue(record.id),
        title: toStringValue(record.title),
        file: toOptionalString(record.file),
        file_size: toNumberValue(record.file_size ?? record.fileSize),
        mime_type: toStringValue(record.mime_type ?? record.mimeType),
        created_at: toStringValue(record.created_at ?? record.createdAt),
      };
    }),
    driveFolderId: raw.drive_folder_id === undefined ? null : toNullableString(raw.drive_folder_id),
    paymentsPaid: toStringValue(raw.payments_paid ?? raw.paymentsPaid ?? '0'),
    paymentsTotal: toStringValue(raw.payments_total ?? raw.paymentsTotal ?? '0'),
    seller: toNullableString(raw.seller),
    executor: toNullableString(raw.executor),
    sellerName: toNullableString(raw.seller_name),
    executorName: toNullableString(raw.executor_name),
    visibleUsers: Array.isArray(raw.visible_users)
      ? raw.visible_users.map((value) => String(value))
      : undefined,
    deletedAt: raw.deleted_at === undefined ? null : toNullableString(raw.deleted_at),
  };
};

export const mapSalesChannel = (raw: Record<string, unknown>): SalesChannel => ({
  id: toStringValue(raw.id),
  name: toStringValue(raw.name),
  description: toOptionalString(raw.description) ?? '',
  createdAt: toStringValue(raw.created_at),
  updatedAt: toStringValue(raw.updated_at),
  deletedAt: toNullableString(raw.deleted_at),
});

export const mapDriveFile = (raw: Record<string, unknown>): DriveFile => {
  const sizeValue = raw.size ?? raw.file_size ?? raw.fileSize;
  return {
    id: toStringValue(raw.id),
    name: toStringValue(raw.name),
    mimeType: toStringValue(raw.mime_type ?? raw.mimeType ?? ''),
    size: toNullableNumber(sizeValue),
    createdAt: toNullableString(raw.created_at ?? raw.createdAt),
    modifiedAt: toNullableString(raw.modified_at ?? raw.modifiedAt),
    webViewLink: toNullableString(raw.web_view_link ?? raw.webViewLink),
    isFolder: Boolean(raw.is_folder ?? raw.isFolder ?? false),
  };
};

export const mapKnowledgeNotebook = (raw: Record<string, unknown>): KnowledgeNotebook => ({
  id: toStringValue(raw.id),
  name: toStringValue(raw.name ?? ''),
  description: toNullableString(raw.description),
  createdAt: toNullableString(raw.created ?? raw.created_at ?? raw.createdAt),
  updatedAt: toNullableString(raw.updated ?? raw.updated_at ?? raw.updatedAt),
});

export const mapKnowledgeSource = (raw: Record<string, unknown>): KnowledgeSource => ({
  id: toStringValue(raw.id),
  title: toNullableString(raw.title),
  embedded: raw.embedded === undefined ? null : Boolean(raw.embedded),
  fileUrl: toNullableString(raw.file_url ?? raw.fileUrl),
  createdAt: toNullableString(raw.created ?? raw.created_at ?? raw.createdAt),
  updatedAt: toNullableString(raw.updated ?? raw.updated_at ?? raw.updatedAt),
});

export const mapKnowledgeSourceDetail = (raw: Record<string, unknown>): KnowledgeSourceDetail => ({
  id: toStringValue(raw.id),
  title: toNullableString(raw.title),
  content: toNullableString(raw.content ?? raw.full_text ?? raw.fullText),
  createdAt: toNullableString(raw.created ?? raw.created_at ?? raw.createdAt),
  updatedAt: toNullableString(raw.updated ?? raw.updated_at ?? raw.updatedAt),
  assetUrl: toNullableString(raw.asset_url ?? raw.assetUrl),
  fileUrl: toNullableString(raw.file_url ?? raw.fileUrl),
});

export const mapKnowledgeChatSession = (raw: Record<string, unknown>): KnowledgeChatSession => ({
  id: toStringValue(raw.id),
  title: toNullableString(raw.title),
  notebookId: toNullableString(raw.notebook_id ?? raw.notebookId),
  createdAt: toNullableString(raw.created ?? raw.created_at ?? raw.createdAt),
  updatedAt: toNullableString(raw.updated ?? raw.updated_at ?? raw.updatedAt),
  messageCount: raw.message_count === undefined ? null : toNullableNumber(raw.message_count),
});

const mapKnowledgeCitation = (raw: Record<string, unknown>): KnowledgeCitation => ({
  sourceId: toStringValue(raw.source_id ?? raw.sourceId ?? raw.id),
  documentId: toStringValue(
    raw.document_id ?? raw.documentId ?? raw.source_id ?? raw.sourceId ?? raw.id,
  ),
  title: toStringValue(raw.title ?? ''),
  fileUrl: toNullableString(raw.file_url ?? raw.fileUrl),
});

export const mapKnowledgeSavedAnswer = (raw: Record<string, unknown>): KnowledgeSavedAnswer => {
  const citations = Array.isArray(raw.citations) ? raw.citations : [];
  return {
    id: toStringValue(raw.id),
    question: toStringValue(raw.question ?? raw.title ?? ''),
    answer: toStringValue(raw.answer ?? raw.content ?? ''),
    citations: citations.map((item) => mapKnowledgeCitation(item as Record<string, unknown>)),
    createdAt: toStringValue(raw.created_at ?? raw.created ?? raw.createdAt ?? ''),
    updatedAt: toStringValue(raw.updated_at ?? raw.updated ?? raw.updatedAt ?? ''),
  };
};

export const mapUser = (raw: Record<string, unknown>): User => {
  const legacyRoles = Array.isArray(raw.roles)
    ? (raw.roles as unknown[]).map(toOptionalString).filter((role): role is string => Boolean(role))
    : [];
  const userRoleEntries = Array.isArray(raw.user_roles)
    ? (raw.user_roles as unknown[])
        .map((entry) => {
          if (typeof entry !== 'object' || entry === null) {
            return undefined;
          }
          const record = entry as Record<string, unknown>;
          return resolveRoleName(record.role);
        })
        .filter((name): name is string => Boolean(name))
    : [];

  return {
    id: toStringValue(raw.id),
    username: toStringValue(raw.username),
    firstName: toOptionalString(raw.first_name ?? raw.firstName),
    lastName: toOptionalString(raw.last_name ?? raw.lastName),
    roles: userRoleEntries.length > 0 ? userRoleEntries : legacyRoles,
  };
};

export const mapPolicy = (raw: Record<string, unknown>): Policy => ({
  id: toStringValue(raw.id),
  number: toStringValue(raw.number),
  insuranceCompanyId: toStringValue(raw.insurance_company),
  insuranceCompany: toStringValue(raw.insurance_company_name ?? raw.insurance_company ?? ''),
  insuranceTypeId: toStringValue(raw.insurance_type),
  insuranceType: toStringValue(raw.insurance_type_name ?? raw.insurance_type ?? ''),
  dealId: toStringValue(raw.deal),
  dealTitle: toOptionalString(raw.deal_title ?? raw.dealTitle),
  clientId: toOptionalString(raw.client),
  clientName: toOptionalString(raw.client_name ?? raw.client),
  insuredClientId: toOptionalString(raw.insured_client),
  insuredClientName: toOptionalString(raw.insured_client_name ?? raw.insured_client),
  isVehicle: Boolean(raw.is_vehicle ?? raw.vehicle),
  brand: toOptionalString(raw.brand),
  model: toOptionalString(raw.model),
  vin: toOptionalString(raw.vin),
  counterparty: toOptionalString(raw.counterparty),
  salesChannel: toOptionalString(raw.sales_channel_name ?? raw.sales_channel),
  salesChannelId: toOptionalString(raw.sales_channel),
  salesChannelName: toOptionalString(raw.sales_channel_name ?? raw.sales_channel),
  startDate: raw.start_date === undefined ? undefined : toNullableString(raw.start_date),
  endDate: raw.end_date === undefined ? undefined : toNullableString(raw.end_date),
  status: resolvePolicyStatus(raw.status),
  paymentsPaid: toStringValue(raw.payments_paid ?? raw.paymentsPaid ?? '0'),
  paymentsTotal: toStringValue(raw.payments_total ?? raw.paymentsTotal ?? '0'),
  createdAt: toStringValue(raw.created_at),
  driveFolderId: raw.drive_folder_id === undefined ? null : toNullableString(raw.drive_folder_id),
});

export const mapFinancialRecord = (raw: Record<string, unknown>): FinancialRecord => ({
  id: toStringValue(raw.id),
  paymentId: toStringValue(raw.payment),
  statementId: toNullableString(raw.statement ?? raw.statement_id ?? raw.statementId),
  paymentDescription: toOptionalString(raw.payment_description),
  paymentAmount: toOptionalString(raw.payment_amount),
  paymentPaidBalance: toOptionalString(raw.payment_paid_balance ?? raw.paymentPaidBalance),
  paymentPaidEntries: Array.isArray(raw.payment_paid_entries)
    ? (raw.payment_paid_entries as Record<string, unknown>[])
        .map((entry) => ({
          amount: toStringValue(entry.amount),
          date: toStringValue(entry.date),
        }))
        .filter((entry) => Boolean(entry.date))
    : undefined,
  amount: toStringValue(raw.amount),
  date: raw.date === undefined ? undefined : toNullableString(raw.date),
  description: toOptionalString(raw.description),
  source: toOptionalString(raw.source),
  note: toOptionalString(raw.note),
  recordType: resolveFinancialRecordType(raw.record_type ?? raw.recordType),
  createdAt: toStringValue(raw.created_at),
  updatedAt: toStringValue(raw.updated_at),
  deletedAt: toNullableString(raw.deleted_at),
});

export const mapStatement = (raw: Record<string, unknown>): Statement => ({
  id: toStringValue(raw.id),
  name: toStringValue(raw.name ?? ''),
  statementType: toStringValue(
    raw.statement_type ?? raw.statementType,
  ) as Statement['statementType'],
  status: toStringValue(raw.status ?? '') as Statement['status'],
  counterparty: toNullableString(raw.counterparty),
  paidAt: raw.paid_at === undefined ? undefined : toNullableString(raw.paid_at),
  comment: toNullableString(raw.comment),
  createdBy: toNullableString(raw.created_by ?? raw.createdBy),
  driveFolderId: raw.drive_folder_id === undefined ? null : toNullableString(raw.drive_folder_id),
  recordsCount: toNullableNumber(raw.records_count ?? raw.recordsCount) ?? undefined,
  totalAmount: toOptionalString(raw.total_amount ?? raw.totalAmount),
  createdAt: toStringValue(raw.created_at),
  updatedAt: toStringValue(raw.updated_at),
  deletedAt: toNullableString(raw.deleted_at),
});

export const mapPayment = (raw: Record<string, unknown>): Payment => ({
  id: toStringValue(raw.id),
  dealId: toOptionalString(raw.deal),
  dealTitle: toOptionalString(raw.deal_title),
  dealClientName: toOptionalString(raw.deal_client_name ?? raw.dealClientName),
  policyId: toOptionalString(raw.policy),
  policyNumber: toOptionalString(raw.policy_number),
  policyInsuranceType: toOptionalString(raw.policy_insurance_type),
  amount: toStringValue(raw.amount),
  description: toOptionalString(raw.description),
  note: toOptionalString(raw.note),
  scheduledDate:
    raw.scheduled_date === undefined ? undefined : toNullableString(raw.scheduled_date),
  actualDate: raw.actual_date === undefined ? undefined : toNullableString(raw.actual_date),
  financialRecords: Array.isArray(raw.financial_records)
    ? (raw.financial_records as unknown[]).map((record) =>
        mapFinancialRecord(record as Record<string, unknown>),
      )
    : [],
  canDelete: Boolean(raw.can_delete ?? raw.canDelete),
  createdAt: toStringValue(raw.created_at),
  updatedAt: toStringValue(raw.updated_at),
  deletedAt: toNullableString(raw.deleted_at),
});

export const mapTask = (raw: Record<string, unknown>): Task => {
  const checklistItems = Array.isArray(raw.checklist)
    ? (raw.checklist as unknown[]).map((item) => {
        if (typeof item !== 'object' || item === null) {
          return { label: '', done: false };
        }
        const record = item as Record<string, unknown>;
        return {
          label: toStringValue(record.label),
          done: Boolean(record.done),
        };
      })
    : [];

  return {
    id: toStringValue(raw.id),
    title: toStringValue(raw.title),
    description: toOptionalString(raw.description),
    dealId: toOptionalString(raw.deal),
    dealTitle: toOptionalString(raw.deal_title ?? raw.dealTitle),
    clientName: toOptionalString(raw.client_name ?? raw.clientName),
    createdByName:
      raw.created_by_name === undefined ? undefined : toNullableString(raw.created_by_name),
    assignee: toNullableString(raw.assignee),
    assigneeName: toNullableString(raw.assignee_name ?? raw.assignee_username),
    status: resolveTaskStatus(raw.status ?? raw.state),
    priority: resolveTaskPriority(raw.priority ?? raw.priority_level),
    dueAt: raw.due_at === undefined ? undefined : toNullableString(raw.due_at),
    remindAt: raw.remind_at === undefined ? undefined : toNullableString(raw.remind_at),
    checklist: checklistItems,
    createdAt: toStringValue(raw.created_at),
    completedAt: raw.completed_at === undefined ? undefined : toNullableString(raw.completed_at),
    completedByName:
      raw.completed_by_name === undefined ? undefined : toNullableString(raw.completed_by_name),
    deletedAt: raw.deleted_at === undefined ? undefined : toNullableString(raw.deleted_at),
  };
};

export const mapActivityLog = (raw: Record<string, unknown>): ActivityLog => ({
  id: toStringValue(raw.id),
  deal: toStringValue(raw.deal),
  actionType: resolveActivityActionType(raw.action_type ?? raw.actionType),
  actionTypeDisplay: toStringValue(raw.action_type_display),
  description: toOptionalString(raw.description) ?? '',
  user: toOptionalString(raw.user),
  userUsername: toOptionalString(raw.user_username),
  oldValue: toOptionalString(raw.old_value),
  newValue: toOptionalString(raw.new_value),
  objectId: toOptionalString(raw.object_id),
  objectType: toOptionalString(raw.object_type),
  objectName: toOptionalString(raw.object_name),
  createdAt: toStringValue(raw.created_at),
});

export const mapNote = (raw: Record<string, unknown>): Note => ({
  id: toStringValue(raw.id),
  dealId: toStringValue(raw.deal),
  dealTitle: toOptionalString(raw.deal_title ?? raw.dealTitle),
  body: toStringValue(raw.body ?? ''),
  authorName: toNullableString(raw.author_name ?? raw.authorName),
  attachments: Array.isArray(raw.attachments)
    ? (raw.attachments as Record<string, unknown>[]).map(mapDriveFile)
    : [],
  isImportant: Boolean(raw.is_important ?? raw.isImportant ?? false),
  createdAt: toStringValue(raw.created_at),
  updatedAt: toStringValue(raw.updated_at),
  deletedAt: toNullableString(raw.deleted_at),
});

export const mapChatMessage = (raw: Record<string, unknown>): ChatMessage => {
  const fallbackAuthorDisplayName =
    toOptionalString(raw.author_name ?? raw.authorName) ??
    toOptionalString(raw.author_username ?? raw.authorUsername);
  const resolvedDisplayName =
    toOptionalString(raw.author_display_name ?? raw.authorDisplayName ?? raw.author_displayName) ??
    fallbackAuthorDisplayName ??
    'Пользователь';

  return {
    id: toStringValue(raw.id),
    deal: toStringValue(raw.deal),
    author_name: toStringValue(raw.author_name),
    author_username: toNullableString(raw.author_username),
    author: toNullableString(raw.author),
    author_display_name: toStringValue(resolvedDisplayName),
    body: toStringValue(raw.body),
    created_at: toStringValue(raw.created_at),
  };
};
