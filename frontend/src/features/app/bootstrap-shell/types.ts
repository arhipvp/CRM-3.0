export interface AppBootstrapShellArgs {
  ensureCommissionsDataLoaded: (options?: { force?: boolean }) => Promise<void>;
  ensureFinanceDataLoaded: (options?: { force?: boolean }) => Promise<void>;
  ensureTasksLoaded: (options?: { force?: boolean }) => Promise<void>;
  isAuthenticated: boolean;
  locationSearch: string;
  navigate: (to: string, options?: { replace?: boolean }) => void;
  pathname: string;
  refreshPolicies: (options?: { force?: boolean }) => Promise<void>;
  selectDealById: (dealId: string) => void;
  setError: (value: string | null) => void;
}

export interface AppBootstrapShellResult {
  deepLinkedDealId: string | null;
  isClientsRoute: boolean;
  isCommissionsRoute: boolean;
  isDealsRoute: boolean;
  isLoginRoute: boolean;
  isPoliciesRoute: boolean;
  isTasksRoute: boolean;
  pendingPostLoginRedirect: string | null;
}
