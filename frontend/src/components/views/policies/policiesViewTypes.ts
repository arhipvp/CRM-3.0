import type { FilterParams } from '../../../api';
import type {
  Client,
  ClientDuplicateHint,
  Deal,
  Payment,
  PoliciesKPI,
  Policy,
} from '../../../types';
import type { AddFinancialRecordFormValues } from '../../forms/AddFinancialRecordForm';

export type PolicyFilterPreset = {
  id: string;
  name: string;
  filters: FilterParams;
  createdAt: string;
  updatedAt: string;
};

export interface PoliciesViewProps {
  policies: Policy[];
  deals?: Deal[];
  payments: Payment[];
  clients?: Client[];
  clientDuplicateHints?: Record<string, ClientDuplicateHint>;
  onDealSelect?: (dealId: string) => void;
  onDealPreview?: (dealId: string) => void;
  onClientEdit?: (client: Client) => void;
  onClientOpenById?: (clientId: string) => Promise<void>;
  onClientFindSimilar?: (client: Client) => void;
  onClientNormalizeName?: (client: Client, normalizedName: string) => Promise<void>;
  onRequestEditPolicy?: (policy: Policy) => void;
  onMovePolicy?: (policyId: string, targetDealId: string) => Promise<void>;
  onLoadMorePolicies?: () => Promise<void>;
  policiesHasMore?: boolean;
  isLoadingMorePolicies?: boolean;
  isPoliciesLoading?: boolean;
  policiesError?: string | null;
  onRefreshPoliciesList?: (filters?: FilterParams) => Promise<PoliciesKPI | undefined>;
  onAddFinancialRecord?: (values: AddFinancialRecordFormValues) => Promise<void>;
  onUpdateFinancialRecord?: (
    recordId: string,
    values: AddFinancialRecordFormValues,
  ) => Promise<void>;
  onDeleteFinancialRecord?: (recordId: string) => Promise<void>;
  onDeletePayment?: (paymentId: string) => Promise<void>;
  onMarkPaymentPaid?: (paymentId: string, actualDate: string) => Promise<void>;
  onMarkFinancialRecordPaid?: (recordId: string, paidDate: string) => Promise<void>;
}
