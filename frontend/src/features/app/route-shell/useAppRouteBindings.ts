import { useMemo } from 'react';

import type { AppRouteShellArgs } from './types';

export const useAppRouteBindings = ({
  routeData,
  routeDealsActions,
  routeFilters,
  routeFinanceActions,
  routeLoading,
}: AppRouteShellArgs) =>
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
