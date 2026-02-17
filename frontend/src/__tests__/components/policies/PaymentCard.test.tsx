import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import type { Payment } from '../../../types';
import { PaymentCard } from '../../../components/policies/PaymentCard';

const buildPayment = (overrides: Partial<Payment> = {}): Payment => ({
  id: overrides.id ?? 'payment-1',
  amount: overrides.amount ?? '1200',
  description: overrides.description ?? 'Тестовый платёж',
  note: overrides.note,
  scheduledDate: overrides.scheduledDate ?? '2026-01-10',
  actualDate: overrides.actualDate ?? null,
  financialRecords: overrides.financialRecords ?? [],
  createdAt: overrides.createdAt ?? new Date().toISOString(),
  updatedAt: overrides.updatedAt ?? new Date().toISOString(),
  canDelete: overrides.canDelete,
});

describe('PaymentCard table-row variant', () => {
  it('renders summary columns and expands records details', async () => {
    const onRequestAddRecord = vi.fn();
    const onEditFinancialRecord = vi.fn();
    const onDeleteFinancialRecord = vi.fn().mockResolvedValue(undefined);
    const onDeletePayment = vi.fn().mockResolvedValue(undefined);

    render(
      <table>
        <tbody>
          <PaymentCard
            payment={buildPayment({
              financialRecords: [
                {
                  id: 'income-1',
                  paymentId: 'payment-1',
                  amount: '400',
                  recordType: 'Доход',
                  date: '2026-01-12',
                  note: 'Комиссия',
                  createdAt: new Date().toISOString(),
                  updatedAt: new Date().toISOString(),
                },
                {
                  id: 'expense-1',
                  paymentId: 'payment-1',
                  amount: '-100',
                  recordType: 'Расход',
                  date: null,
                  note: 'Лид',
                  createdAt: new Date().toISOString(),
                  updatedAt: new Date().toISOString(),
                },
              ],
            })}
            onRequestAddRecord={onRequestAddRecord}
            onEditFinancialRecord={onEditFinancialRecord}
            onDeleteFinancialRecord={onDeleteFinancialRecord}
            onDeletePayment={onDeletePayment}
            variant="table-row"
          />
        </tbody>
      </table>,
    );

    expect(screen.getByText(/1\s*200,00\s*₽/)).toBeInTheDocument();
    expect(screen.getByText('Тестовый платёж')).toBeInTheDocument();
    expect(screen.getByText('не оплачено')).toBeInTheDocument();

    const detailButtons = screen.getAllByRole('button', { name: 'Подробнее' });
    fireEvent.click(detailButtons[0]);

    expect(screen.getByText('Комиссия')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Изменить' }));
    expect(onEditFinancialRecord).toHaveBeenCalledWith('income-1');

    fireEvent.click(screen.getByTitle('Удалить платёж'));
    expect(onDeletePayment).toHaveBeenCalledWith('payment-1');
  });

  it('hides actions column content when hideRowActions is enabled', () => {
    const onRequestAddRecord = vi.fn();
    const onEditFinancialRecord = vi.fn();
    const onDeleteFinancialRecord = vi.fn().mockResolvedValue(undefined);
    const onDeletePayment = vi.fn().mockResolvedValue(undefined);

    render(
      <table>
        <tbody>
          <PaymentCard
            payment={buildPayment({
              financialRecords: [
                {
                  id: 'income-hidden',
                  paymentId: 'payment-1',
                  amount: '300',
                  recordType: 'Доход',
                  date: '2026-01-12',
                  note: 'Доход',
                  createdAt: new Date().toISOString(),
                  updatedAt: new Date().toISOString(),
                },
              ],
            })}
            onRequestAddRecord={onRequestAddRecord}
            onEditFinancialRecord={onEditFinancialRecord}
            onDeleteFinancialRecord={onDeleteFinancialRecord}
            onDeletePayment={onDeletePayment}
            variant="table-row"
            hideRowActions
          />
        </tbody>
      </table>,
    );

    expect(screen.queryByTitle('Удалить платёж')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Изменить' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Подробнее' }));
    const detailsCell = screen.getByText('Доходы').closest('td');
    expect(detailsCell?.getAttribute('colspan')).toBe('6');
  });
});
