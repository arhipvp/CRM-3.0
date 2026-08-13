import { DealDetailsPanelView } from './DealDetailsPanelView';
import {
  useDealDetailsPanelController,
  type DealDetailsPanelProps,
} from './hooks/useDealDetailsPanelController';

export type { DealDetailsPanelProps } from './hooks/useDealDetailsPanelController';

export function DealDetailsPanel(props: DealDetailsPanelProps) {
  const viewModel = useDealDetailsPanelController(props);
  return <DealDetailsPanelView {...viewModel} />;
}
