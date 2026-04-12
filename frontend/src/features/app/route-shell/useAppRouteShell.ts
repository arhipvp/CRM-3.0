import { useMemo } from 'react';

import type {
  AppRouteDataBundle,
  AppRouteDealsActions,
  AppRouteFilterState,
  AppRouteFinanceActions,
  AppRouteLoadingState,
} from '../../../components/app/appRoutes.types';
import { useAppRouteBindings } from './useAppRouteBindings';

interface UseAppRouteShellArgs {
  routeData: AppRouteDataBundle;
  routeDealsActions: AppRouteDealsActions;
  routeFilters: AppRouteFilterState;
  routeFinanceActions: AppRouteFinanceActions;
  routeLoading: AppRouteLoadingState;
}

export const useAppRouteShell = ({
  routeData,
  routeDealsActions,
  routeFilters,
  routeFinanceActions,
  routeLoading,
}: UseAppRouteShellArgs) => {
  const stableRouteData = useMemo(() => routeData, [routeData]);
  const stableRouteDealsActions = useMemo(() => routeDealsActions, [routeDealsActions]);
  const stableRouteFilters = useMemo(() => routeFilters, [routeFilters]);
  const stableRouteFinanceActions = useMemo(() => routeFinanceActions, [routeFinanceActions]);
  const stableRouteLoading = useMemo(() => routeLoading, [routeLoading]);

  return useAppRouteBindings({
    routeData: stableRouteData,
    routeDealsActions: stableRouteDealsActions,
    routeFilters: stableRouteFilters,
    routeFinanceActions: stableRouteFinanceActions,
    routeLoading: stableRouteLoading,
  });
};
