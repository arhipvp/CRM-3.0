import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { usePolicyActions } from '../usePolicyActions';
import type {
  Client,
  Deal,
  FinancialRecord,
  Payment,
  Policy,
  SalesChannel,
  Statement,
  Task,
  User,
} from '../../../types';
import type { PolicyFormValues } from '../../../components/forms/addPolicy/types';

vi.mock('../../../api', () => {
  class APIError extends Error {
    status: number;

    constructor(message: string, status = 500) {
      super(message);
      this.status = status;
    }
  }

  return {
    APIError,
    createClient: vi.fn(),
    createFinancialRecord: vi.fn(),
    createPayment: vi.fn(),
    createPolicyDraft: vi.fn(),
    createPolicy: vi.fn(),
    deleteFinancialRecord: vi.fn(),
    deletePayment: vi.fn(),
    deletePolicy: vi.fn(),
    fetchDeal: vi.fn(),
    fetchClientById: vi.fn(),
    fetchPayments: vi.fn(),
    movePolicy: vi.fn(),
    updateFinancialRecord: vi.fn(),
    updatePayment: vi.fn(),
    updatePolicyDraft: vi.fn(),
    updatePolicy: vi.fn(),
    updatePolicyRenewed: vi.fn(),
  };
});

import {
  createFinancialRecord as createFinancialRecordApi,
  createPayment as createPaymentApi,
  createPolicy as createPolicyApi,
  createPolicyDraft,
  deletePolicy,
  deleteFinancialRecord,
  fetchPayments,
  fetchClientById,
  movePolicy,
  updatePayment as updatePaymentApi,
  updatePolicyDraft,
  updateFinancialRecord,
  updatePolicy,
  updatePolicyRenewed,
} from '../../../api';

const createFinancialRecordMock = vi.mocked(createFinancialRecordApi);
const createPaymentMock = vi.mocked(createPaymentApi);
const createPolicyMock = vi.mocked(createPolicyApi);
const createPolicyDraftMock = vi.mocked(createPolicyDraft);
const deletePolicyMock = vi.mocked(deletePolicy);
const deleteFinancialRecordMock = vi.mocked(deleteFinancialRecord);
const fetchPaymentsMock = vi.mocked(fetchPayments);
const movePolicyMock = vi.mocked(movePolicy);
const updatePaymentMock = vi.mocked(updatePaymentApi);
const updateFinancialRecordMock = vi.mocked(updateFinancialRecord);
const updatePolicyDraftMock = vi.mocked(updatePolicyDraft);
const updatePolicyMock = vi.mocked(updatePolicy);
const updatePolicyRenewedMock = vi.mocked(updatePolicyRenewed);

const createDeal = (overrides: Partial<Deal> = {}): Deal => ({
  id: 'deal-1',
  title: 'Сделка',
  clientId: 'client-1',
  clientName: 'Клиент',
  status: 'open',
  createdAt: '2025-01-01T00:00:00Z',
  quotes: [],
  documents: [],
  ...overrides,
});

const createPolicy = (overrides: Partial<Policy> = {}): Policy => ({
  id: 'policy-1',
  number: 'POL-1',
  insuranceCompanyId: 'company-1',
  insuranceCompany: 'Ингосстрах',
  insuranceTypeId: 'type-1',
  insuranceType: 'Каско',
  dealId: 'deal-1',
  isVehicle: true,
  status: 'active',
  createdAt: '2025-01-01T00:00:00Z',
  updatedAt: '2025-01-02T00:00:00Z',
  ...overrides,
});

const createFinancialRecord = (overrides: Partial<FinancialRecord> = {}): FinancialRecord => ({
  id: 'record-1',
  paymentId: 'payment-1',
  amount: '-1000',
  date: '2025-01-10',
  description: 'Расход',
  source: 'Система',
  note: 'Заметка',
  recordType: 'Расход',
  createdAt: '2025-01-01T00:00:00Z',
  updatedAt: '2025-01-02T00:00:00Z',
  ...overrides,
});

const createPayment = (overrides: Partial<Payment> = {}): Payment => ({
  id: 'payment-1',
  dealId: 'deal-1',
  policyId: 'policy-1',
  amount: '10000',
  description: 'Платёж',
  scheduledDate: '2025-01-10',
  actualDate: '2025-01-10',
  financialRecords: [],
  createdAt: '2025-01-01T00:00:00Z',
  updatedAt: '2025-01-02T00:00:00Z',
  ...overrides,
});

const createStatement = (overrides: Partial<Statement> = {}): Statement => ({
  id: 'statement-1',
  name: 'Ведомость',
  statementType: 'expense',
  status: 'paid',
  paidAt: '2025-01-11T00:00:00Z',
  createdAt: '2025-01-01T00:00:00Z',
  updatedAt: '2025-01-02T00:00:00Z',
  ...overrides,
});

const createPolicyValues = (overrides: Partial<PolicyFormValues> = {}): PolicyFormValues => ({
  number: 'POL-1',
  insuranceCompanyId: 'company-1',
  insuranceTypeId: 'type-1',
  isVehicle: true,
  brand: 'Alfa Romeo',
  model: 'Stelvio',
  vin: 'ZASPAKEV7M7D12770',
  payments: [],
  ...overrides,
});

const createParams = ({
  policy = createPolicy(),
  payments = [],
  statements = [],
}: {
  policy?: Policy;
  payments?: Payment[];
  statements?: Statement[];
} = {}) => {
  const appState: {
    clients: Client[];
    deals: Deal[];
    policies: Policy[];
    salesChannels: SalesChannel[];
    payments: Payment[];
    financialRecords: FinancialRecord[];
    statements: Statement[];
    tasks: Task[];
    users: User[];
  } = {
    clients: [],
    deals: [createDeal({ id: policy.dealId }), createDeal({ id: 'deal-2', title: 'Новая сделка' })],
    policies: [policy],
    salesChannels: [],
    payments,
    financialRecords: payments.flatMap((payment) => payment.financialRecords ?? []),
    statements,
    tasks: [],
    users: [],
  };

  return {
    params: {
      clients: [],
      dealsById: new Map<string, Deal>([
        [policy.dealId, createDeal({ id: policy.dealId })],
        ['deal-2', createDeal({ id: 'deal-2', title: 'Новая сделка' })],
      ]),
      policies: [policy],
      payments,
      statements,
      salesChannels: [],
      dealFilters: {},
      setModal: vi.fn(),
      setError: vi.fn(),
      setIsSyncing: vi.fn(),
      updateAppData: vi.fn((updater: (state: typeof appState) => Partial<typeof appState>) => {
        Object.assign(appState, updater(appState));
      }),
      invalidateDealsCache: vi.fn(),
      invalidateDealPoliciesCache: vi.fn(),
      loadDealPolicies: vi.fn().mockResolvedValue(undefined),
      mergeDealWithHydratedQuotes: vi.fn(),
      refreshDealsWithSelection: vi.fn().mockResolvedValue([]),
      syncDealsByIds: vi.fn().mockResolvedValue(undefined),
      selectDealById: vi.fn(),
      notifyDealEventsChanged: vi.fn(),
      adjustPaymentsTotals: vi.fn((items) => items),
    },
    appState,
  };
};

describe('usePolicyActions.handleUpdatePolicy', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    fetchPaymentsMock.mockResolvedValue([]);
  });

  it('дозагружает платежи полиса перед открытием формы редактирования', async () => {
    const policy = createPolicy();
    const record = createFinancialRecord({ id: 'record-hydrated', paymentId: 'payment-hydrated' });
    const hydratedPayment = createPayment({
      id: 'payment-hydrated',
      financialRecords: [record],
    });
    const { params, appState } = createParams({ policy, payments: [] });
    fetchPaymentsMock.mockResolvedValueOnce([hydratedPayment]);

    const { result } = renderHook(() => usePolicyActions(params));

    await act(async () => {
      await result.current.handleRequestEditPolicy(policy);
    });

    expect(fetchPaymentsMock).toHaveBeenCalledWith({
      policy: policy.id,
      include_financial_records: true,
    });
    expect(appState.payments).toEqual([hydratedPayment]);
    expect(appState.financialRecords).toEqual([record]);
    expect(result.current.editingPolicy).toEqual(policy);
    expect(params.setError).not.toHaveBeenCalled();
  });

  it('creates policy through draft endpoint instead of sequential payment APIs', async () => {
    const policy = createPolicy();
    const record = createFinancialRecord({ id: 'record-created' });
    const payment = createPayment({ id: 'payment-created', financialRecords: [record] });
    const { params, appState } = createParams({ policy });
    createPolicyDraftMock.mockResolvedValue({ policy, payments: [payment] });

    const { result } = renderHook(() => usePolicyActions(params));

    await act(async () => {
      await result.current.handleAddPolicy(
        policy.dealId,
        createPolicyValues({
          payments: [
            {
              amount: '10000',
              description: 'Платёж',
              scheduledDate: '2025-01-10',
              actualDate: '2025-01-10',
              incomes: [{ amount: '1000', description: 'Доход' }],
              expenses: [],
            },
          ],
        }),
      );
    });

    expect(createPolicyDraftMock).toHaveBeenCalledWith(
      expect.objectContaining({
        dealId: policy.dealId,
        number: 'POL-1',
        payments: expect.any(Array),
      }),
    );
    expect(createPolicyMock).not.toHaveBeenCalled();
    expect(createPaymentMock).not.toHaveBeenCalled();
    expect(createFinancialRecordMock).not.toHaveBeenCalled();
    expect(appState.policies[0]).toEqual(policy);
    expect(appState.payments[0]).toEqual(payment);
    expect(appState.financialRecords[0]).toEqual(record);
    expect(params.notifyDealEventsChanged).toHaveBeenCalledWith([policy.dealId]);
    expect(params.setError).not.toHaveBeenCalled();
  });

  it('updates policy through draft endpoint instead of local payment orchestration', async () => {
    const existingPayment = createPayment();
    const policy = createPolicy();
    const updatedPolicy = createPolicy({ number: 'POL-UPDATED' });
    const updatedPayment = createPayment({
      id: existingPayment.id,
      amount: '12000',
      financialRecords: [createFinancialRecord({ id: 'record-updated' })],
    });
    const { params, appState } = createParams({
      policy,
      payments: [existingPayment],
      statements: [createStatement()],
    });
    updatePolicyDraftMock.mockResolvedValue({
      policy: updatedPolicy,
      payments: [updatedPayment],
    });

    const { result } = renderHook(() => usePolicyActions(params));

    await act(async () => {
      await result.current.handleUpdatePolicy(
        policy.id,
        createPolicyValues({ number: updatedPolicy.number }),
      );
    });

    expect(updatePolicyDraftMock).toHaveBeenCalledWith(
      policy.id,
      expect.objectContaining({ number: updatedPolicy.number }),
    );
    expect(updatePolicyMock).not.toHaveBeenCalled();
    expect(updatePaymentMock).not.toHaveBeenCalled();
    expect(updateFinancialRecordMock).not.toHaveBeenCalled();
    expect(updateFinancialRecordMock).not.toHaveBeenCalled();
    expect(deleteFinancialRecordMock).not.toHaveBeenCalled();
    expect(appState.policies[0]).toEqual(updatedPolicy);
    expect(appState.payments[0]).toEqual(updatedPayment);
    expect(params.notifyDealEventsChanged).toHaveBeenCalledWith([policy.dealId]);
    expect(params.setError).not.toHaveBeenCalled();
  });

  it('shows backend draft validation message without duplicating local finance rules', async () => {
    const policy = createPolicy();
    const { params } = createParams({ policy });
    updatePolicyDraftMock.mockRejectedValue(
      new Error('Нельзя изменять записи в выплаченной ведомости.'),
    );

    const { result } = renderHook(() => usePolicyActions(params));

    await expect(
      act(async () => {
        await result.current.handleUpdatePolicy(policy.id, createPolicyValues());
      }),
    ).rejects.toThrow('Нельзя изменять записи в выплаченной ведомости.');

    expect(updatePolicyDraftMock).toHaveBeenCalled();
    expect(updateFinancialRecordMock).not.toHaveBeenCalled();
    expect(params.setError).toHaveBeenCalledWith('Нельзя изменять записи в выплаченной ведомости.');
  });

  it('updates policy renewed flag through a lightweight patch', async () => {
    const policy = createPolicy();
    const { params } = createParams({ policy });

    updatePolicyRenewedMock.mockResolvedValue({
      ...policy,
      isRenewed: true,
    });

    const { result } = renderHook(() => usePolicyActions(params));

    await act(async () => {
      await result.current.handleUpdatePolicyRenewed(policy.id, true);
    });

    expect(updatePolicyRenewedMock).toHaveBeenCalledWith(policy.id, true);
    expect(updatePolicyMock).not.toHaveBeenCalled();
    expect(params.syncDealsByIds).toHaveBeenCalledWith([policy.dealId]);
    expect(params.notifyDealEventsChanged).toHaveBeenCalledWith([policy.dealId]);
  });

  it('notifies deal events after deleting a policy', async () => {
    const policy = createPolicy();
    const payment = createPayment({ policyId: policy.id, dealId: policy.dealId });
    const { params, appState } = createParams({ policy, payments: [payment] });
    deletePolicyMock.mockResolvedValue(undefined);

    const { result } = renderHook(() => usePolicyActions(params));

    await act(async () => {
      await result.current.handleDeletePolicy(policy.id);
    });

    expect(deletePolicyMock).toHaveBeenCalledWith(policy.id);
    expect(params.syncDealsByIds).toHaveBeenCalledWith([policy.dealId]);
    expect(params.loadDealPolicies).toHaveBeenCalledWith(policy.dealId, { force: true });
    expect(params.notifyDealEventsChanged).toHaveBeenCalledWith([policy.dealId]);
    expect(appState.policies).toEqual([]);
    expect(appState.payments).toEqual([]);
  });

  it('moves policy and refreshes both affected deals', async () => {
    const policy = createPolicy();
    const payment = createPayment({ policyId: policy.id, dealId: policy.dealId });
    const { params, appState } = createParams({ policy, payments: [payment] });
    const movedPolicy = {
      ...policy,
      dealId: 'deal-2',
      dealTitle: 'Новая сделка',
    };
    movePolicyMock.mockResolvedValue(movedPolicy);

    const { result } = renderHook(() => usePolicyActions(params));

    await act(async () => {
      await result.current.handleMovePolicy(policy.id, 'deal-2');
    });

    expect(movePolicyMock).toHaveBeenCalledWith(policy.id, 'deal-2');
    expect(params.invalidateDealPoliciesCache).toHaveBeenCalledWith(policy.dealId);
    expect(params.invalidateDealPoliciesCache).toHaveBeenCalledWith('deal-2');
    expect(params.syncDealsByIds).toHaveBeenCalledWith([policy.dealId, 'deal-2']);
    expect(params.loadDealPolicies).toHaveBeenCalledWith(policy.dealId, { force: true });
    expect(params.loadDealPolicies).toHaveBeenCalledWith('deal-2', { force: true });
    expect(params.notifyDealEventsChanged).toHaveBeenCalledWith([policy.dealId, 'deal-2']);
    expect(appState.policies[0].dealId).toBe('deal-2');
    expect(appState.payments[0].dealId).toBe('deal-2');
  });
});

describe('usePolicyActions counterparty defaults', () => {
  beforeEach(() => vi.resetAllMocks());

  const dealClient: Client = {
    id: 'client-1',
    name: 'ООО Ромашка',
    createdAt: '',
    updatedAt: '',
    referredBy: 'referrer-1',
    referredByName: 'Иванов',
    referredByDeleted: false,
  };

  it('uses deal client as default counterparty with priority over referrer', async () => {
    vi.mocked(fetchClientById).mockResolvedValue({ ...dealClient, isCounterparty: true });
    const deal = createDeal({
      id: 'deal-1',
      clientId: 'client-1',
      clientName: 'ООО Ромашка',
      executorName: 'Alisa',
    });
    const { result } = renderHook(() =>
      usePolicyActions({
        ...createParams().params,
        clients: [
          {
            id: 'client-1',
            name: 'ООО Ромашка',
            isCounterparty: true,
            createdAt: '2025-01-01T00:00:00Z',
            updatedAt: '2025-01-01T00:00:00Z',
          },
        ],
        dealsById: new Map([[deal.id, deal]]),
      }),
    );

    act(() => {
      result.current.handleRequestAddPolicy(deal.id);
    });

    await waitFor(() => expect(result.current.policyDefaultCounterparty).toBe('ООО Ромашка'));
    expect(result.current.policyDealExecutorName).toBe('Alisa');
  });

  it('loads the current deal client even when neither client nor referrer is cached', async () => {
    vi.mocked(fetchClientById).mockResolvedValue(dealClient);
    const { result } = renderHook(() => usePolicyActions(createParams().params));
    act(() => result.current.handleRequestAddPolicy('deal-1'));
    expect(result.current.isPolicyClientLoading).toBe(true);
    await waitFor(() => expect(result.current.policyDefaultCounterparty).toBe('Иванов'));
    expect(fetchClientById).toHaveBeenCalledWith(
      'client-1',
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    );
  });

  it.each([
    { ...dealClient, referredByDeleted: true },
    { ...dealClient, referredBy: null, referredByName: null },
  ])('does not reward a missing or deleted referrer', async (client) => {
    vi.mocked(fetchClientById).mockResolvedValue(client);
    const { result } = renderHook(() => usePolicyActions(createParams().params));
    act(() => result.current.handleRequestAddPolicy('deal-1'));
    await waitFor(() => expect(result.current.isPolicyClientLoading).toBe(false));
    expect(result.current.policyDefaultCounterparty).toBeUndefined();
  });

  it('keeps recognition data on a failed load and retries using the deal client, not the insured', async () => {
    vi.mocked(fetchClientById)
      .mockRejectedValueOnce(new Error('Ошибка сети'))
      .mockResolvedValueOnce(dealClient);
    const { result } = renderHook(() =>
      usePolicyActions({
        ...createParams().params,
        clients: [{ ...dealClient, id: 'insured-1', name: 'Страхователь', isCounterparty: true }],
      }),
    );
    act(() =>
      result.current.handlePolicyDraftReady(
        'deal-1',
        {
          policy: { number: 'RECOGNIZED', client_name: 'Страхователь' },
          payments: [{ amount: '1000' }, { amount: '2000' }],
        },
        null,
        'file-1',
      ),
    );
    await waitFor(() => expect(result.current.policyClientError).toBe('Ошибка сети'));
    expect(result.current.policyPrefill?.values.clientId).toBe('insured-1');
    act(() => result.current.retryPolicyClientLoad());
    await waitFor(() => expect(result.current.policyDefaultCounterparty).toBe('Иванов'));
    expect(result.current.policyClientError).toBeNull();
    expect(result.current.policyPrefill?.values.number).toBe('RECOGNIZED');
    expect(result.current.policyPrefill?.values.payments).toHaveLength(2);
    expect(fetchClientById).toHaveBeenLastCalledWith('client-1', expect.any(Object));
  });

  it('ignores a late client response after closing the form', async () => {
    let resolveClient!: (client: Client) => void;
    vi.mocked(fetchClientById).mockReturnValue(
      new Promise((resolve) => {
        resolveClient = resolve;
      }),
    );
    const { result } = renderHook(() => usePolicyActions(createParams().params));
    act(() => result.current.handleRequestAddPolicy('deal-1'));
    act(() => result.current.closePolicyModal());
    await act(async () => resolveClient(dealClient));
    expect(result.current.policyDealId).toBeNull();
    expect(result.current.policyDefaultCounterparty).toBeUndefined();
  });

  it('keeps the open form stable across background deal refreshes and reloads on next opening', async () => {
    vi.mocked(fetchClientById).mockResolvedValue(dealClient);
    const params = createParams().params;
    const { result, rerender } = renderHook((props) => usePolicyActions(props), {
      initialProps: params,
    });
    act(() => result.current.handleRequestAddPolicy('deal-1'));
    await waitFor(() => expect(result.current.policyDefaultCounterparty).toBe('Иванов'));
    rerender({
      ...params,
      dealsById: new Map([['deal-1', createDeal({ clientId: 'new-client' })]]),
    });
    expect(fetchClientById).toHaveBeenCalledTimes(1);
    expect(result.current.policyDefaultCounterparty).toBe('Иванов');
    act(() => result.current.closePolicyModal());
    act(() => result.current.handleRequestAddPolicy('deal-1'));
    await waitFor(() =>
      expect(fetchClientById).toHaveBeenLastCalledWith('new-client', expect.any(Object)),
    );
    await waitFor(() => expect(result.current.isPolicyClientLoading).toBe(false));
  });
});
