import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { InsuranceRequestForm, type RequestLookups } from '../tabs/InsuranceRequestForm';
import { InsuranceRecordForm } from '../tabs/InsuranceRecordForm';
import { dataSchemas } from '../tabs/insuranceDataSchemas';
import { DealTabs } from '../DealTabs';
import { listInsuranceData, saveInsuranceData } from '../../../../api/insuranceData';

vi.mock('../../../../api/insuranceData', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../../../api/insuranceData')>()),
  listInsuranceData: vi.fn().mockResolvedValue([]),
  saveInsuranceData: vi.fn().mockResolvedValue({ id: 'saved' }),
}));

const lookups: RequestLookups = {
  people: [{ id: 'participant', client: 'person', client_name: 'Водитель' }],
  vehicles: [
    { id: 'car', title: 'Jaecoo J8' },
    { id: 'old-car', title: 'Неактуальная машина', is_current: false },
  ],
  mortgages: [{ id: 'mortgage', title: 'Квартира', bank_name: 'Сбер' }],
  companies: [{ id: 'company', name: 'РЕСО', createdAt: '', updatedAt: '' }],
  types: [
    { id: 'casco', name: 'КАСКО', createdAt: '', updatedAt: '' },
    { id: 'life', name: 'Жизнь', createdAt: '', updatedAt: '' },
  ],
  platforms: [{ id: 'platform', name: 'RESO Office' }],
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe('Insurance data forms', () => {
  it('keeps the driving experience date and multiple labeled scans', async () => {
    const save = vi.fn().mockResolvedValue(undefined);
    render(
      <InsuranceRecordForm
        fields={dataSchemas['driver-licenses']!}
        onSave={save}
        onCancel={vi.fn()}
      />,
    );
    fireEvent.change(screen.getByLabelText('Начало стажа (дата или год)'), {
      target: { value: '1986' },
    });
    fireEvent.click(screen.getByText('Добавить ссылку'));
    fireEvent.change(screen.getByLabelText('URL документа 1'), {
      target: { value: 'https://example.com/front.jpg' },
    });
    fireEvent.click(screen.getByText('Добавить ссылку'));
    fireEvent.change(screen.getByLabelText('URL документа 2'), {
      target: { value: 'https://example.com/back.jpg' },
    });
    fireEvent.change(screen.getByLabelText('Подпись ссылки 2'), { target: { value: 'Оборот' } });
    fireEvent.click(screen.getByText('Сохранить'));
    await waitFor(() =>
      expect(save).toHaveBeenCalledWith(
        expect.objectContaining({
          experience_start: '1986-12-31',
          source_links: [
            { label: '', url: 'https://example.com/front.jpg' },
            { label: 'Оборот', url: 'https://example.com/back.jpg' },
          ],
          is_current: true,
        }),
      ),
    );
  });

  it('saves CASCO directions, zero deductible and maximum value without inventing an amount', async () => {
    render(
      <InsuranceRequestForm
        dealId="deal"
        lookups={lookups}
        onSaved={vi.fn().mockResolvedValue(undefined)}
        onCancel={vi.fn()}
      />,
    );
    fireEvent.change(screen.getByLabelText(/Название заявки/), { target: { value: 'КАСКО 2026' } });
    fireEvent.change(screen.getByLabelText(/Вид страхования/), { target: { value: 'casco' } });
    fireEvent.change(screen.getByLabelText(/^Объект/), { target: { value: 'car' } });
    expect(screen.queryByRole('option', { name: 'Неактуальная машина' })).not.toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Страховщик 1'), { target: { value: 'company' } });
    fireEvent.change(screen.getByLabelText('Платформа 1'), { target: { value: 'platform' } });
    fireEvent.change(screen.getByLabelText(/Франшизы/), {
      target: { value: '0; 30000' },
    });
    fireEvent.click(screen.getByLabelText('Водитель'));
    fireEvent.click(screen.getByText('Сохранить заявку'));
    await waitFor(() =>
      expect(saveInsuranceData).toHaveBeenCalledWith(
        'requests',
        expect.objectContaining({
          deal: 'deal',
          vehicle: 'car',
          mortgage: null,
          drivers: ['person'],
          deductibles: ['0.00', '30000.00'],
          vehicle_value_mode: 'maximum',
          vehicle_value: null,
          targets: [{ insurance_company: 'company', platform: 'platform' }],
        }),
        undefined,
      ),
    );
  });

  it('removes vehicle-specific roles when switching to mortgage and loads debt history', async () => {
    vi.mocked(listInsuranceData).mockResolvedValue([
      { id: 'balance', amount: '1000000', as_of_date: '2026-09-26' },
    ]);
    render(
      <InsuranceRequestForm
        dealId="deal"
        lookups={lookups}
        onSaved={vi.fn().mockResolvedValue(undefined)}
        onCancel={vi.fn()}
      />,
    );
    fireEvent.change(screen.getByLabelText(/Название заявки/), { target: { value: 'Ипотека' } });
    fireEvent.change(screen.getByLabelText(/Вид страхования/), { target: { value: 'life' } });
    fireEvent.change(screen.getByLabelText('Тип объекта'), { target: { value: 'mortgage' } });
    fireEvent.change(screen.getByLabelText(/^Объект/), { target: { value: 'mortgage' } });
    await screen.findByRole('option', { name: /1000000 ₽/ });
    fireEvent.change(screen.getByLabelText('Остаток задолженности'), {
      target: { value: 'balance' },
    });
    fireEvent.change(screen.getByLabelText('Страховщик 1'), { target: { value: 'company' } });
    fireEvent.change(screen.getByLabelText('Платформа 1'), { target: { value: 'platform' } });
    expect(screen.queryByLabelText('Водитель')).not.toBeInTheDocument();
    fireEvent.click(screen.getByText('Сохранить заявку'));
    await waitFor(() =>
      expect(saveInsuranceData).toHaveBeenCalledWith(
        'requests',
        expect.objectContaining({
          mortgage: 'mortgage',
          vehicle: null,
          mortgage_balance: 'balance',
          deductibles: [],
          official_dealer: null,
          drivers: [],
        }),
        undefined,
      ),
    );
  });

  it('supports keyboard navigation through the data subtabs', () => {
    const change = vi.fn();
    render(<DealTabs activeTab="data_people" onChange={change} />);
    const people = screen.getByRole('tab', { name: 'Люди' });
    fireEvent.keyDown(people, { key: 'ArrowRight' });
    expect(change).toHaveBeenCalledWith('data_vehicles');
    expect(screen.getByRole('tab', { name: 'Машины' })).toHaveFocus();
    fireEvent.keyDown(people, { key: 'End' });
    expect(change).toHaveBeenLastCalledWith('data_mortgages');
    expect(screen.getByRole('tab', { name: 'Ипотека' })).toHaveFocus();
  });
});
