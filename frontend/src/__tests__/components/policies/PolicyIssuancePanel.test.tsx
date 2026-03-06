import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { vi } from 'vitest';

import {
  cancelPolicyIssuance,
  fetchPolicyIssuanceStatus,
  resumePolicyIssuance,
  startPolicyIssuance,
} from '../../../api';
import { PolicyIssuancePanel } from '../../../components/policies/PolicyIssuancePanel';
import type { Policy, PolicyIssuanceStatus } from '../../../types';

vi.mock('../../../api', () => ({
  cancelPolicyIssuance: vi.fn(),
  fetchPolicyIssuanceStatus: vi.fn(),
  resumePolicyIssuance: vi.fn(),
  startPolicyIssuance: vi.fn(),
}));

const basePolicy = (): Policy => ({
  id: 'policy-1',
  number: 'AAA-111',
  insuranceCompanyId: 'company-1',
  insuranceCompany: 'Сбер',
  insuranceTypeId: 'type-1',
  insuranceType: 'ОСАГО',
  dealId: 'deal-1',
  clientName: 'Иван Иванов',
  isVehicle: true,
  brand: 'BMW',
  model: 'X5',
  vin: 'WBA12345678901234',
  status: 'active',
  createdAt: '2026-03-06T10:00:00Z',
  sberIssuance: null,
});

const issuance = (status: PolicyIssuanceStatus['status']): PolicyIssuanceStatus => ({
  id: 'exec-1',
  provider: 'sber',
  product: 'osago_auto',
  status,
  step: 'manual_login',
  manualStepReason: status === 'waiting_manual' ? 'Нужен SMS-код.' : undefined,
  manualStepInstructions: status === 'waiting_manual' ? 'Подтвердите вход.' : undefined,
  externalPolicyNumber: status === 'succeeded' ? 'OSAGO-999' : undefined,
  lastError: status === 'failed' ? 'Ошибка runner.' : undefined,
  startedAt: '2026-03-06T10:00:00Z',
  finishedAt: status === 'succeeded' ? '2026-03-06T10:05:00Z' : null,
  updatedAt: '2026-03-06T10:01:00Z',
  createdAt: '2026-03-06T10:00:00Z',
  vncHint: 'crm-vnc:5901',
  log: [
    {
      timestamp: '2026-03-06T10:01:00Z',
      level: 'info',
      step: 'manual_login',
      message: 'Ждём оператора.',
    },
  ],
});

describe('PolicyIssuancePanel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('starts issuance when there is no execution yet', async () => {
    vi.mocked(startPolicyIssuance).mockResolvedValue(issuance('running'));

    render(<PolicyIssuancePanel policy={basePolicy()} />);

    fireEvent.click(screen.getByRole('button', { name: 'Запустить' }));

    await waitFor(() => {
      expect(startPolicyIssuance).toHaveBeenCalledWith('policy-1');
    });
    expect(await screen.findByText('В работе')).toBeInTheDocument();
  });

  it('shows resume and cancel actions for waiting_manual', async () => {
    vi.mocked(resumePolicyIssuance).mockResolvedValue(issuance('running'));
    vi.mocked(cancelPolicyIssuance).mockResolvedValue(issuance('canceled'));

    render(
      <PolicyIssuancePanel
        policy={{ ...basePolicy(), sberIssuance: issuance('waiting_manual') }}
      />,
    );

    expect(screen.getByText('Ждёт оператора')).toBeInTheDocument();
    expect(screen.getByText('Нужен SMS-код.')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Продолжить' }));
    await waitFor(() => {
      expect(resumePolicyIssuance).toHaveBeenCalledWith('policy-1');
    });
  });

  it('refreshes terminal status manually', async () => {
    vi.mocked(fetchPolicyIssuanceStatus).mockResolvedValue(issuance('succeeded'));

    render(<PolicyIssuancePanel policy={{ ...basePolicy(), sberIssuance: issuance('failed') }} />);

    fireEvent.click(screen.getByRole('button', { name: 'Обновить' }));

    await waitFor(() => {
      expect(fetchPolicyIssuanceStatus).toHaveBeenCalledWith('policy-1');
    });
    expect(await screen.findByText(/Номер полиса: OSAGO-999/)).toBeInTheDocument();
  });
});
