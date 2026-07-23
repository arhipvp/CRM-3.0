import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { recognizeDealCalculation, saveDealCalculation } from '../../../../api/deals';
import type { Deal, OsagoRecognitionResponse } from '../../../../types';
import { OsagoCalculationTab } from '../tabs/OsagoCalculationTab';

vi.mock('../../../../api/deals', () => ({
  recognizeDealCalculation: vi.fn(),
  saveDealCalculation: vi.fn(),
}));

const recognitionPayload: OsagoRecognitionResponse = {
  calculationType: 'osago',
  data: {
    policyholder: {
      full_name: 'ИВАНОВ ИВАН ИВАНОВИЧ',
      birth_date: '',
      passport_series: '',
      passport_number: '',
      registration_address: '',
    },
    drivers: [],
    vehicle: {
      vin: '',
      brand: 'Lada',
      model: 'Vesta',
      year: 2020,
      plate_number: '',
      sts_series: '',
      sts_number: '',
    },
    insurance: {
      start_date: '',
      region: '',
      usage_purpose: '',
      unlimited_drivers: false,
    },
  },
  warnings: ['Проверьте VIN'],
  confidence: 0.9,
  sources: { files: [{ id: 'file-1', name: 'sts.jpg' }], textIncluded: false },
  fileResults: [],
};

const deal = {
  id: 'deal-1',
  title: 'Сделка',
  clientId: 'client-1',
  status: 'open',
  createdAt: '2026-01-01T00:00:00Z',
  quotes: [],
  documents: [],
} as Deal;

describe('OsagoCalculationTab', () => {
  it('starts on the sources step and disables recognition without sources', () => {
    render(
      <OsagoCalculationTab
        selectedDeal={deal}
        sortedDriveFiles={[]}
        expandedFolderIds={new Set()}
        toggleFolderExpanded={vi.fn()}
        isFolderLoading={vi.fn().mockReturnValue(false)}
        getDriveFileDepth={vi.fn().mockReturnValue(0)}
        selectedDriveFileIds={[]}
        toggleDriveFileSelection={vi.fn()}
        isDriveLoading={false}
        driveError={null}
        loadDriveFiles={vi.fn().mockResolvedValue(undefined)}
      />,
    );

    expect(screen.getByRole('tab', { name: /Источники данных/ })).toHaveAttribute(
      'aria-selected',
      'true',
    );
    expect(screen.getByRole('tab', { name: /Проверка результата/ })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Далее: распознать' })).toBeDisabled();
    expect(screen.queryByRole('button', { name: 'Сохранить данные' })).not.toBeInTheDocument();
  });

  it('renders when saved calculation data has incomplete nested objects', () => {
    expect(() =>
      render(
        <OsagoCalculationTab
          selectedDeal={{ ...deal, calculationData: { drivers: [undefined] } as never }}
          sortedDriveFiles={[]}
          expandedFolderIds={new Set()}
          toggleFolderExpanded={vi.fn()}
          isFolderLoading={vi.fn().mockReturnValue(false)}
          getDriveFileDepth={vi.fn().mockReturnValue(0)}
          selectedDriveFileIds={[]}
          toggleDriveFileSelection={vi.fn()}
          isDriveLoading={false}
          driveError={null}
          loadDriveFiles={vi.fn().mockResolvedValue(undefined)}
        />,
      ),
    ).not.toThrow();
    expect(screen.getByText('Источники данных')).toBeInTheDocument();
  });

  it('renders the Drive folder structure and nested file selection', () => {
    const toggleFolderExpanded = vi.fn();
    render(
      <OsagoCalculationTab
        selectedDeal={deal}
        sortedDriveFiles={[
          { id: 'folder-1', name: 'Документы', mimeType: 'folder', isFolder: true },
          {
            id: 'file-1',
            name: 'Паспорт.jpg',
            mimeType: 'image/jpeg',
            isFolder: false,
            parentId: 'folder-1',
          },
        ]}
        expandedFolderIds={new Set(['folder-1'])}
        toggleFolderExpanded={toggleFolderExpanded}
        isFolderLoading={vi.fn().mockReturnValue(false)}
        getDriveFileDepth={vi.fn((fileId) => (fileId === 'file-1' ? 1 : 0))}
        selectedDriveFileIds={[]}
        toggleDriveFileSelection={vi.fn()}
        isDriveLoading={false}
        driveError={null}
        loadDriveFiles={vi.fn().mockResolvedValue(undefined)}
      />,
    );

    expect(screen.getByText('Документы')).toBeInTheDocument();
    expect(screen.getByLabelText('Выбрать файл: Паспорт.jpg')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Свернуть папку Документы' }));
    expect(toggleFolderExpanded).toHaveBeenCalledWith('folder-1');
  });

  it('recognizes selected file, renders editable result and saves it', async () => {
    vi.mocked(recognizeDealCalculation).mockResolvedValue(recognitionPayload);
    vi.mocked(saveDealCalculation).mockResolvedValueOnce(deal);

    render(
      <OsagoCalculationTab
        selectedDeal={deal}
        sortedDriveFiles={[
          {
            id: 'file-1',
            name: 'sts.jpg',
            mimeType: 'image/jpeg',
            isFolder: false,
          },
        ]}
        expandedFolderIds={new Set()}
        toggleFolderExpanded={vi.fn()}
        isFolderLoading={vi.fn().mockReturnValue(false)}
        getDriveFileDepth={vi.fn().mockReturnValue(0)}
        selectedDriveFileIds={[]}
        toggleDriveFileSelection={vi.fn()}
        isDriveLoading={false}
        driveError={null}
        loadDriveFiles={vi.fn().mockResolvedValue(undefined)}
      />,
    );

    fireEvent.click(screen.getByLabelText('Выбрать файл: sts.jpg'));
    expect(screen.getByRole('button', { name: 'Далее: распознать' })).toBeDisabled();

    const textSource = screen.getByLabelText('Текстовый источник');
    fireEvent.change(textSource, { target: { value: 'данные клиента' } });
    fireEvent.click(screen.getByRole('button', { name: 'Далее: распознать' }));

    await waitFor(() => expect(recognizeDealCalculation).toHaveBeenCalled());
    expect(screen.getByText('Проверка результата')).toBeInTheDocument();
    expect(screen.getByDisplayValue('ИВАНОВ ИВАН ИВАНОВИЧ')).toBeInTheDocument();
    expect(screen.getByText('Проверьте VIN')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Назад к источникам' }));
    expect(screen.getByRole('button', { name: 'Далее: распознать' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Далее: распознать' }));
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Сохранить данные' })).toBeInTheDocument(),
    );
    fireEvent.click(screen.getByRole('button', { name: 'Сохранить данные' }));
    await waitFor(() => expect(saveDealCalculation).toHaveBeenCalled());
  });

  it('shows recognition errors on the sources step', async () => {
    vi.mocked(recognizeDealCalculation).mockRejectedValueOnce(new Error('Ошибка сервиса'));

    render(
      <OsagoCalculationTab
        selectedDeal={deal}
        sortedDriveFiles={[]}
        expandedFolderIds={new Set()}
        toggleFolderExpanded={vi.fn()}
        isFolderLoading={vi.fn().mockReturnValue(false)}
        getDriveFileDepth={vi.fn().mockReturnValue(0)}
        selectedDriveFileIds={[]}
        toggleDriveFileSelection={vi.fn()}
        isDriveLoading={false}
        driveError={null}
        loadDriveFiles={vi.fn().mockResolvedValue(undefined)}
      />,
    );

    fireEvent.change(screen.getByLabelText('Текстовый источник'), {
      target: { value: 'данные' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Далее: распознать' }));

    await waitFor(() => expect(screen.getByText('Ошибка сервиса')).toBeInTheDocument());
    expect(screen.getByRole('button', { name: 'Далее: распознать' })).toBeInTheDocument();
  });
});
