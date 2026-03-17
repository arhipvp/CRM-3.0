import { useMemo } from 'react';

import type {
  AppRouteDataBundle,
  AppRouteDealsActions,
  AppRouteFilterState,
  AppRouteFinanceActions,
  AppRouteLoadingState,
} from '../../components/app/appRoutes.types';

interface UseAppRouteBindingsArgs {
  routeData: AppRouteDataBundle;
  routeDealsActions: AppRouteDealsActions;
  routeFilters: AppRouteFilterState;
  routeFinanceActions: AppRouteFinanceActions;
  routeLoading: AppRouteLoadingState;
}

export const useAppRouteBindings = ({
  routeData,
  routeDealsActions,
  routeFilters,
  routeFinanceActions,
  routeLoading,
}: UseAppRouteBindingsArgs) =>
  useMemo(
    () => ({
      routeData,
      routeDealsActions,
      routeFilters,
      routeFinanceActions,
      routeLoading,
    }),
    [routeData, routeDealsActions, routeFilters, routeFinanceActions, routeLoading],
  );
