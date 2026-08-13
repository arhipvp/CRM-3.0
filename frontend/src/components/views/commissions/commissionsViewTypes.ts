import type {
  Payment,
  Policy,
  SalesChannel,
  Statement,
  StatementAmountApplyMode,
  StatementAmountApplyResult,
  User,
} from '../../../types';
import type { AttachFinanceStatementRecordsResult } from '../../../api';
import type { AddFinancialRecordFormValues } from '../../forms/AddFinancialRecordForm';

export interface CommissionsViewProps {
  payments: Payment[];
  policies: Policy[];
  statements: Statement[];
  salesChannels: SalesChannel[];
  currentUser?: User | null;
  isLoading?: boolean;
  hasCommissionsSnapshotLoaded?: boolean;
  onRefreshStatements?: () => Promise<void>;
  onLoadMoreStatements?: () => Promise<void>;
  statementsTotalCount?: number;
  statementsHasMore?: boolean;
  isLoadingMoreStatements?: boolean;
  onDealSelect?: (dealId: string) => void;
  onDealPreview?: (dealId: string) => void;
  onRequestEditPolicy?: (policy: Policy) => void;
  onUpdateFinancialRecord?: (
    recordId: string,
    values: AddFinancialRecordFormValues,
  ) => Promise<void>;
  onDeleteStatement?: (statementId: string) => Promise<void>;
  onAttachStatementRecords?: (
    statementId: string,
    recordIds: string[],
  ) => Promise<AttachFinanceStatementRecordsResult>;
  onRemoveStatementRecords?: (statementId: string, recordIds: string[]) => Promise<void>;
  onApplyStatementAmount?: (
    statementId: string,
    values: { mode: StatementAmountApplyMode; value: string },
  ) => Promise<StatementAmountApplyResult>;
  onCreateStatement?: (values: {
    name: string;
    statementType: Statement['statementType'];
    counterparty?: string;
    comment?: string;
    recordIds?: string[];
  }) => Promise<Statement>;
  onUpdateStatement?: (
    statementId: string,
    values: Partial<{
      name: string;
      statementType: Statement['statementType'];
      counterparty: string;
      comment: string;
      paidAt: string | null;
      recordIds: string[];
    }>,
  ) => Promise<Statement>;
}
