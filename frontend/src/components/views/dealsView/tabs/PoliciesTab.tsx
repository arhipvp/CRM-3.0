import { PoliciesTabView } from './PoliciesTabView';
import { usePoliciesTabController, type PoliciesTabProps } from './usePoliciesTabController';

export function PoliciesTab(props: PoliciesTabProps) {
  const viewModel = usePoliciesTabController(props);
  return <PoliciesTabView {...viewModel} />;
}
