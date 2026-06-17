import { beforeEach, describe, expect, it, vi } from 'vitest';

import { createPolicyDraft, movePolicy } from '../policies';

const DEAL_ID = '16c3bcb8-4118-433b-81aa-5a6385538ece';
const COMPANY_ID = 'd2be7261-c17e-441c-9214-054060e288cf';
const TYPE_ID = 'a3f5b7fa-787c-413b-837f-00a8b32f2d43';
const CLIENT_ID = '8ca0a33d-5b11-4b5b-9617-0964cab6a9df';
const PAYMENT_ID = '11111111-1111-4111-8111-111111111111';
const INCOME_ID = '22222222-2222-4222-8222-222222222222';
const EXPENSE_ID = '33333333-3333-4333-8333-333333333333';

const buildPolicyDraftPayload = (
  overrides: Partial<Parameters<typeof createPolicyDraft>[0]> = {},
): Parameters<typeof createPolicyDraft>[0] => ({
  dealId: DEAL_ID,
  number: 'SYS2851082838',
  insuranceCompanyId: COMPANY_ID,
  insuranceTypeId: TYPE_ID,
  clientId: CLIENT_ID,
  isVehicle: true,
  brand: 'VOLKSWAGEN',
  model: 'TIGUAN',
  vin: 'XW8ZZZ5NZKG236893',
  payments: [
    {
      amount: '44028.00',
      scheduledDate: '2025-07-26',
      incomes: [{ amount: '44028.00' }],
      expenses: [],
    },
  ],
  ...overrides,
});

const readDraftRequestBody = (fetchMock: ReturnType<typeof vi.fn>): Record<string, unknown> => {
  const [, requestOptions] = fetchMock.mock.calls[0];
  return JSON.parse(String(requestOptions.body)) as Record<string, unknown>;
};

describe('movePolicy', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    window.localStorage.clear();
  });

  it('posts target deal to policy move endpoint', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          id: 'policy-1',
          number: 'POL-1',
          deal: 'deal-2',
          deal_title: 'Target deal',
          is_vehicle: false,
          status: 'active',
          created_at: '2026-01-01T00:00:00Z',
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      ),
    );
    vi.stubGlobal('fetch', fetchMock);

    const result = await movePolicy('policy-1', 'deal-2');

    expect(fetchMock).toHaveBeenCalledWith(
      '/api/v1/policies/policy-1/move/',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ deal: 'deal-2' }),
      }),
    );
    expect(result.dealId).toBe('deal-2');
  });
});

describe('createPolicyDraft', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    window.localStorage.clear();
  });

  it('posts a valid policy draft payload with UUID references', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          policy: {
            id: '07cede94-f524-418f-b504-34d4e0ae5ebf',
            number: 'SYS2851082838',
            insurance_company: COMPANY_ID,
            insurance_company_name: 'РЕСО-ГАРАНТИЯ',
            insurance_type: TYPE_ID,
            insurance_type_name: 'КАСКО',
            deal: DEAL_ID,
            client: CLIENT_ID,
            client_name: 'Пчелинцев Александр Вячеславович',
            is_vehicle: true,
            status: 'active',
            created_at: '2026-06-17T00:00:00Z',
          },
          payments: [],
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      ),
    );
    vi.stubGlobal('fetch', fetchMock);

    const result = await createPolicyDraft(buildPolicyDraftPayload());

    expect(fetchMock).toHaveBeenCalledWith(
      '/api/v1/policies/draft/',
      expect.objectContaining({
        method: 'POST',
      }),
    );
    expect(readDraftRequestBody(fetchMock)).toEqual(
      expect.objectContaining({
        deal: DEAL_ID,
        number: 'SYS2851082838',
        insurance_company: COMPANY_ID,
        insurance_type: TYPE_ID,
        client: CLIENT_ID,
      }),
    );
    expect(result.policy.dealId).toBe(DEAL_ID);
  });

  it('omits blank payment and financial record ids from draft payload', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          policy: {
            id: '07cede94-f524-418f-b504-34d4e0ae5ebf',
            number: 'SYS2851082838',
            insurance_company: COMPANY_ID,
            insurance_type: TYPE_ID,
            deal: DEAL_ID,
            is_vehicle: true,
            status: 'active',
            created_at: '2026-06-17T00:00:00Z',
          },
          payments: [],
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      ),
    );
    vi.stubGlobal('fetch', fetchMock);

    await createPolicyDraft(
      buildPolicyDraftPayload({
        payments: [
          {
            id: '',
            amount: '3375.59',
            scheduledDate: '2025-07-26',
            actualDate: '2025-07-26',
            incomes: [{ id: '', amount: '3375.59' }],
            expenses: [{ id: '   ', amount: '100.00' }],
          },
        ],
      }),
    );

    const body = readDraftRequestBody(fetchMock);
    const [payment] = body.payments as Array<Record<string, unknown>>;
    const [income] = payment.incomes as Array<Record<string, unknown>>;
    const [expense] = payment.expenses as Array<Record<string, unknown>>;
    expect(payment).not.toHaveProperty('id');
    expect(income).not.toHaveProperty('id');
    expect(expense).not.toHaveProperty('id');
  });

  it('keeps valid payment and financial record ids in draft payload', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          policy: {
            id: '07cede94-f524-418f-b504-34d4e0ae5ebf',
            number: 'SYS2851082838',
            insurance_company: COMPANY_ID,
            insurance_type: TYPE_ID,
            deal: DEAL_ID,
            is_vehicle: true,
            status: 'active',
            created_at: '2026-06-17T00:00:00Z',
          },
          payments: [],
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      ),
    );
    vi.stubGlobal('fetch', fetchMock);

    await createPolicyDraft(
      buildPolicyDraftPayload({
        payments: [
          {
            id: PAYMENT_ID,
            amount: '3375.59',
            incomes: [{ id: INCOME_ID, amount: '3375.59' }],
            expenses: [{ id: EXPENSE_ID, amount: '100.00' }],
          },
        ],
      }),
    );

    const body = readDraftRequestBody(fetchMock);
    const [payment] = body.payments as Array<Record<string, unknown>>;
    const [income] = payment.incomes as Array<Record<string, unknown>>;
    const [expense] = payment.expenses as Array<Record<string, unknown>>;
    expect(payment.id).toBe(PAYMENT_ID);
    expect(income.id).toBe(INCOME_ID);
    expect(expense.id).toBe(EXPENSE_ID);
  });

  it.each([
    ['dealId', '16c3bcb8', 'Сделка: должен быть корректным UUID.'],
    ['insuranceCompanyId', 'РЕСО-ГАРАНТИЯ', 'Страховая компания: должен быть корректным UUID.'],
    ['insuranceTypeId', 'КАСКО', 'Тип страхования: должен быть корректным UUID.'],
  ] as const)(
    'rejects invalid %s before making a network request',
    async (field, value, message) => {
      const fetchMock = vi.fn();
      vi.stubGlobal('fetch', fetchMock);

      await expect(createPolicyDraft(buildPolicyDraftPayload({ [field]: value }))).rejects.toThrow(
        message,
      );
      expect(fetchMock).not.toHaveBeenCalled();
    },
  );

  const invalidOptionalIdCases: Array<
    [string, Partial<Parameters<typeof createPolicyDraft>[0]>, string]
  > = [
    [
      'payment id',
      { payments: [{ id: 'payment-temp-1', amount: '1', incomes: [], expenses: [] }] },
      'Платёж: должен быть корректным UUID.',
    ],
    [
      'financial record id',
      { payments: [{ amount: '1', incomes: [{ id: 'record-temp-1', amount: '1' }] }] },
      'Финансовая запись: должен быть корректным UUID.',
    ],
  ];

  it.each(invalidOptionalIdCases)(
    'rejects invalid non-empty %s before making a network request',
    async (_caseName, overrides, message) => {
      const fetchMock = vi.fn();
      vi.stubGlobal('fetch', fetchMock);

      await expect(createPolicyDraft(buildPolicyDraftPayload(overrides))).rejects.toThrow(message);
      expect(fetchMock).not.toHaveBeenCalled();
    },
  );
});
