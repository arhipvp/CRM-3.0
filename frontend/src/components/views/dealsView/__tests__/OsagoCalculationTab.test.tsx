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
  it('recognizes selected file, renders editable result and saves it', async () => {
    vi.mocked(recognizeDealCalculation).mockResolvedValueOnce(recognitionPayload);
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
        selectedDriveFileIds={[]}
        toggleDriveFileSelection={vi.fn()}
        isDriveLoading={false}
        driveError={null}
        loadDriveFiles={vi.fn().mockResolvedValue(undefined)}
      />,
    );

    fireEvent.click(screen.getByLabelText('sts.jpg'));
    expect(screen.getByRole('button', { name: 'Распознать данные' })).toBeDisabled();

    const textSource = screen.getByLabelText('Текстовый источник');
    fireEvent.change(textSource, { target: { value: 'данные клиента' } });
    fireEvent.click(screen.getByRole('button', { name: 'Распознать данные' }));

    await waitFor(() => expect(recognizeDealCalculation).toHaveBeenCalled());
    expect(screen.getByDisplayValue('ИВАНОВ ИВАН ИВАНОВИЧ')).toBeInTheDocument();
    expect(screen.getByText('Проверьте VIN')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Сохранить данные' }));
    await waitFor(() => expect(saveDealCalculation).toHaveBeenCalled());
  });
});
