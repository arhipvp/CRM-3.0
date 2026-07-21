import { useCallback, useEffect, useMemo, useState } from 'react';

import {
  APIError,
  createClient,
  deleteClient,
  excludeClientSimilarity,
  finalizeClientMerge,
  fetchClientMergeSession,
  fetchSimilarClients,
  previewClientMerge,
  retryClientMerge,
  startClientMerge,
  stepClientMerge,
  updateClient,
} from '../../api';
import type { ModalType } from '../../components/app/types';
import type { NotificationContextType } from '../../contexts/NotificationTypes';
import type {
  Client,
  ClientMergePreviewResponse,
  ClientMergeResponse,
  ClientMergeSessionStatus,
  ClientSimilarityCandidate,
} from '../../types';
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

const CLIENT_MERGE_SESSION_STORAGE_KEY = 'crm3.clientMerge.activeSessionId';

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
  const [clientMergeSession, setClientMergeSession] = useState<ClientMergeSessionStatus | null>(
    null,
  );

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
      setClientMergeSession(null);
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
    setClientMergeSession(null);
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
    setClientMergeSession(null);
    window.localStorage.removeItem(CLIENT_MERGE_SESSION_STORAGE_KEY);
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
      setClientMergeFieldOverrides(() => ({
        name: preview.canonicalProfile.name || '',
        phone: preview.canonicalProfile.phone || '',
        email: preview.canonicalProfile.email || '',
        notes: preview.canonicalProfile.notes || '',
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

  const applyClientMergeResult = useCallback(
    (result: ClientMergeResponse) => {
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
      if (result.warnings?.length) {
        addNotification(result.warnings.join('\n'), 'warning', 8000);
      }
      window.localStorage.removeItem(CLIENT_MERGE_SESSION_STORAGE_KEY);
      closeMergeModal();
      setError(null);
    },
    [addNotification, closeMergeModal, setError, updateAppData],
  );

  const continueClientMergeSession = useCallback(
    async (initialSession: ClientMergeSessionStatus) => {
      let session = initialSession;
      setClientMergeSession(session);
      setMergeError(null);

      while (session.status === 'moving_drive') {
        session = await stepClientMerge(session.id);
        setClientMergeSession(session);
      }

      if (session.status === 'failed') {
        const message =
          session.lastError ||
          (session.retryable
            ? 'Google Drive временно не ответил. Нажмите «Повторить», чтобы продолжить.'
            : 'Не удалось перенести документы Google Drive.');
        setMergeError(message);
        return;
      }

      if (session.status === 'ready_to_finalize') {
        setMergeError(null);
        const result = await finalizeClientMerge(session.id);
        applyClientMergeResult(result);
      }
    },
    [applyClientMergeResult],
  );

  useEffect(() => {
    if (!mergeClientTargetId || clientMergeSession) {
      return;
    }
    const sessionId = window.localStorage.getItem(CLIENT_MERGE_SESSION_STORAGE_KEY);
    if (!sessionId) {
      return;
    }

    let isActive = true;
    void (async () => {
      try {
        const session = await fetchClientMergeSession(sessionId);
        if (!isActive) {
          return;
        }
        if (
          session.targetClientId !== mergeClientTargetId ||
          session.status === 'succeeded' ||
          session.status === 'canceled'
        ) {
          window.localStorage.removeItem(CLIENT_MERGE_SESSION_STORAGE_KEY);
          return;
        }
        setMergeSources(session.sourceClientIds);
        setClientMergeStep('preview');
        setClientMergeSession(session);
        if (session.status === 'failed') {
          setMergeError(
            session.lastError ||
              'Перенос документов остановлен. Нажмите «Повторить», чтобы продолжить.',
          );
          return;
        }
        setIsSyncing(true);
        setIsMergingClients(true);
        await continueClientMergeSession(session);
      } catch {
        window.localStorage.removeItem(CLIENT_MERGE_SESSION_STORAGE_KEY);
      } finally {
        if (isActive) {
          setIsSyncing(false);
          setIsMergingClients(false);
        }
      }
    })();

    return () => {
      isActive = false;
    };
  }, [clientMergeSession, continueClientMergeSession, mergeClientTargetId, setIsSyncing]);

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
      const session = await startClientMerge({
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
      window.localStorage.setItem(CLIENT_MERGE_SESSION_STORAGE_KEY, session.id);
      await continueClientMergeSession(session);
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
    clientMergeFieldOverrides.email,
    clientMergeFieldOverrides.name,
    clientMergeFieldOverrides.notes,
    clientMergeFieldOverrides.phone,
    clientMergePreview,
    continueClientMergeSession,
    isClientMergePreviewConfirmed,
    mergeClientTargetId,
    mergeSources,
    setIsSyncing,
  ]);

  const handleClientMergeRetry = useCallback(async () => {
    if (!clientMergeSession?.id || !clientMergeSession.retryable) {
      return;
    }
    setIsSyncing(true);
    setIsMergingClients(true);
    try {
      const session = await retryClientMerge(clientMergeSession.id);
      await continueClientMergeSession(session);
    } catch (err) {
      const message =
        err instanceof APIError
          ? err.message
          : err instanceof Error
            ? err.message
            : 'Ошибка при продолжении объединения клиентов';
      setMergeError(message);
      throw err;
    } finally {
      setIsSyncing(false);
      setIsMergingClients(false);
    }
  }, [
    clientMergeSession?.id,
    clientMergeSession?.retryable,
    continueClientMergeSession,
    setIsSyncing,
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

  const handleExcludeClientSimilarity = useCallback(
    async (candidateClientId: string) => {
      if (!similarTargetClient) {
        return;
      }
      try {
        await excludeClientSimilarity({
          targetClientId: similarTargetClient.id,
          candidateClientId,
        });
        setSimilarCandidates((prev) => prev.filter((item) => item.client.id !== candidateClientId));
        updateAppData((prev) => ({
          ...prev,
          clients: [...prev.clients],
        }));
        addNotification('Совпадение скрыто', 'success', 3000);
      } catch (err) {
        setSimilarClientsError(formatErrorMessage(err, 'Не удалось скрыть совпадение.'));
      }
    },
    [addNotification, similarTargetClient, updateAppData],
  );

  const handleMergeFromSimilar = useCallback(
    async (candidateClientId: string) => {
      if (!similarTargetClient) {
        return;
      }
      closeSimilarClientsModal();
      const sourceClientIds = [candidateClientId];
      setMergeClientTargetId(similarTargetClient.id);
      setMergeSources(sourceClientIds);
      setMergeSearch('');
      setMergeError(null);
      setClientMergePreview(null);
      setIsClientMergePreviewConfirmed(false);
      setClientMergeStep('preview');
      setClientMergeSession(null);
      setClientMergeFieldOverrides({
        name: similarTargetClient.name ?? '',
        phone: similarTargetClient.phone ?? '',
        email: similarTargetClient.email ?? '',
        notes: similarTargetClient.notes ?? '',
      });
      setIsClientMergePreviewLoading(true);
      try {
        const preview = await previewClientMerge({
          targetClientId: similarTargetClient.id,
          sourceClientIds,
          includeDeleted: true,
        });
        setClientMergePreview(preview);
        setClientMergeFieldOverrides(() => ({
          name: preview.canonicalProfile.name || '',
          phone: preview.canonicalProfile.phone || '',
          email: preview.canonicalProfile.email || '',
          notes: preview.canonicalProfile.notes || '',
        }));
        setIsClientMergePreviewConfirmed(true);
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
    },
    [closeSimilarClientsModal, similarTargetClient],
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
    clientMergeSession,
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
    handleClientMergeRetry,
    handleExcludeClientSimilarity,
    handleMergeFromSimilar,
  };
};
