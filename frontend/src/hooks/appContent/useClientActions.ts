import { useCallback, useMemo, useState } from 'react';

import {
  APIError,
  createClient,
  deleteClient,
  fetchSimilarClients,
  mergeClients,
  previewClientMerge,
  updateClient,
} from '../../api';
import type { ModalType } from '../../components/app/types';
import type { NotificationContextType } from '../../contexts/NotificationTypes';
import type { Client, ClientMergePreviewResponse, ClientSimilarityCandidate } from '../../types';
import { formatErrorMessage } from '../../utils/formatErrorMessage';
import type { useAppData } from '../useAppData';

type UpdateAppData = ReturnType<typeof useAppData>['updateAppData'];
type AddNotification = NotificationContextType['addNotification'];

type ClientFormValues = {
  name: string;
  isCounterparty?: boolean;
  phone?: string;
  email?: string | null;
  birthDate?: string | null;
  notes?: string | null;
};

interface UseClientActionsParams {
  clients: Client[];
  setModal: React.Dispatch<React.SetStateAction<ModalType>>;
  setIsSyncing: React.Dispatch<React.SetStateAction<boolean>>;
  setError: React.Dispatch<React.SetStateAction<string | null>>;
  updateAppData: UpdateAppData;
  addNotification: AddNotification;
}

const EMPTY_CLIENT_MERGE_FIELDS = {
  name: '',
  phone: '',
  email: '',
  notes: '',
};

export const useClientActions = ({
  clients,
  setModal,
  setIsSyncing,
  setError,
  updateAppData,
  addNotification,
}: UseClientActionsParams) => {
  const [isClientModalOverlayOpen, setClientModalOverlayOpen] = useState(false);
  const [clientModalReturnTo, setClientModalReturnTo] = useState<ModalType | null>(null);
  const [pendingDealClientId, setPendingDealClientId] = useState<string | null>(null);
  const [editingClient, setEditingClient] = useState<Client | null>(null);
  const [clientDeleteTarget, setClientDeleteTarget] = useState<Client | null>(null);
  const [similarClientTargetId, setSimilarClientTargetId] = useState<string | null>(null);
  const [similarCandidates, setSimilarCandidates] = useState<ClientSimilarityCandidate[]>([]);
  const [isSimilarClientsLoading, setIsSimilarClientsLoading] = useState(false);
  const [similarClientsError, setSimilarClientsError] = useState<string | null>(null);
  const [mergeClientTargetId, setMergeClientTargetId] = useState<string | null>(null);
  const [mergeSources, setMergeSources] = useState<string[]>([]);
  const [mergeSearch, setMergeSearch] = useState('');
  const [mergeError, setMergeError] = useState<string | null>(null);
  const [isMergingClients, setIsMergingClients] = useState(false);
  const [isClientMergePreviewLoading, setIsClientMergePreviewLoading] = useState(false);
  const [clientMergePreview, setClientMergePreview] = useState<ClientMergePreviewResponse | null>(
    null,
  );
  const [isClientMergePreviewConfirmed, setIsClientMergePreviewConfirmed] = useState(false);
  const [clientMergeStep, setClientMergeStep] = useState<'select' | 'preview'>('select');
  const [clientMergeFieldOverrides, setClientMergeFieldOverrides] = useState({
    ...EMPTY_CLIENT_MERGE_FIELDS,
  });

  const openClientModal = useCallback(
    (afterModal: ModalType | null = null) => {
      if (afterModal) {
        setClientModalOverlayOpen(true);
        setClientModalReturnTo(afterModal);
        return;
      }
      setClientModalReturnTo(null);
      setModal('client');
    },
    [setModal],
  );

  const closeClientModal = useCallback(() => {
    if (isClientModalOverlayOpen) {
      setClientModalOverlayOpen(false);
      setClientModalReturnTo(null);
      return;
    }
    setModal(null);
  }, [isClientModalOverlayOpen, setModal]);

  const handleAddClient = useCallback(
    async (data: ClientFormValues) => {
      const created = await createClient(data);
      updateAppData((prev) => ({ clients: [created, ...prev.clients] }));
      if (clientModalReturnTo === 'deal') {
        setPendingDealClientId(created.id);
      }
      closeClientModal();
    },
    [clientModalReturnTo, closeClientModal, updateAppData],
  );

  const handlePendingDealClientConsumed = useCallback(() => {
    setPendingDealClientId(null);
  }, []);

  const handleClientEditRequest = useCallback((client: Client) => {
    setEditingClient(client);
  }, []);

  const handleUpdateClient = useCallback(
    async (data: ClientFormValues) => {
      if (!editingClient) {
        return;
      }
      try {
        const updated = await updateClient(editingClient.id, data);
        updateAppData((prev) => ({
          clients: prev.clients.map((client) => (client.id === updated.id ? updated : client)),
        }));
        addNotification('Клиент обновлён', 'success', 4000);
        setEditingClient(null);
        setError(null);
      } catch (err) {
        setError(formatErrorMessage(err, 'Ошибка при обновлении клиента'));
        throw err;
      }
    },
    [addNotification, editingClient, setError, updateAppData],
  );

  const handleClientDeleteRequest = useCallback((client: Client) => {
    setClientDeleteTarget(client);
  }, []);

  const handleDeleteClient = useCallback(async () => {
    if (!clientDeleteTarget) {
      return;
    }
    setIsSyncing(true);
    try {
      await deleteClient(clientDeleteTarget.id);
      updateAppData((prev) => ({
        clients: prev.clients.filter((client) => client.id !== clientDeleteTarget.id),
      }));
      addNotification('Клиент удалён', 'success', 4000);
      setClientDeleteTarget(null);
      setError(null);
    } catch (err) {
      if (err instanceof APIError && err.status === 403) {
        addNotification('Ошибка доступа при удалении клиента', 'error', 4000);
      } else {
        setError(formatErrorMessage(err, 'Ошибка при удалении клиента'));
      }
      throw err;
    } finally {
      setIsSyncing(false);
    }
  }, [addNotification, clientDeleteTarget, setError, setIsSyncing, updateAppData]);

  const handleClientMergeRequest = useCallback(
    (client: Client, preselectedSources: string[] = []) => {
      setMergeClientTargetId(client.id);
      setMergeSources(preselectedSources);
      setMergeSearch('');
      setMergeError(null);
      setClientMergePreview(null);
      setIsClientMergePreviewConfirmed(false);
      setClientMergeStep('select');
      setClientMergeFieldOverrides({
        name: client.name ?? '',
        phone: client.phone ?? '',
        email: client.email ?? '',
        notes: client.notes ?? '',
      });
    },
    [],
  );

  const handleClientFindSimilarRequest = useCallback(async (client: Client) => {
    setSimilarClientTargetId(client.id);
    setSimilarCandidates([]);
    setSimilarClientsError(null);
    setIsSimilarClientsLoading(true);
    try {
      const result = await fetchSimilarClients({
        targetClientId: client.id,
        limit: 50,
      });
      const sortedCandidates = [...result.candidates].sort(
        (left, right) => right.score - left.score,
      );
      setSimilarCandidates(sortedCandidates);
    } catch (err) {
      setSimilarClientsError(formatErrorMessage(err, 'Не удалось найти похожих клиентов.'));
    } finally {
      setIsSimilarClientsLoading(false);
    }
  }, []);

  const closeSimilarClientsModal = useCallback(() => {
    setSimilarClientTargetId(null);
    setSimilarCandidates([]);
    setSimilarClientsError(null);
    setIsSimilarClientsLoading(false);
  }, []);

  const toggleMergeSource = useCallback((clientId: string) => {
    setMergeSources((prev) =>
      prev.includes(clientId) ? prev.filter((id) => id !== clientId) : [...prev, clientId],
    );
    setMergeError(null);
    setClientMergePreview(null);
    setIsClientMergePreviewConfirmed(false);
    setClientMergeStep('select');
  }, []);

  const closeMergeModal = useCallback(() => {
    setMergeClientTargetId(null);
    setMergeSources([]);
    setMergeSearch('');
    setMergeError(null);
    setClientMergePreview(null);
    setIsClientMergePreviewConfirmed(false);
    setClientMergeStep('select');
    setClientMergeFieldOverrides({ ...EMPTY_CLIENT_MERGE_FIELDS });
  }, []);

  const handleClientMergePreview = useCallback(async () => {
    if (!mergeClientTargetId) {
      return;
    }
    if (!mergeSources.length) {
      setMergeError('Выберите клиентов для объединения.');
      return;
    }
    setIsClientMergePreviewLoading(true);
    setMergeError(null);
    try {
      const preview = await previewClientMerge({
        targetClientId: mergeClientTargetId,
        sourceClientIds: mergeSources,
        includeDeleted: true,
      });
      setClientMergePreview(preview);
      setClientMergeFieldOverrides((prev) => ({
        name: prev.name || preview.canonicalProfile.name || '',
        phone: prev.phone || preview.canonicalProfile.phone || '',
        email: prev.email || preview.canonicalProfile.email || '',
        notes: prev.notes || preview.canonicalProfile.notes || '',
      }));
      setIsClientMergePreviewConfirmed(true);
      setClientMergeStep('preview');
    } catch (err) {
      const message =
        err instanceof APIError
          ? err.message
          : err instanceof Error
            ? err.message
            : 'Не удалось получить предпросмотр объединения';
      setMergeError(message);
      setIsClientMergePreviewConfirmed(false);
    } finally {
      setIsClientMergePreviewLoading(false);
    }
  }, [mergeClientTargetId, mergeSources]);

  const handleMergeSubmit = useCallback(async () => {
    if (!mergeClientTargetId) {
      return;
    }
    if (!mergeSources.length) {
      setMergeError('Выберите клиентов для объединения.');
      return;
    }
    if (!isClientMergePreviewConfirmed || !clientMergePreview) {
      setMergeError('Сначала выполните предпросмотр объединения.');
      return;
    }
    if (!clientMergeFieldOverrides.name.trim()) {
      setMergeError('Укажите итоговое ФИО клиента.');
      return;
    }
    setIsSyncing(true);
    setIsMergingClients(true);
    try {
      const previewSnapshotId = String(clientMergePreview.previewSnapshotId ?? '');
      const result = await mergeClients({
        targetClientId: mergeClientTargetId,
        sourceClientIds: mergeSources,
        includeDeleted: true,
        previewSnapshotId,
        fieldOverrides: {
          name: clientMergeFieldOverrides.name,
          phone: clientMergeFieldOverrides.phone,
          email: clientMergeFieldOverrides.email || null,
          notes: clientMergeFieldOverrides.notes,
        },
      });
      const mergedIds = new Set(result.mergedClientIds);
      updateAppData((prev) => ({
        clients: prev.clients
          .filter((client) => !mergedIds.has(client.id))
          .map((client) => (client.id === result.targetClient.id ? result.targetClient : client)),
        deals: prev.deals.map((deal) =>
          mergedIds.has(deal.clientId)
            ? {
                ...deal,
                clientId: result.targetClient.id,
                clientName: result.targetClient.name,
              }
            : deal,
        ),
        policies: prev.policies.map((policy) => {
          const policyClientId = policy.clientId ?? '';
          const insuredClientId = policy.insuredClientId ?? '';
          const shouldUpdatePrimary = Boolean(policyClientId && mergedIds.has(policyClientId));
          const shouldUpdateInsured = Boolean(insuredClientId && mergedIds.has(insuredClientId));
          if (!shouldUpdatePrimary && !shouldUpdateInsured) {
            return policy;
          }
          return {
            ...policy,
            clientId: shouldUpdatePrimary ? result.targetClient.id : policy.clientId,
            clientName: shouldUpdatePrimary ? result.targetClient.name : policy.clientName,
            insuredClientId: shouldUpdateInsured ? result.targetClient.id : policy.insuredClientId,
            insuredClientName: shouldUpdateInsured
              ? result.targetClient.name
              : policy.insuredClientName,
          };
        }),
      }));
      addNotification('Клиенты объединены', 'success', 4000);
      closeMergeModal();
      setError(null);
    } catch (err) {
      const message =
        err instanceof APIError
          ? err.message
          : err instanceof Error
            ? err.message
            : 'Ошибка при объединении клиентов';
      setMergeError(message);
      throw err;
    } finally {
      setIsSyncing(false);
      setIsMergingClients(false);
    }
  }, [
    addNotification,
    clientMergeFieldOverrides.email,
    clientMergeFieldOverrides.name,
    clientMergeFieldOverrides.notes,
    clientMergeFieldOverrides.phone,
    clientMergePreview,
    closeMergeModal,
    isClientMergePreviewConfirmed,
    mergeClientTargetId,
    mergeSources,
    setIsSyncing,
    setError,
    updateAppData,
  ]);

  const mergeCandidates = useMemo(() => {
    if (!mergeClientTargetId) {
      return [];
    }
    const normalized = mergeSearch.trim().toLowerCase();
    return clients.filter((client) => {
      if (client.id === mergeClientTargetId) {
        return false;
      }
      if (!normalized) {
        return true;
      }
      return client.name.toLowerCase().includes(normalized);
    });
  }, [clients, mergeClientTargetId, mergeSearch]);

  const mergeTargetClient = useMemo(
    () =>
      mergeClientTargetId
        ? (clients.find((client) => client.id === mergeClientTargetId) ?? null)
        : null,
    [clients, mergeClientTargetId],
  );

  const similarTargetClient = useMemo(
    () =>
      similarClientTargetId
        ? (clients.find((client) => client.id === similarClientTargetId) ?? null)
        : null,
    [clients, similarClientTargetId],
  );

  const handleMergeFromSimilar = useCallback(
    (candidateClientId: string) => {
      if (!similarTargetClient) {
        return;
      }
      closeSimilarClientsModal();
      handleClientMergeRequest(similarTargetClient, [candidateClientId]);
    },
    [closeSimilarClientsModal, handleClientMergeRequest, similarTargetClient],
  );

  return {
    isClientModalOverlayOpen,
    pendingDealClientId,
    editingClient,
    setEditingClient,
    clientDeleteTarget,
    setClientDeleteTarget,
    similarClientTargetId,
    similarCandidates,
    isSimilarClientsLoading,
    similarClientsError,
    mergeTargetClient,
    mergeCandidates,
    mergeSearch,
    setMergeSearch,
    mergeSources,
    mergeError,
    isMergingClients,
    isClientMergePreviewLoading,
    clientMergePreview,
    isClientMergePreviewConfirmed,
    clientMergeStep,
    clientMergeFieldOverrides,
    setClientMergeFieldOverrides,
    similarTargetClient,
    openClientModal,
    closeClientModal,
    handleAddClient,
    handlePendingDealClientConsumed,
    handleClientEditRequest,
    handleUpdateClient,
    handleClientDeleteRequest,
    handleDeleteClient,
    handleClientMergeRequest,
    handleClientFindSimilarRequest,
    closeSimilarClientsModal,
    toggleMergeSource,
    closeMergeModal,
    handleClientMergePreview,
    handleMergeSubmit,
    handleMergeFromSimilar,
  };
};
