import React from 'react';

import type { Client, Deal, User } from '../../types';
import { Modal } from '../Modal';
import { PanelMessage } from '../PanelMessage';
import { Button } from '../common/Button';
import { DealDetailsPanel, type DealDetailsPanelProps } from '../views/dealsView/DealDetailsPanel';

type AppDealPreviewModalProps = {
  isOpen: boolean;
  previewDeal: Deal | null;
  previewClient: Client | null;
  previewSellerUser?: User;
  previewExecutorUser?: User;
  onClose: () => void;
  onOpenFull: (dealId: string) => void;
  panelProps: Omit<
    DealDetailsPanelProps,
    'selectedDeal' | 'selectedClient' | 'sellerUser' | 'executorUser'
  > & {
    isTasksLoading?: boolean;
    isQuotesLoading?: boolean;
  };
};

export const AppDealPreviewModal: React.FC<AppDealPreviewModalProps> = ({
  isOpen,
  previewDeal,
  previewClient,
  previewSellerUser,
  previewExecutorUser,
  onClose,
  onOpenFull,
  panelProps,
}) => {
  if (!isOpen) {
    return null;
  }

  return (
    <Modal
      title={previewDeal?.title ? `Сделка: ${previewDeal.title}` : 'Сделка'}
      onClose={onClose}
      size="xl"
      zIndex={60}
    >
      <div className="space-y-3">
        {previewDeal && (
          <div className="flex justify-end">
            <Button onClick={() => onOpenFull(previewDeal.id)} variant="primary" size="sm">
              Открыть полностью
            </Button>
          </div>
        )}
        <div className="max-h-[70vh] overflow-y-auto">
          {previewDeal ? (
            <DealDetailsPanel
              {...panelProps}
              selectedDeal={previewDeal}
              selectedClient={previewClient}
              sellerUser={previewSellerUser}
              executorUser={previewExecutorUser}
            />
          ) : (
            <PanelMessage>Загрузка сделки...</PanelMessage>
          )}
        </div>
      </div>
    </Modal>
  );
};
