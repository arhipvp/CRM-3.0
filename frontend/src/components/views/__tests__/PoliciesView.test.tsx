import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { act } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { Payment, Policy } from '../../../types';
import { NotificationProvider } from '../../../contexts/NotificationProvider';
import { PoliciesView } from '../PoliciesView';
import { fetchPoliciesKPI } from '../../../api';
import { fetchPolicyDriveFiles } from '../../../api/drive';

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

vi.mock('../../../api/drive', () => ({
  fetchPolicyDriveFiles: vi.fn(),
}));

const buildPolicy = (overrides: Partial<Policy> = {}): Policy => ({
  id: overrides.id ?? 'policy-1',
  number: overrides.number ?? 'POL-1',
  dealId: overrides.dealId ?? 'deal-1',
  dealTitle: overrides.dealTitle ?? 'Сделка #1',
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
  salesChannel: overrides.salesChannel ?? '',
  driveFolderId: overrides.driveFolderId ?? 'drive-folder-1',
  note: overrides.note ?? '',
  isRenewed: overrides.isRenewed ?? false,
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

const buildDriveFile = (overrides: Partial<import('../../../types').DriveFile> = {}) => ({
  id: overrides.id ?? 'file-1',
  name: overrides.name ?? 'Полис.pdf',
  mimeType: overrides.mimeType ?? 'application/pdf',
  isFolder: overrides.isFolder ?? false,
  webViewLink: overrides.webViewLink ?? 'https://drive.google.com/file-1',
  ...overrides,
});

const deferred = <T,>() => {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((res) => {
    resolve = res;
  });
  return { promise, resolve };
};

describe('PoliciesView', () => {
  beforeEach(() => {
    vi.mocked(fetchPoliciesKPI).mockClear();
    vi.mocked(fetchPolicyDriveFiles).mockReset();
    vi.mocked(fetchPolicyDriveFiles).mockResolvedValue({ files: [], folderId: null });
  });

  it('loads and opens a policy client that is outside the reference page', async () => {
    const openClient = vi.fn().mockResolvedValue(undefined);
    render(
      <MemoryRouter>
        <NotificationProvider>
          <PoliciesView
            policies={[
              buildPolicy({ clientId: 'client-outside-page', clientName: 'Внешний клиент' }),
            ]}
            payments={[]}
            clients={[]}
            onClientOpenById={openClient}
          />
        </NotificationProvider>
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Внешний клиент' }));

    await waitFor(() => expect(openClient).toHaveBeenCalledWith('client-outside-page'));
  });

  it('renders direct policy files and folders as safe Drive links below the policy number', async () => {
    const longFileName = 'Договор страхования с дополнительными условиями и приложениями.pdf';
    vi.mocked(fetchPolicyDriveFiles).mockResolvedValue({
      files: [
        buildDriveFile({ name: longFileName }),
        buildDriveFile({
          id: 'folder-1',
          name: 'Дополнительные документы',
          mimeType: 'application/vnd.google-apps.folder',
          isFolder: true,
          webViewLink: 'https://drive.google.com/folder-1',
        }),
      ],
      folderId: 'policy-folder-1',
    });

    render(
      <MemoryRouter>
        <NotificationProvider>
          <PoliciesView
            policies={[buildPolicy({ driveFolderId: 'policy-folder-1' })]}
            payments={[]}
            onRequestEditPolicy={vi.fn()}
          />
        </NotificationProvider>
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Показать документы' }));
    await waitFor(() => {
      expect(fetchPolicyDriveFiles).toHaveBeenCalledWith('policy-1');
    });

    const fileLink = await screen.findByRole('link', { name: longFileName });
    expect(fileLink).toHaveAttribute('href', 'https://drive.google.com/file-1');
    expect(fileLink).toHaveAttribute('target', '_blank');
    expect(fileLink).toHaveAttribute('rel', 'noopener noreferrer');
    expect(fileLink).toHaveAttribute('title', longFileName);
    expect(fileLink).toHaveClass('inline-flex', 'max-w-[8.5rem]', 'rounded-md');
    expect(screen.getByTestId('policy-documents-list')).toHaveClass('flex', 'flex-wrap', 'gap-1');
    expect(fileLink.closest('td')).toHaveTextContent('POL-1');

    const folderLink = screen.getByRole('link', { name: 'Дополнительные документы' });
    expect(folderLink).toHaveAttribute('href', 'https://drive.google.com/folder-1');
    expect(folderLink).toHaveAttribute('target', '_blank');
    expect(folderLink).toHaveAttribute('rel', 'noopener noreferrer');
    expect(folderLink).toHaveAttribute('title', 'Дополнительные документы');
  });

  it('shows an empty or failed document state only for the affected policy', async () => {
    vi.mocked(fetchPolicyDriveFiles)
      .mockResolvedValueOnce({ files: [], folderId: 'policy-folder-1' })
      .mockRejectedValueOnce(new Error('Drive временно недоступен'));

    render(
      <MemoryRouter>
        <NotificationProvider>
          <PoliciesView
            policies={[
              buildPolicy({ driveFolderId: 'policy-folder-1' }),
              buildPolicy({
                id: 'policy-2',
                number: 'POL-2',
                driveFolderId: 'policy-folder-2',
              }),
            ]}
            payments={[]}
            onRequestEditPolicy={vi.fn()}
          />
        </NotificationProvider>
      </MemoryRouter>,
    );

    screen
      .getAllByRole('button', { name: 'Показать документы' })
      .forEach((button) => fireEvent.click(button));
    expect(await screen.findByText('Нет документов')).toBeInTheDocument();
    expect(screen.getByText('Не удалось загрузить документы')).toBeInTheDocument();
    expect(screen.getByText('POL-1').closest('td')).toHaveTextContent('Нет документов');
    expect(screen.getByText('POL-2').closest('td')).toHaveTextContent(
      'Не удалось загрузить документы',
    );
  });

  it('does not load policy documents before an explicit request', async () => {
    const pending = new Map<string, () => void>();
    let activeRequests = 0;
    let maxActiveRequests = 0;
    vi.mocked(fetchPolicyDriveFiles).mockImplementation(
      (policyId) =>
        new Promise((resolve) => {
          activeRequests += 1;
          maxActiveRequests = Math.max(maxActiveRequests, activeRequests);
          pending.set(policyId, () => {
            activeRequests -= 1;
            resolve({ files: [], folderId: null });
          });
        }),
    );
    const policies = Array.from({ length: 5 }, (_, index) =>
      buildPolicy({
        id: `policy-${index + 1}`,
        number: `POL-${index + 1}`,
        driveFolderId: `policy-folder-${index + 1}`,
      }),
    );

    const { rerender } = render(
      <MemoryRouter>
        <NotificationProvider>
          <PoliciesView policies={policies} payments={[]} onRequestEditPolicy={vi.fn()} />
        </NotificationProvider>
      </MemoryRouter>,
    );

    expect(fetchPolicyDriveFiles).not.toHaveBeenCalled();
    fireEvent.click(screen.getAllByRole('button', { name: 'Показать документы' })[0]);
    expect(fetchPolicyDriveFiles).toHaveBeenCalledTimes(1);
    expect(maxActiveRequests).toBe(1);

    await act(async () => {
      pending.get('policy-1')?.();
    });
    rerender(
      <MemoryRouter>
        <NotificationProvider>
          <PoliciesView policies={policies} payments={[]} onRequestEditPolicy={vi.fn()} />
        </NotificationProvider>
      </MemoryRouter>,
    );

    expect(screen.getByText('Нет документов')).toBeInTheDocument();
    expect(fetchPolicyDriveFiles).toHaveBeenCalledTimes(1);
  });

  it('renders compact policy meta, scheduled payment date and deal preview link', async () => {
    const onDealPreview = vi.fn();
    render(
      <MemoryRouter>
        <NotificationProvider>
          <PoliciesView
            policies={[
              buildPolicy({
                note: 'Длинное примечание',
                computedStatus: 'problem',
                salesChannel: 'Перебоева',
              }),
            ]}
            payments={[
              buildPayment({
                id: 'payment-paid',
                amount: '3000',
                scheduledDate: '2025-02-25',
                actualDate: '2025-01-02',
                note: 'Оплата наличными',
                financialRecords: [
                  {
                    id: 'record-paid',
                    paymentId: 'payment-paid',
                    amount: '200',
                    recordType: 'Доход',
                    note: 'Чаевые',
                    date: '2025-01-03',
                    createdAt: new Date().toISOString(),
                    updatedAt: new Date().toISOString(),
                  },
                ],
              }),
              buildPayment({
                id: 'payment-unpaid',
                amount: '5000',
                scheduledDate: null,
                actualDate: null,
                financialRecords: [
                  {
                    id: 'record-unpaid',
                    paymentId: 'payment-unpaid',
                    amount: '-50',
                    recordType: 'Расход',
                    note: '',
                    date: null,
                    createdAt: new Date().toISOString(),
                    updatedAt: new Date().toISOString(),
                  },
                ],
              }),
            ]}
            onRequestEditPolicy={vi.fn()}
            onDealPreview={onDealPreview}
          />
        </NotificationProvider>
      </MemoryRouter>,
    );

    expect(screen.getByText('Номер полиса')).toBeInTheDocument();
    expect(screen.getByText('Основные данные')).toBeInTheDocument();
    expect(screen.getByText('Платеж')).toBeInTheDocument();
    expect(screen.getByText('Финансовые записи')).toBeInTheDocument();
    expect(screen.queryByText('Оплачено / План')).toBeNull();
    expect(screen.getByText('Начало').className).toContain('w-[8%]');
    expect(screen.getByText('Конец').className).toContain('w-[8%]');
    const policiesTable = screen.getByRole('table', { name: 'Список полисов' });
    expect(policiesTable).not.toHaveClass('min-w-[1900px]');
    expect(policiesTable).toHaveClass('min-w-[1100px]', 'xl:min-w-0');

    const statusBadge = screen.getByTitle(
      'Есть финансовые записи без даты оплаты по платежам полиса',
    );
    expect(statusBadge).toHaveTextContent('Есть неоплаченные записи');

    const numberCell = screen.getByText('POL-1').closest('td');
    expect(numberCell).not.toBeNull();
    expect(numberCell?.getAttribute('rowspan')).toBe('2');

    const paidPaymentRow = screen.getByTitle(
      (title) => title.includes('25.02.2025') && title.includes('3'),
    );
    const unpaidPaymentRow = screen.getByTitle(
      (title) => title.includes('без плановой даты') && title.includes('₽'),
    );
    expect(paidPaymentRow.className).toContain('bg-emerald-50');
    expect(unpaidPaymentRow.className).toContain('bg-rose-50');

    const paidRecordRow = screen.getByTitle(
      (title) => title.includes('03.01.2025') && title.includes('Чаевые'),
    );
    const unpaidRecordRow = screen.getByTitle(
      (title) => title.includes('без даты выплаты') && title.includes('Без комментария'),
    );
    expect(paidRecordRow.className).toContain('bg-emerald-50');
    expect(unpaidRecordRow.className).toContain('bg-rose-50');
    expect(screen.getByTitle('Alpha, OSAGO, Перебоева')).toBeInTheDocument();
    const companyMeta = screen.getByText('Alpha').closest('p');
    expect(companyMeta?.querySelector('span.rounded-full')).not.toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'Сделка #1' }));
    expect(onDealPreview).toHaveBeenCalledWith('deal-1');

    await waitFor(() => {
      expect(fetchPoliciesKPI).toHaveBeenCalled();
    });
  }, 10000);

  it('shows renewed badge with tooltip in the policies list', async () => {
    render(
      <MemoryRouter>
        <NotificationProvider>
          <PoliciesView
            policies={[
              buildPolicy({
                isRenewed: true,
              }),
            ]}
            payments={[]}
            onRequestEditPolicy={vi.fn()}
          />
        </NotificationProvider>
      </MemoryRouter>,
    );

    expect(screen.getByText('Продлён')).toHaveAttribute('title', 'Полис отмечен как продлённый');
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

    expect(screen.getByText('Полисов по текущим условиям нет')).toBeInTheDocument();
    await waitFor(() => {
      expect(fetchPoliciesKPI).toHaveBeenCalled();
    });
  });

  it('ignores stale KPI responses after filters change', async () => {
    const firstRequest = deferred<{
      total: number;
      problemCount: number;
      dueCount: number;
      expiringSoonCount: number;
      expiringDays: number;
    }>();
    const secondRequest = deferred<{
      total: number;
      problemCount: number;
      dueCount: number;
      expiringSoonCount: number;
      expiringDays: number;
    }>();

    vi.mocked(fetchPoliciesKPI)
      .mockReturnValueOnce(firstRequest.promise as never)
      .mockReturnValueOnce(secondRequest.promise as never);

    render(
      <MemoryRouter>
        <NotificationProvider>
          <PoliciesView
            policies={[buildPolicy({ computedStatus: 'active' })]}
            payments={[buildPayment({ actualDate: '2025-01-01' })]}
            onRequestEditPolicy={vi.fn()}
            onRefreshPoliciesList={vi.fn().mockResolvedValue(undefined)}
          />
        </NotificationProvider>
      </MemoryRouter>,
    );

    fireEvent.change(screen.getByLabelText('Вычисляемый статус'), {
      target: { value: 'problem' },
    });

    await act(async () => {
      secondRequest.resolve({
        total: 20,
        problemCount: 7,
        dueCount: 3,
        expiringSoonCount: 1,
        expiringDays: 30,
      });
      await secondRequest.promise;
    });

    await waitFor(() => {
      expect(screen.getByText('Всего').parentElement).toHaveTextContent('20');
    });

    await act(async () => {
      firstRequest.resolve({
        total: 5,
        problemCount: 1,
        dueCount: 0,
        expiringSoonCount: 0,
        expiringDays: 30,
      });
      await firstRequest.promise;
    });

    expect(screen.getByText('Всего').parentElement).toHaveTextContent('20');
  });

  it('shows list error and retry action', async () => {
    const onRefreshPoliciesList = vi
      .fn()
      .mockRejectedValueOnce(new Error('Список временно недоступен'))
      .mockResolvedValueOnce(undefined);

    render(
      <MemoryRouter>
        <NotificationProvider>
          <PoliciesView
            policies={[]}
            payments={[]}
            onRequestEditPolicy={vi.fn()}
            onRefreshPoliciesList={onRefreshPoliciesList}
          />
        </NotificationProvider>
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByText('Список временно недоступен')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: 'Повторить' }));

    await waitFor(() => {
      expect(onRefreshPoliciesList).toHaveBeenCalledTimes(2);
    });
  });
});
