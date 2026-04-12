import type {
  AppRouteDataBundle,
  AppRouteDealsActions,
  AppRouteFilterState,
  AppRouteFinanceActions,
  AppRouteLoadingState,
} from '../../../components/app/appRoutes.types';

export interface AppRouteShellArgs {
  routeData: AppRouteDataBundle;
  routeDealsActions: AppRouteDealsActions;
  routeFilters: AppRouteFilterState;
  routeFinanceActions: AppRouteFinanceActions;
  routeLoading: AppRouteLoadingState;
}

export interface AppRouteShellResult {
  routeData: AppRouteDataBundle;
  routeDealsActions: AppRouteDealsActions;
  routeFilters: AppRouteFilterState;
  routeFinanceActions: AppRouteFinanceActions;
  routeLoading: AppRouteLoadingState;
}
