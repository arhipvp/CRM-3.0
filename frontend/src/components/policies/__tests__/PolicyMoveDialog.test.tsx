import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ComponentProps } from 'react';
import { describe, expect, it, vi } from 'vitest';

import type { Deal, Policy } from '../../../types';
import { PolicyMoveDialog } from '../PolicyMoveDialog';

const basePolicy: Policy = {
  id: 'policy-1',
  number: 'SYS2828116080',
  insuranceCompanyId: 'company-1',
  insuranceCompany: 'РЕСО-ГАРАНТИЯ',
  insuranceTypeId: 'type-1',
  insuranceType: 'Квартиры',
  dealId: 'deal-current',
  isVehicle: false,
  status: 'active',
  createdAt: '2026-05-01T00:00:00Z',
};

function createDeal(overrides: Partial<Deal>): Deal {
  return {
    id: 'deal-1',
    title: 'Ипотека',
    clientId: 'client-1',
    clientName: 'Солнцева Елена Васильевна',
    status: 'open',
    stageName: 'Новая',
    createdAt: '2026-05-01T00:00:00Z',
    quotes: [],
    documents: [],
    sellerName: 'Иванов Иван',
    executorName: 'Петров Петр',
    ...overrides,
  };
}

function renderDialog(props: Partial<ComponentProps<typeof PolicyMoveDialog>> = {}) {
  const onConfirm = vi.fn().mockResolvedValue(undefined);
  const onCancel = vi.fn();
  render(
    <PolicyMoveDialog
      policy={basePolicy}
      deals={[
        createDeal({ id: 'deal-current', title: 'Текущая сделка' }),
        createDeal({
          id: 'deal-deleted',
          title: 'Удаленная сделка',
          deletedAt: '2026-05-02T00:00:00Z',
        }),
        createDeal({
          id: 'deal-mortgage',
          title: 'Ипотека',
          clientName: 'Солнцева Елена Васильевна',
          sellerName: 'Сидоров Дмитрий',
        }),
        createDeal({
          id: 'deal-flat',
          title: 'Квартира Алтуфьевское 60',
          clientName: 'Васильева Марина Васильевна',
          executorName: 'Кетов Алексей',
          stageName: 'Оформление',
        }),
        createDeal({
          id: 'deal-car',
          title: 'Volkswagen Tiguan',
          clientName: 'Солнцева Виктория Андреевна',
          sellerName: 'Орлова Ольга',
        }),
      ]}
      isOpen
      onCancel={onCancel}
      onConfirm={onConfirm}
      {...props}
    />,
  );
  return { onConfirm, onCancel };
}

describe('PolicyMoveDialog', () => {
  it('shows available deals and excludes current or deleted deals', () => {
    renderDialog();

    expect(screen.getByText('SYS2828116080')).toBeInTheDocument();
    expect(screen.queryByText('Текущая сделка')).not.toBeInTheDocument();
    expect(screen.queryByText('Удаленная сделка')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Ипотека/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Volkswagen Tiguan/i })).toBeInTheDocument();
  });

  it('filters deals by title, client, seller, executor and stage', async () => {
    const user = userEvent.setup();
    renderDialog();

    const search = screen.getByPlaceholderText('Найти сделку по названию, клиенту или продавцу...');

    await user.type(search, 'Кетов');
    expect(screen.getByRole('button', { name: /Квартира Алтуфьевское 60/i })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Volkswagen Tiguan/i })).not.toBeInTheDocument();

    await user.clear(search);
    await user.type(search, 'Виктория');
    expect(screen.getByRole('button', { name: /Volkswagen Tiguan/i })).toBeInTheDocument();

    await user.clear(search);
    await user.type(search, 'Оформление');
    expect(screen.getByRole('button', { name: /Квартира Алтуфьевское 60/i })).toBeInTheDocument();

    await user.clear(search);
    await user.type(search, 'Сидоров');
    expect(screen.getByRole('button', { name: /Ипотека/i })).toBeInTheDocument();
  });

  it('shows an empty search state', async () => {
    const user = userEvent.setup();
    renderDialog();

    await user.type(
      screen.getByPlaceholderText('Найти сделку по названию, клиенту или продавцу...'),
      'нет такой сделки',
    );

    expect(screen.getByText('Ничего не найдено')).toBeInTheDocument();
  });

  it('confirms selected deal only after row selection', async () => {
    const user = userEvent.setup();
    const { onConfirm } = renderDialog();
    const confirmButton = screen.getByRole('button', { name: 'Перенести' });

    expect(confirmButton).toBeDisabled();

    await user.click(screen.getByRole('button', { name: /Volkswagen Tiguan/i }));
    expect(confirmButton).toBeEnabled();

    await user.click(confirmButton);

    expect(onConfirm).toHaveBeenCalledWith('policy-1', 'deal-car');
  });

  it('disables actions while submitting', () => {
    renderDialog({ isSubmitting: true });

    expect(
      screen.getByPlaceholderText('Найти сделку по названию, клиенту или продавцу...'),
    ).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Перенос...' })).toBeDisabled();
    expect(screen.getByRole('button', { name: /Ипотека/i })).toBeDisabled();
  });

  it('shows no available deals state', () => {
    renderDialog({
      deals: [
        createDeal({ id: 'deal-current', title: 'Текущая сделка' }),
        createDeal({
          id: 'deal-deleted',
          title: 'Удаленная сделка',
          deletedAt: '2026-05-02T00:00:00Z',
        }),
      ],
    });

    const dialog = screen.getByRole('dialog');
    expect(within(dialog).getByText('Нет доступных сделок для переноса')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Перенести' })).toBeDisabled();
  });
});
