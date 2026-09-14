import React from 'react';

import type { Client, Deal, User } from '../../types';
import { Modal } from '../Modal';
import { PanelMessage } from '../PanelMessage';
import { Button, IconButton } from '../common/Button';
import { DealDetailsPanel, type DealDetailsPanelProps } from '../views/dealsView/DealDetailsPanel';
import { useDealPreviewModalSize } from './useDealPreviewModalSize';

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
  const { isDesktop, size, resetSize, handleResizePointerDown, handleResizeKeyDown } =
    useDealPreviewModalSize();

  if (!isOpen) {
    return null;
  }

  return (
    <Modal
      title={previewDeal?.title ? `Сделка: ${previewDeal.title}` : 'Сделка'}
      onClose={onClose}
      size="xl"
      zIndex={60}
      panelClassName={isDesktop ? 'md:max-w-none' : ''}
      panelStyle={isDesktop ? { width: `${size.width}px`, height: `${size.height}px` } : undefined}
      headerActions={
        isDesktop ? (
          <IconButton
            icon="refresh"
            label="Сбросить размер предпросмотра сделки"
            size="sm"
            onClick={resetSize}
          />
        ) : undefined
      }
      resizeHandle={
        isDesktop ? (
          <button
            type="button"
            aria-label="Изменить размер предпросмотра сделки"
            title="Потяните, чтобы изменить размер"
            aria-keyshortcuts="ArrowLeft ArrowRight ArrowUp ArrowDown"
            onPointerDown={handleResizePointerDown}
            onKeyDown={handleResizeKeyDown}
            className="absolute bottom-0 right-0 z-10 h-5 w-5 cursor-nwse-resize touch-none before:absolute before:bottom-1.5 before:right-1.5 before:h-2 before:w-2 before:border-b-2 before:border-r-2 before:border-slate-400 before:content-[''] hover:before:border-sky-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500"
          />
        ) : undefined
      }
    >
      <div className="space-y-3">
        {previewDeal && (
          <div className="flex justify-end">
            <Button
              onClick={() => onOpenFull(previewDeal.id)}
              variant="primary"
              size="sm"
              icon="arrowRight"
              iconPosition="end"
            >
              Открыть полностью
            </Button>
          </div>
        )}
        <div>
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
