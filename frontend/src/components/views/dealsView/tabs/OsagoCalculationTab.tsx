import React, { useEffect, useState } from 'react';

import { recognizeDealCalculation, saveDealCalculation } from '../../../../api/deals';
import { DriveFilesTable } from '../../../common/table/DriveFilesTable';
import type {
  Deal,
  DriveFile,
  OsagoCalculationData,
  OsagoRecognitionResponse,
} from '../../../../types';
import { formatErrorMessage } from '../../../../utils/formatErrorMessage';
import { formatDriveDate, formatDriveFileSize } from '../helpers';

const emptyData = (): OsagoCalculationData => ({
  policyholder: {
    full_name: '',
    birth_date: '',
    passport_series: '',
    passport_number: '',
    registration_address: '',
  },
  drivers: [],
  vehicle: {
    vin: '',
    brand: '',
    model: '',
    year: null,
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
});

const emptyDriver = (): OsagoCalculationData['drivers'][number] => ({
  full_name: '',
  birth_date: '',
  license_series: '',
  license_number: '',
  license_issue_date: '',
});

const normalizeData = (value: unknown): OsagoCalculationData => {
  const source = value && typeof value === 'object' ? (value as Partial<OsagoCalculationData>) : {};
  const defaults = emptyData();
  const policyholder =
    source.policyholder && typeof source.policyholder === 'object'
      ? { ...defaults.policyholder, ...source.policyholder }
      : defaults.policyholder;
  const vehicle =
    source.vehicle && typeof source.vehicle === 'object'
      ? { ...defaults.vehicle, ...source.vehicle }
      : defaults.vehicle;
  const insurance =
    source.insurance && typeof source.insurance === 'object'
      ? { ...defaults.insurance, ...source.insurance }
      : defaults.insurance;
  const drivers = Array.isArray(source.drivers)
    ? source.drivers.map((driver) =>
        driver && typeof driver === 'object' ? { ...emptyDriver(), ...driver } : emptyDriver(),
      )
    : [];

  return { policyholder, drivers, vehicle, insurance };
};

interface OsagoCalculationTabProps {
  selectedDeal: Deal | null;
  sortedDriveFiles: DriveFile[];
  expandedFolderIds: Set<string>;
  toggleFolderExpanded: (folderId: string) => void;
  isFolderLoading: (folderId: string) => boolean;
  getDriveFileDepth: (fileId: string) => number;
  selectedDriveFileIds: string[];
  toggleDriveFileSelection: (fileId: string) => void;
  isDriveLoading: boolean;
  driveError: string | null;
  loadDriveFiles: () => Promise<void>;
  onRefreshDeal?: (dealId: string) => Promise<void>;
}

const inputClass = 'app-input w-full';
type WizardStep = 1 | 2;

export const OsagoCalculationTab: React.FC<OsagoCalculationTabProps> = ({
  selectedDeal,
  sortedDriveFiles,
  expandedFolderIds,
  toggleFolderExpanded,
  isFolderLoading,
  getDriveFileDepth,
  selectedDriveFileIds,
  toggleDriveFileSelection,
  isDriveLoading,
  driveError,
  loadDriveFiles,
  onRefreshDeal,
}) => {
  const [sourceText, setSourceText] = useState('');
  const [data, setData] = useState<OsagoCalculationData>(emptyData);
  const [recognition, setRecognition] = useState<OsagoRecognitionResponse | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isRecognizing, setIsRecognizing] = useState(false);
  const [currentStep, setCurrentStep] = useState<WizardStep>(1);

  useEffect(() => {
    setSourceText(selectedDeal?.calculationSourceText ?? '');
    setData(normalizeData(selectedDeal?.calculationData));
    setRecognition(null);
    setMessage(null);
    setCurrentStep(1);
  }, [selectedDeal?.calculationData, selectedDeal?.calculationSourceText, selectedDeal?.id]);

  const updateSection = <K extends keyof OsagoCalculationData>(
    section: K,
    key: keyof OsagoCalculationData[K],
    value: string | number | boolean | null,
  ) => {
    setData((current) => ({
      ...current,
      [section]: { ...(current[section] as object), [key]: value },
    }));
  };

  const updateDriver = (index: number, key: string, value: string) => {
    setData((current) => ({
      ...current,
      drivers: current.drivers.map((driver, driverIndex) =>
        driverIndex === index ? { ...driver, [key]: value } : driver,
      ),
    }));
  };

  const addDriver = () => {
    setData((current) => ({
      ...current,
      drivers: [...current.drivers, emptyDriver()],
    }));
  };

  const handleRecognize = async () => {
    if (!selectedDeal) return;
    setMessage(null);
    setIsRecognizing(true);
    try {
      const result = await recognizeDealCalculation({
        dealId: selectedDeal.id,
        calculationType: 'osago',
        fileIds: selectedDriveFileIds,
        sourceText,
      });
      setRecognition(result);
      setData(normalizeData(result.data));
      setCurrentStep(2);
    } catch (error) {
      setMessage(formatErrorMessage(error, 'Не удалось распознать данные для расчёта.'));
    } finally {
      setIsRecognizing(false);
    }
  };

  const handleSave = async () => {
    if (!selectedDeal) return;
    setMessage(null);
    setIsSaving(true);
    try {
      await saveDealCalculation({
        dealId: selectedDeal.id,
        calculationType: 'osago',
        calculationData: data,
        sourceText,
        sourceFileIds: selectedDriveFileIds,
      });
      await onRefreshDeal?.(selectedDeal.id);
      setMessage('Данные расчёта сохранены.');
    } catch (error) {
      setMessage(formatErrorMessage(error, 'Не удалось сохранить данные расчёта.'));
    } finally {
      setIsSaving(false);
    }
  };

  if (!selectedDeal) return null;

  return (
    <section className="app-panel space-y-6 border-none p-6 shadow-none">
      <div>
        <p className="app-label">Данные для расчёта</p>
        <p className="mt-1 text-sm text-slate-500">
          Загрузите источники, распознайте данные и проверьте результат перед сохранением.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2" role="tablist" aria-label="Этапы мастера">
        {[
          ['1', 'Источники данных'],
          ['2', 'Проверка результата'],
        ].map(([number, label], index) => {
          const step = (index + 1) as WizardStep;
          const isActive = currentStep === step;
          const isComplete = currentStep > step;
          return (
            <button
              type="button"
              id={`calculation-tab-${step}`}
              role="tab"
              aria-selected={isActive}
              aria-controls={`calculation-step-${step}`}
              disabled={step === 2 && !recognition}
              onClick={() => {
                if (step === 1 || recognition) {
                  setCurrentStep(step);
                }
              }}
              key={number}
              className={`w-full rounded-lg border p-3 text-left transition ${
                isActive
                  ? 'border-blue-500 bg-blue-50'
                  : isComplete
                    ? 'border-emerald-300 bg-emerald-50'
                    : 'border-slate-200 bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60'
              }`}
            >
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Шаг {number}
              </p>
              <p className="mt-1 text-sm font-semibold text-slate-800">{label}</p>
            </button>
          );
        })}
      </div>

      {currentStep === 1 && (
        <div
          id="calculation-step-1"
          role="tabpanel"
          aria-labelledby="calculation-tab-1"
          className="space-y-5"
        >
          <div className="grid gap-5 lg:grid-cols-2">
            <div className="space-y-3">
              <label className="app-label" htmlFor="calculation-type">
                Тип расчёта
              </label>
              <select id="calculation-type" className={inputClass} value="osago" disabled>
                <option value="osago">ОСАГО</option>
              </select>

              <div className="flex items-center justify-between pt-2">
                <span className="app-label">Файлы сделки</span>
                <button
                  type="button"
                  className="app-button-secondary"
                  onClick={() => void loadDriveFiles()}
                >
                  Обновить
                </button>
              </div>
              {driveError && <p className="text-sm text-red-600">{driveError}</p>}
              {isDriveLoading ? (
                <p className="text-sm text-slate-500">Загрузка файлов...</p>
              ) : sortedDriveFiles.length ? (
                <div className="max-h-96 overflow-auto">
                  <DriveFilesTable
                    files={sortedDriveFiles}
                    emptyMessage="В папке сделки нет файлов."
                    selectedFileIds={selectedDriveFileIds}
                    onToggleSelection={toggleDriveFileSelection}
                    isSelectionDisabled={() => isRecognizing}
                    expandedFolderIds={expandedFolderIds}
                    onToggleFolder={toggleFolderExpanded}
                    isFolderLoading={isFolderLoading}
                    getRowDepth={(file) => getDriveFileDepth(file.id)}
                    renderDate={(file) => formatDriveDate(file.modifiedAt ?? file.createdAt)}
                    renderSize={(file) => formatDriveFileSize(file.size)}
                    renderActions={() => null}
                  />
                </div>
              ) : (
                <p className="text-sm text-slate-500">В папке сделки нет файлов.</p>
              )}
            </div>

            <div>
              <label className="app-label" htmlFor="calculation-source-text">
                Текстовый источник
              </label>
              <textarea
                id="calculation-source-text"
                className={`${inputClass} mt-2 min-h-56 resize-y`}
                value={sourceText}
                onChange={(event) => setSourceText(event.target.value)}
                placeholder="Вставьте дополнительные данные клиента, автомобиля или страхования"
              />
            </div>
          </div>

          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              className="app-button-primary"
              disabled={isRecognizing || (!selectedDriveFileIds.length && !sourceText.trim())}
              onClick={() => void handleRecognize()}
            >
              {isRecognizing ? 'Распознавание...' : 'Далее: распознать'}
            </button>
          </div>
        </div>
      )}

      {message && <p className="text-sm text-slate-700">{message}</p>}
      {currentStep === 2 && recognition && (
        <div
          id="calculation-step-2"
          role="tabpanel"
          aria-labelledby="calculation-tab-2"
          className="space-y-5"
        >
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
            Уверенность распознавания:{' '}
            {recognition.confidence == null ? '—' : `${Math.round(recognition.confidence * 100)}%`}
            <p className="mt-2">
              Источники: {recognition.sources?.files?.length ?? 0} файл(ов)
              {recognition.sources?.textIncluded ? ' и текстовое поле' : ''}.
            </p>
            {(recognition.sources?.files ?? []).length > 0 && (
              <ul className="mt-1 list-disc pl-5">
                {(recognition.sources?.files ?? []).map((file) => (
                  <li key={file.id}>{file.name}</li>
                ))}
              </ul>
            )}
            {(recognition.warnings ?? []).length > 0 && (
              <ul className="mt-2 list-disc space-y-1 pl-5">
                {(recognition.warnings ?? []).map((warning, index) => (
                  <li key={`${warning}-${index}`}>{warning}</li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}

      {currentStep === 2 && recognition && (
        <>
          <div className="grid gap-5 lg:grid-cols-2">
            <fieldset className="space-y-3 rounded-lg border border-slate-200 p-4">
              <legend className="px-1 text-sm font-semibold text-slate-800">Страхователь</legend>
              {(
                [
                  ['full_name', 'ФИО'],
                  ['birth_date', 'Дата рождения'],
                  ['passport_series', 'Серия паспорта'],
                  ['passport_number', 'Номер паспорта'],
                  ['registration_address', 'Адрес регистрации'],
                ] as const
              ).map(([key, label]) => (
                <label key={key} className="block text-sm text-slate-600">
                  {label}
                  <input
                    className={`${inputClass} mt-1`}
                    value={data.policyholder[key]}
                    onChange={(event) => updateSection('policyholder', key, event.target.value)}
                  />
                </label>
              ))}
            </fieldset>

            <fieldset className="space-y-3 rounded-lg border border-slate-200 p-4">
              <legend className="px-1 text-sm font-semibold text-slate-800">Автомобиль</legend>
              {(
                [
                  ['vin', 'VIN'],
                  ['brand', 'Марка'],
                  ['model', 'Модель'],
                  ['year', 'Год выпуска'],
                  ['plate_number', 'Госномер'],
                  ['sts_series', 'Серия СТС'],
                  ['sts_number', 'Номер СТС'],
                ] as const
              ).map(([key, label]) => (
                <label key={key} className="block text-sm text-slate-600">
                  {label}
                  <input
                    className={`${inputClass} mt-1`}
                    value={data.vehicle[key] ?? ''}
                    onChange={(event) =>
                      updateSection(
                        'vehicle',
                        key,
                        key === 'year' ? Number(event.target.value) || null : event.target.value,
                      )
                    }
                  />
                </label>
              ))}
            </fieldset>
          </div>

          <fieldset className="space-y-3 rounded-lg border border-slate-200 p-4">
            <legend className="px-1 text-sm font-semibold text-slate-800">Водители</legend>
            {data.drivers.map((driver, index) => (
              <div
                key={index}
                className="grid gap-3 rounded border border-slate-100 p-3 md:grid-cols-2"
              >
                {(
                  [
                    ['full_name', 'ФИО'],
                    ['birth_date', 'Дата рождения'],
                    ['license_series', 'Серия ВУ'],
                    ['license_number', 'Номер ВУ'],
                    ['license_issue_date', 'Дата выдачи ВУ'],
                  ] as const
                ).map(([key, label]) => (
                  <label key={key} className="text-sm text-slate-600">
                    {label}
                    <input
                      className={`${inputClass} mt-1`}
                      value={driver[key]}
                      onChange={(event) => updateDriver(index, key, event.target.value)}
                    />
                  </label>
                ))}
              </div>
            ))}
            <button type="button" className="app-button-secondary" onClick={addDriver}>
              Добавить водителя
            </button>
          </fieldset>

          <fieldset className="grid gap-3 rounded-lg border border-slate-200 p-4 md:grid-cols-2">
            <legend className="px-1 text-sm font-semibold text-slate-800">Страхование</legend>
            <label className="text-sm text-slate-600">
              Дата начала
              <input
                type="date"
                className={`${inputClass} mt-1`}
                value={data.insurance.start_date}
                onChange={(event) => updateSection('insurance', 'start_date', event.target.value)}
              />
            </label>
            {(
              [
                ['region', 'Регион'],
                ['usage_purpose', 'Цель использования'],
              ] as const
            ).map(([key, label]) => (
              <label key={key} className="text-sm text-slate-600">
                {label}
                <input
                  className={`${inputClass} mt-1`}
                  value={data.insurance[key]}
                  onChange={(event) => updateSection('insurance', key, event.target.value)}
                />
              </label>
            ))}
            <label className="flex items-center gap-2 text-sm text-slate-600">
              <input
                type="checkbox"
                checked={data.insurance.unlimited_drivers}
                onChange={(event) =>
                  updateSection('insurance', 'unlimited_drivers', event.target.checked)
                }
              />
              Неограниченный список водителей
            </label>
          </fieldset>

          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              className="app-button-secondary"
              disabled={isSaving || isRecognizing}
              onClick={() => setCurrentStep(1)}
            >
              Назад к источникам
            </button>
            <button
              type="button"
              className="app-button-primary"
              disabled={isSaving || isRecognizing}
              onClick={() => void handleSave()}
            >
              {isSaving ? 'Сохранение...' : 'Сохранить данные'}
            </button>
          </div>
        </>
      )}
    </section>
  );
};
