import React from 'react';

import { CommissionsContent } from './commissions/CommissionsContent';
import { useCommissionsController } from './commissions/hooks/useCommissionsController';
import type { CommissionsViewProps } from './commissions/commissionsViewTypes';

export const CommissionsView: React.FC<CommissionsViewProps> = (props) => {
  const controller = useCommissionsController(props);
  return <CommissionsContent model={controller} />;
};
