import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { AppOverlayShell } from '../AppOverlayShell';

vi.mock('../../../../components/app/AppModals', () => ({
  AppModals: () => <div data-testid="app-modals-shell" />,
}));

vi.mock('../../../../components/app/AppDealPreviewModal', () => ({
  AppDealPreviewModal: () => <div data-testid="deal-preview-shell" />,
}));

vi.mock('../../../../components/app/ClientMergeModal', () => ({
  ClientMergeModal: () => <div data-testid="client-merge-shell" />,
}));

vi.mock('../../../../components/views/SimilarClientsModal', () => ({
  SimilarClientsModal: () => <div data-testid="similar-clients-shell" />,
}));

const baseProps = {
  appModalsProps: {
    modal: null,
    setModal: vi.fn(),
    openClientModal: vi.fn(),
    closeClientModal: vi.fn(),
    isClientModalOverlayOpen: false,
    clients: [],
    users: [],
    handleAddClient: vi.fn(),
    handleAddDeal: vi.fn(),
    pendingDealClientId: null,
    onPendingDealClientConsumed: vi.fn(),
    quoteDealId: null,
    setQuoteDealId: vi.fn(),
    handleAddQuote: vi.fn(),
    editingQuote: null,
    setEditingQuote: vi.fn(),
    handleUpdateQuote: vi.fn(),
    policyDealId: null,
    policyDefaultCounterparty: '',
    closePolicyModal: vi.fn(),
    policyPrefill: null,
    policyDealExecutorName: '',
    editingPolicyExecutorName: '',
    editingPolicy: null,
    setEditingPolicy: vi.fn(),
    salesChannels: [],
    handleAddPolicy: vi.fn(),
    handleUpdatePolicy: vi.fn(),
    paymentModal: null,
    setPaymentModal: vi.fn(),
    handleUpdatePayment: vi.fn(),
    payments: [],
    financialRecordModal: null,
    setFinancialRecordModal: vi.fn(),
    handleUpdateFinancialRecord: vi.fn(),
    financialRecords: [],
    confirm: vi.fn(),
  },
  clientDeleteTarget: {
    id: 'client-1',
    name: 'Иван Иванов',
    createdAt: '',
    updatedAt: '',
  },
  closeMergeModal: vi.fn(),
  closeSimilarClientsModal: vi.fn(),
  confirmDialogRenderer: <div data-testid="confirm-renderer" />,
  editingClient: {
    id: 'client-2',
    name: 'Петр Петров',
    phone: '+79990000000',
    email: 'petr@example.com',
    birthDate: null,
    notes: 'notes',
    createdAt: '',
    updatedAt: '',
  },
  handleClientMergePreview: vi.fn().mockResolvedValue(undefined),
  handleCreateTask: vi.fn().mockResolvedValue(undefined),
  handleDeleteClient: vi.fn().mockResolvedValue(undefined),
  handleMergeFromSimilar: vi.fn(),
  handleMergeSubmit: vi.fn().mockResolvedValue(undefined),
  handleUpdateClient: vi.fn().mockResolvedValue(undefined),
  isClientMergePreviewConfirmed: false,
  isClientMergePreviewLoading: false,
  isMergingClients: false,
  isSimilarClientsLoading: false,
  isSyncing: false,
  mergeCandidates: [],
  mergeError: null,
  mergeSearch: '',
  mergeSources: [],
  mergeTargetClient: {
    id: 'client-3',
    name: 'Target',
    createdAt: '',
    updatedAt: '',
  },
  onCloseClientDelete: vi.fn(),
  onCloseEditClient: vi.fn(),
  onCloseQuickTask: vi.fn(),
  previewModalProps: {
    isOpen: true,
    previewDeal: null,
    previewClient: null,
    previewSellerUser: undefined,
    previewExecutorUser: undefined,
    onClose: vi.fn(),
    panelProps: {} as never,
  },
  quickTaskDeal: {
    id: 'deal-1',
    title: 'Сделка 1',
    executor: 'user-1',
  },
  quickTaskUsers: [
    {
      id: 'user-1',
      username: 'executor',
      roles: [],
    },
  ],
  setClientMergeFieldOverrides: vi.fn(),
  setMergeSearch: vi.fn(),
  similarCandidates: [],
  similarClientTargetId: 'client-1',
  similarClientsError: null,
  similarTargetClient: {
    id: 'client-1',
    name: 'Иван Иванов',
    createdAt: '',
    updatedAt: '',
  },
  toggleMergeSource: vi.fn(),
  clientMergeFieldOverrides: {
    name: 'Target',
    phone: '',
    email: '',
    notes: '',
  },
  clientMergePreview: null,
  clientMergeStep: 'select' as const,
};

describe('AppOverlayShell', () => {
  it('renders modal layer and local overlays together', async () => {
    render(<AppOverlayShell {...baseProps} />);

    expect(screen.getByText('Новая задача: Сделка 1')).toBeInTheDocument();
    expect(screen.getByText('Редактировать клиента')).toBeInTheDocument();
    expect(screen.getByText(/станут недоступны/)).toBeInTheDocument();
    expect(screen.getByTestId('confirm-renderer')).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByTestId('app-modals-shell')).toBeInTheDocument();
      expect(screen.getByTestId('deal-preview-shell')).toBeInTheDocument();
      expect(screen.getByTestId('client-merge-shell')).toBeInTheDocument();
      expect(screen.getByTestId('similar-clients-shell')).toBeInTheDocument();
    });
  });

  it('closes quick task modal after successful create', async () => {
    render(<AppOverlayShell {...baseProps} />);

    fireEvent.change(screen.getByLabelText('Название задачи *'), {
      target: { value: 'Позвонить клиенту' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Создать' }));

    await waitFor(() => {
      expect(baseProps.handleCreateTask).toHaveBeenCalled();
      expect(baseProps.onCloseQuickTask).toHaveBeenCalled();
    });
  });
});
