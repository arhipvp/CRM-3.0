import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { Payment, Policy } from '../../../types';
import { NotificationProvider } from '../../../contexts/NotificationProvider';
import { PoliciesView } from '../PoliciesView';
import { fetchPoliciesKPI } from '../../../api';

vi.mock('../../../api', async () => {
  const actual = await vi.importActual<typeof import('../../../api')>('../../../api');
  return {
    ...actual,
    fetchPoliciesKPI: vi.fn(async () => ({
      total: 1,
      problemCount: 1,
      dueCount: 0,
      expiringSoonCount: 0,
      expiringDays: 30,
    })),
  };
});

const buildPolicy = (overrides: Partial<Policy> = {}): Policy => ({
  id: overrides.id ?? 'policy-1',
  number: overrides.number ?? 'POL-1',
  dealId: overrides.dealId ?? 'deal-1',
  insuranceCompany: overrides.insuranceCompany ?? 'Alpha',
  insuranceCompanyId: overrides.insuranceCompanyId ?? 'company-1',
  insuranceType: overrides.insuranceType ?? 'OSAGO',
  insuranceTypeId: overrides.insuranceTypeId ?? 'type-1',
  isVehicle: overrides.isVehicle ?? false,
  brand: overrides.brand ?? 'Brand',
  model: overrides.model ?? 'Model',
  vin: overrides.vin ?? 'VIN1',
  status: overrides.status ?? 'active',
  computedStatus: overrides.computedStatus ?? 'problem',
  startDate: overrides.startDate ?? '2025-01-01',
  endDate: overrides.endDate ?? '2025-12-31',
  createdAt: overrides.createdAt ?? new Date().toISOString(),
  updatedAt: overrides.updatedAt ?? new Date().toISOString(),
  paymentsPaid: overrides.paymentsPaid ?? '100',
  paymentsTotal: overrides.paymentsTotal ?? '300',
  counterparty: overrides.counterparty ?? '',
  clientId: overrides.clientId ?? 'client-1',
  clientName: overrides.clientName ?? 'Client',
  driveFolderId: overrides.driveFolderId ?? null,
  note: overrides.note ?? '',
});

const buildPayment = (overrides: Partial<Payment> = {}): Payment => ({
  id: overrides.id ?? 'payment-1',
  policyId: overrides.policyId ?? 'policy-1',
  amount: overrides.amount ?? '100',
  description: overrides.description,
  note: overrides.note,
  scheduledDate: overrides.scheduledDate ?? null,
  actualDate: overrides.actualDate ?? null,
  financialRecords: overrides.financialRecords,
  createdAt: overrides.createdAt ?? new Date().toISOString(),
  updatedAt: overrides.updatedAt ?? new Date().toISOString(),
});

describe('PoliciesView', () => {
  beforeEach(() => {
    vi.mocked(fetchPoliciesKPI).mockClear();
  });

  it('renders compact table row with note preview and readable problem status', async () => {
    const longNote =
      'Длинное примечание к полису с уточнением по клиенту и деталями по продлению на следующий период.';

    render(
      <MemoryRouter>
        <NotificationProvider>
          <PoliciesView
            policies={[buildPolicy({ note: longNote, computedStatus: 'problem' })]}
            payments={[buildPayment()]}
            onRequestEditPolicy={vi.fn()}
          />
        </NotificationProvider>
      </MemoryRouter>,
    );

    expect(screen.getByText('Статус')).toBeInTheDocument();
    expect(screen.getByText('Примечание')).toBeInTheDocument();

    const statusBadge = screen.getByTitle(
      'Есть финансовые записи без даты оплаты по платежам полиса',
    );
    expect(statusBadge).toHaveTextContent('Есть неоплаченные записи');

    const notePreview = screen.getByText(longNote);
    expect(notePreview).toHaveAttribute('title', longNote);
    expect(notePreview.className).toContain('-webkit-line-clamp:2');

    expect(screen.queryByText('Основное')).toBeNull();
    expect(screen.queryByText('Сроки')).toBeNull();
    expect(screen.queryByText('Финансы')).toBeNull();

    await waitFor(() => {
      expect(fetchPoliciesKPI).toHaveBeenCalled();
    });
  });

  it('keeps KPI refresh and filter wiring for computed status', async () => {
    const onRefreshPoliciesList = vi.fn().mockResolvedValue(undefined);

    render(
      <MemoryRouter>
        <NotificationProvider>
          <PoliciesView
            policies={[buildPolicy({ computedStatus: 'active' })]}
            payments={[buildPayment({ actualDate: '2025-01-01' })]}
            onRequestEditPolicy={vi.fn()}
            onRefreshPoliciesList={onRefreshPoliciesList}
          />
        </NotificationProvider>
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(fetchPoliciesKPI).toHaveBeenCalled();
      expect(onRefreshPoliciesList).toHaveBeenCalled();
    });

    fireEvent.change(screen.getByLabelText('Вычисляемый статус'), {
      target: { value: 'problem' },
    });

    await waitFor(() => {
      expect(onRefreshPoliciesList).toHaveBeenLastCalledWith(
        expect.objectContaining({ computed_status: 'problem' }),
      );
    });
  });

  it('shows empty state when no policies', async () => {
    render(
      <MemoryRouter>
        <NotificationProvider>
          <PoliciesView policies={[]} payments={[]} onRequestEditPolicy={vi.fn()} />
        </NotificationProvider>
      </MemoryRouter>,
    );

    expect(screen.getByText('Нет полисов для отображения')).toBeInTheDocument();
    await waitFor(() => {
      expect(fetchPoliciesKPI).toHaveBeenCalled();
    });
  });
});
