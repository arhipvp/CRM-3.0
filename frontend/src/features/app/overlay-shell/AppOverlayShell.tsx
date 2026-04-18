import React, { Suspense, lazy } from 'react';

import { BTN_DANGER, BTN_SECONDARY } from '../../../components/common/buttonStyles';
import { FormActions } from '../../../components/common/forms/FormActions';
import { FormModal } from '../../../components/common/modal/FormModal';
import { AddTaskForm } from '../../../components/forms/AddTaskForm';
import type { AddTaskFormValues } from '../../../components/forms/AddTaskForm';
import { ClientForm } from '../../../components/forms/ClientForm';
import { Modal } from '../../../components/Modal';
import type {
  Client,
  ClientMergePreviewResponse,
  ClientSimilarityCandidate,
  User,
} from '../../../types';

const AppModals = lazy(async () => {
  const module = await import('../../../components/app/AppModals');
  return { default: module.AppModals };
});

const AppDealPreviewModal = lazy(async () => {
  const module = await import('../../../components/app/AppDealPreviewModal');
  return { default: module.AppDealPreviewModal };
});

const ClientMergeModal = lazy(async () => {
  const module = await import('../../../components/app/ClientMergeModal');
  return { default: module.ClientMergeModal };
});

const SimilarClientsModal = lazy(async () => {
  const module = await import('../../../components/views/SimilarClientsModal');
  return { default: module.SimilarClientsModal };
});

type AppOverlayShellProps = {
  appModalsProps: React.ComponentProps<typeof AppModals>;
  clientDeleteTarget: Client | null;
  closeMergeModal: () => void;
  closeSimilarClientsModal: () => void;
  confirmDialogRenderer: React.ReactNode;
  editingClient: Client | null;
  handleClientMergePreview: () => Promise<void>;
  handleCreateTask: (dealId: string, data: AddTaskFormValues) => Promise<void>;
  handleDeleteClient: () => Promise<void>;
  handleMergeFromSimilar: (sourceClientId: string) => void;
  handleMergeSubmit: () => Promise<void>;
  handleUpdateClient: (values: {
    name: string;
    isCounterparty?: boolean;
    phone?: string;
    email?: string | null;
    birthDate?: string | null;
    notes?: string | null;
  }) => Promise<void>;
  isClientMergePreviewConfirmed: boolean;
  isClientMergePreviewLoading: boolean;
  isMergingClients: boolean;
  isSimilarClientsLoading: boolean;
  isSyncing: boolean;
  mergeCandidates: Client[];
  mergeError: string | null;
  mergeSearch: string;
  mergeSources: string[];
  mergeTargetClient: Client | null;
  onCloseClientDelete: () => void;
  onCloseEditClient: () => void;
  onCloseQuickTask: () => void;
  previewModalProps: React.ComponentProps<typeof AppDealPreviewModal>;
  quickTaskDeal: {
    id: string;
    title: string;
    executor?: string | null;
  } | null;
  quickTaskUsers: User[];
  setClientMergeFieldOverrides: (value: ClientMergeFieldOverrides) => void;
  setMergeSearch: (value: string) => void;
  similarCandidates: ClientSimilarityCandidate[];
  similarClientTargetId: string | null;
  similarClientsError: string | null;
  similarTargetClient: Client | null;
  toggleMergeSource: (sourceId: string) => void;
  clientMergeFieldOverrides: ClientMergeFieldOverrides;
  clientMergePreview: ClientMergePreviewResponse | null;
  clientMergeStep: ClientMergeStep;
};

type ClientMergeFieldOverrides = {
  name: string;
  phone: string;
  email: string;
  notes: string;
};

type ClientMergeStep = 'select' | 'preview';

export const AppOverlayShell: React.FC<AppOverlayShellProps> = ({
  appModalsProps,
  clientDeleteTarget,
  closeMergeModal,
  closeSimilarClientsModal,
  confirmDialogRenderer,
  editingClient,
  handleClientMergePreview,
  handleCreateTask,
  handleDeleteClient,
  handleMergeFromSimilar,
  handleMergeSubmit,
  handleUpdateClient,
  isClientMergePreviewConfirmed,
  isClientMergePreviewLoading,
  isMergingClients,
  isSimilarClientsLoading,
  isSyncing,
  mergeCandidates,
  mergeError,
  mergeSearch,
  mergeSources,
  mergeTargetClient,
  onCloseClientDelete,
  onCloseEditClient,
  onCloseQuickTask,
  previewModalProps,
  quickTaskDeal,
  quickTaskUsers,
  setClientMergeFieldOverrides,
  setMergeSearch,
  similarCandidates,
  similarClientTargetId,
  similarClientsError,
  similarTargetClient,
  toggleMergeSource,
  clientMergeFieldOverrides,
  clientMergePreview,
  clientMergeStep,
}) => (
  <>
    <Suspense fallback={null}>
      <AppDealPreviewModal {...previewModalProps} />
      <AppModals {...appModalsProps} />
    </Suspense>
    {quickTaskDeal && (
      <Modal
        title={`Новая задача: ${quickTaskDeal.title}`}
        onClose={onCloseQuickTask}
        size="sm"
        zIndex={60}
        closeOnOverlayClick={false}
      >
        <AddTaskForm
          dealId={quickTaskDeal.id}
          users={quickTaskUsers}
          defaultAssigneeId={quickTaskDeal.executor ?? null}
          onSubmit={async (data) => {
            await handleCreateTask(quickTaskDeal.id, data);
            onCloseQuickTask();
          }}
          onCancel={onCloseQuickTask}
        />
      </Modal>
    )}
    {editingClient && (
      <Modal title="Редактировать клиента" onClose={onCloseEditClient}>
        <ClientForm
          initial={{
            name: editingClient.name,
            isCounterparty: editingClient.isCounterparty,
            phone: editingClient.phone ?? '',
            email: editingClient.email ?? '',
            birthDate: editingClient.birthDate ?? '',
            notes: editingClient.notes ?? '',
          }}
          onSubmit={handleUpdateClient}
        />
      </Modal>
    )}
    {clientDeleteTarget && (
      <FormModal
        isOpen
        title="Удалить клиента"
        onClose={onCloseClientDelete}
        closeOnOverlayClick={false}
      >
        <form
          onSubmit={(event) => {
            event.preventDefault();
            void handleDeleteClient();
          }}
          className="space-y-4"
        >
          <p className="text-sm text-slate-700">
            Клиент <span className="font-bold">{clientDeleteTarget.name}</span> и все его данные
            станут недоступны.
          </p>
          <FormActions
            onCancel={onCloseClientDelete}
            isSubmitting={isSyncing}
            submitLabel="Удалить"
            submittingLabel="Удаляем..."
            submitClassName={`${BTN_DANGER} rounded-xl`}
            cancelClassName={`${BTN_SECONDARY} rounded-xl`}
          />
        </form>
      </FormModal>
    )}
    <Suspense fallback={null}>
      <SimilarClientsModal
        isOpen={Boolean(similarClientTargetId)}
        targetClient={similarTargetClient}
        candidates={similarCandidates}
        isLoading={isSimilarClientsLoading}
        error={similarClientsError}
        onClose={closeSimilarClientsModal}
        onMerge={handleMergeFromSimilar}
      />
      {mergeTargetClient && (
        <ClientMergeModal
          targetClient={mergeTargetClient}
          mergeCandidates={mergeCandidates}
          mergeSearch={mergeSearch}
          mergeSources={mergeSources}
          mergeStep={clientMergeStep}
          mergePreview={clientMergePreview}
          mergeError={mergeError}
          isMergingClients={isMergingClients}
          isPreviewLoading={isClientMergePreviewLoading}
          isPreviewConfirmed={isClientMergePreviewConfirmed}
          fieldOverrides={clientMergeFieldOverrides}
          onClose={closeMergeModal}
          onSubmit={handleMergeSubmit}
          onPreview={handleClientMergePreview}
          onToggleSource={toggleMergeSource}
          onSearchChange={setMergeSearch}
          onFieldOverridesChange={setClientMergeFieldOverrides}
        />
      )}
    </Suspense>
    {confirmDialogRenderer}
  </>
);
