import { act, renderHook } from '@testing-library/react';
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
    createPolicy: vi.fn(),
    deleteFinancialRecord: vi.fn(),
    deletePayment: vi.fn(),
    deletePolicy: vi.fn(),
    fetchDeal: vi.fn(),
    updateFinancialRecord: vi.fn(),
    updatePayment: vi.fn(),
    updatePolicy: vi.fn(),
  };
});

import { deleteFinancialRecord, updateFinancialRecord, updatePolicy } from '../../../api';

const deleteFinancialRecordMock = vi.mocked(deleteFinancialRecord);
const updateFinancialRecordMock = vi.mocked(updateFinancialRecord);
const updatePolicyMock = vi.mocked(updatePolicy);

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
    deals: [createDeal({ id: policy.dealId })],
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
      dealsById: new Map<string, Deal>([[policy.dealId, createDeal({ id: policy.dealId })]]),
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
      adjustPaymentsTotals: vi.fn((items) => items),
    },
    appState,
  };
};

describe('usePolicyActions.handleUpdatePolicy', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('удаляет расход и не считает неизменённую запись из оплаченной ведомости изменённой', async () => {
    const paidRecord = createFinancialRecord({
      id: 'record-paid',
      statementId: 'statement-1',
      amount: '-1500',
      description: 'Расход исполнителю',
      note: 'Комиссия',
    });
    const removedRecord = createFinancialRecord({
      id: 'record-delete',
      amount: '-500',
      description: 'Удаляемый расход',
      note: 'Удалить',
    });
    const payment = createPayment({
      financialRecords: [paidRecord, removedRecord],
    });
    const policy = createPolicy();
    const { params } = createParams({
      policy,
      payments: [payment],
      statements: [createStatement()],
    });

    updatePolicyMock.mockResolvedValue(policy);
    deleteFinancialRecordMock.mockResolvedValue(undefined);

    const { result } = renderHook(() => usePolicyActions(params));

    await act(async () => {
      await result.current.handleUpdatePolicy(
        policy.id,
        createPolicyValues({
          payments: [
            {
              id: payment.id,
              amount: payment.amount,
              description: payment.description,
              scheduledDate: payment.scheduledDate ?? '',
              actualDate: payment.actualDate ?? '',
              incomes: [],
              expenses: [
                {
                  id: paidRecord.id,
                  amount: '1500',
                  date: paidRecord.date ?? '',
                  description: paidRecord.description ?? '',
                  source: paidRecord.source ?? '',
                  note: paidRecord.note ?? '',
                },
              ],
            },
          ],
        }),
      );
    });

    expect(deleteFinancialRecordMock).toHaveBeenCalledTimes(1);
    expect(deleteFinancialRecordMock).toHaveBeenCalledWith('record-delete');
    expect(updateFinancialRecordMock).not.toHaveBeenCalled();
    expect(params.setError).not.toHaveBeenCalled();
  });

  it('сохраняет полис без ошибки, если запись в оплаченной ведомости не менялась', async () => {
    const paidRecord = createFinancialRecord({
      id: 'record-paid',
      statementId: 'statement-1',
      amount: '-1500',
      description: 'Расход исполнителю',
      note: 'Комиссия',
    });
    const payment = createPayment({
      financialRecords: [paidRecord],
    });
    const policy = createPolicy();
    const { params } = createParams({
      policy,
      payments: [payment],
      statements: [createStatement()],
    });

    updatePolicyMock.mockResolvedValue(policy);

    const { result } = renderHook(() => usePolicyActions(params));

    await act(async () => {
      await result.current.handleUpdatePolicy(
        policy.id,
        createPolicyValues({
          payments: [
            {
              id: payment.id,
              amount: payment.amount,
              description: payment.description,
              scheduledDate: payment.scheduledDate ?? '',
              actualDate: payment.actualDate ?? '',
              incomes: [],
              expenses: [
                {
                  id: paidRecord.id,
                  amount: '1500',
                  date: paidRecord.date ?? '',
                  description: paidRecord.description ?? '',
                  source: paidRecord.source ?? '',
                  note: paidRecord.note ?? '',
                },
              ],
            },
          ],
        }),
      );
    });

    expect(updateFinancialRecordMock).not.toHaveBeenCalled();
    expect(params.setError).not.toHaveBeenCalled();
  });

  it('по-прежнему блокирует реальное изменение записи в оплаченной ведомости', async () => {
    const paidRecord = createFinancialRecord({
      id: 'record-paid',
      statementId: 'statement-1',
      amount: '-1500',
      description: 'Расход исполнителю',
      note: 'Комиссия',
    });
    const payment = createPayment({
      financialRecords: [paidRecord],
    });
    const policy = createPolicy();
    const { params } = createParams({
      policy,
      payments: [payment],
      statements: [createStatement()],
    });

    updatePolicyMock.mockResolvedValue(policy);

    const { result } = renderHook(() => usePolicyActions(params));

    await expect(
      act(async () => {
        await result.current.handleUpdatePolicy(
          policy.id,
          createPolicyValues({
            payments: [
              {
                id: payment.id,
                amount: payment.amount,
                description: payment.description,
                scheduledDate: payment.scheduledDate ?? '',
                actualDate: payment.actualDate ?? '',
                incomes: [],
                expenses: [
                  {
                    id: paidRecord.id,
                    amount: '1500',
                    date: paidRecord.date ?? '',
                    description: 'Изменённый расход',
                    source: paidRecord.source ?? '',
                    note: paidRecord.note ?? '',
                  },
                ],
              },
            ],
          }),
        );
      }),
    ).rejects.toThrow('Нельзя изменять записи в выплаченной ведомости.');

    expect(updateFinancialRecordMock).not.toHaveBeenCalled();
  });
});
