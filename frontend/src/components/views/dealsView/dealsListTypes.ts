import type { Client, ClientDuplicateHint, Deal, User } from '../../../types';

export interface DealsListProps {
  sortedDeals: Deal[];
  selectedDeal: Deal | null;
  dealRowFocusRequest?: { dealId: string; nonce: number } | null;
  dealSearch: string;
  onDealSearchChange: (value: string) => void;
  onDealSearchSubmit: (value?: string) => void;
  onRefreshDealsList?: () => Promise<void>;
  dealExecutorFilter: string;
  onDealExecutorFilterChange: (value: string) => void;
  dealShowDeleted: boolean;
  onDealShowDeletedChange: (value: boolean) => void;
  dealShowClosed: boolean;
  onDealShowClosedChange: (value: boolean) => void;
  dealOrdering?: string;
  onDealOrderingChange: (value: string | undefined) => void;
  users: User[];
  dealsHasMore: boolean;
  dealsTotalCount: number;
  isLoadingMoreDeals: boolean;
  isRefreshingDealsList?: boolean;
  onLoadMoreDeals: () => Promise<void>;
  onSelectDeal: (dealId: string) => void;
  onPinDeal: (dealId: string) => Promise<void>;
  onUnpinDeal: (dealId: string) => Promise<void>;
  currentUser: User | null;
  isDealSelectionBlocked?: boolean;
  clients?: Client[];
  clientDuplicateHints?: Record<string, ClientDuplicateHint>;
  onClientFindSimilar?: (client: Client) => void;
  onClientNormalizeName?: (client: Client, normalizedName: string) => Promise<void>;
}
