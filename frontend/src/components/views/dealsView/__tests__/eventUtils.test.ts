import { describe, expect, it } from 'vitest';
import { buildDealEvents, buildEventWindow } from '../eventUtils';
import type { Policy, Payment } from '../../../../types';

describe('eventUtils', () => {
  const samplePolicy: Policy = {
    id: 'policy-1',
    number: '08025/046/020146/25',
    insuranceCompanyId: 'ic-1',
    insuranceCompany: 'АльфаСтрахование',
    insuranceTypeId: 'it-1',
    insuranceType: 'ОСАГО',
    dealId: 'deal-1',
    status: 'active',
    salesChannelId: 'channel-1',
    salesChannelName: 'ОСАГО Руль',
    isVehicle: true,
    startDate: '2025-11-25',
    endDate: '2026-11-23',
    createdAt: new Date().toISOString(),
  };

  const samplePayment: Payment = {
    id: 'payment-1',
    dealId: 'deal-1',
    dealTitle: 'Тестовая сделка',
    amount: '1200',
    policyId: samplePolicy.id,
    policyNumber: samplePolicy.number,
    description: 'Очередной платёж',
    scheduledDate: '2026-11-23',
    actualDate: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  it('keeps policy descriptions readable', () => {
    const events = buildDealEvents({ policies: [samplePolicy], payments: [] });
    expect(events).toHaveLength(1);
    expect(events[0].description).toContain('Полис 08025/046/020146/25');
    expect(events[0].description).toContain('АльфаСтрахование');
    expect(events[0].title).toBe('Окончание полиса');
  });

  it('normalizes payment amounts and suggests the next contact', () => {
    const events = buildDealEvents({ policies: [], payments: [samplePayment] });
    const window = buildEventWindow(events, { today: new Date('2026-10-01') });
    expect(window.upcomingEvents).toHaveLength(1);
    expect(window.nextEvent).not.toBeNull();
    expect(window.nextEvent?.title).toBe('Очередной платёж');
    expect(window.nextEvent?.description).toContain('Сумма');
    expect(window.suggestedNextContactInput).toBe('2026-10-24');
  });
});
