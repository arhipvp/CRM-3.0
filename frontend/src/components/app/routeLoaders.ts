export const loadClientsView = () => import('../views/ClientsView');
export const loadDealsView = () => import('../views/DealsView');
export const loadSellerDashboardView = () => import('../views/SellerDashboardView');
export const loadPoliciesView = () => import('../views/PoliciesView');
export const loadCommissionsView = () => import('../views/CommissionsView');
export const loadTasksView = () => import('../views/TasksView');
export const loadSettingsView = () => import('../views/SettingsView');

export const preloadAppRoute = (pathname: string): Promise<unknown> => {
  if (pathname.startsWith('/clients')) return loadClientsView();
  if (pathname.startsWith('/policies')) return loadPoliciesView();
  if (pathname.startsWith('/commissions')) return loadCommissionsView();
  if (pathname.startsWith('/tasks')) return loadTasksView();
  if (pathname.startsWith('/settings')) return loadSettingsView();
  if (pathname.startsWith('/dashboard')) return loadSellerDashboardView();
  return loadDealsView();
};
