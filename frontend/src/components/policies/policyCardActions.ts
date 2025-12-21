import type { Client } from '../../types';
import type { PolicyCardModel } from './policyCardModel';
import type { PolicyCardAction } from './PolicyCard';
import { POLICY_TEXT } from './text';

interface BuildPolicyNavigationActionsArgs {
  model: PolicyCardModel;
  onOpenDeal?: (dealId: string) => void;
  clients?: Client[];
  onOpenClient?: (client: Client) => void;
}

export const buildPolicyNavigationActions = ({
  model,
  onOpenDeal,
  clients,
  onOpenClient,
}: BuildPolicyNavigationActionsArgs): PolicyCardAction[] => {
  const actions: PolicyCardAction[] = [];

  if (onOpenDeal && model.dealId) {
    actions.push({
      key: `open-deal:${model.dealId}`,
      label: POLICY_TEXT.actions.openDeal,
      onClick: () => onOpenDeal(model.dealId),
      variant: 'quiet',
    });
  }

  if (onOpenClient && model.clientId && clients?.length) {
    const client = clients.find((item) => item.id === model.clientId) ?? null;
    if (client) {
      actions.push({
        key: `open-client:${client.id}`,
        label: POLICY_TEXT.actions.openClient,
        onClick: () => onOpenClient(client),
        variant: 'quiet',
      });
    }
  }

  return actions;
};

