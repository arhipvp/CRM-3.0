import type { Dispatch, SetStateAction } from 'react';

import type { FilterParams } from '../../../api';
import type { PoliciesKPI } from '../../../types';
import { FilterBar } from '../../FilterBar';
import { Button } from '../../common/Button';
import { DateInput } from '../../common/forms/DateInput';
import type { PolicyFilterPreset } from './policiesViewTypes';

interface PoliciesFiltersPanelProps {
  kpi: PoliciesKPI;
  presetName: string;
  presets: PolicyFilterPreset[];
  deletingPresetId: string | null;
  filters: FilterParams;
  endDateFrom?: string;
  endDateTo?: string;
  filterBarVersion: number;
  customFilters: React.ComponentProps<typeof FilterBar>['customFilters'];
  isDebouncePending: boolean;
  kpiError: string | null;
  combinedPoliciesError: string | null;
  onPresetNameChange: Dispatch<SetStateAction<string>>;
  onSavePreset: () => void;
  onApplyPreset: (preset: PolicyFilterPreset) => void;
  onDeletePreset: (preset: PolicyFilterPreset) => Promise<void>;
  onUpdateFilters: (filters: FilterParams) => void;
  onSetQuickEndPeriod: (days: number) => void;
  onRefreshPolicies: () => void;
}

const POLICY_SORT_OPTIONS = [
  { value: '-start_date', label: 'Начало (убывание)' },
  { value: 'start_date', label: 'Начало (возрастание)' },
  { value: '-end_date', label: 'Окончание (убывание)' },
  { value: 'end_date', label: 'Окончание (возрастание)' },
  { value: '-number', label: 'Номер (Z -> A)' },
  { value: 'number', label: 'Номер (A -> Z)' },
  { value: '-client', label: 'Клиент (Z -> A)' },
  { value: 'client', label: 'Клиент (A -> Z)' },
];

export const PoliciesFiltersPanel = ({
  kpi,
  presetName,
  presets,
  deletingPresetId,
  filters,
  endDateFrom,
  endDateTo,
  filterBarVersion,
  customFilters = [],
  isDebouncePending,
  kpiError,
  combinedPoliciesError,
  onPresetNameChange: setPresetName,
  onSavePreset: handleSavePreset,
  onApplyPreset: handleApplyPreset,
  onDeletePreset: handleDeletePreset,
  onUpdateFilters: updateFilters,
  onSetQuickEndPeriod: setQuickEndPeriod,
  onRefreshPolicies: handleRefreshPolicies,
}: PoliciesFiltersPanelProps) => (
  <div className="flex flex-col gap-2">
    <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
      <div className="rounded-[var(--app-radius-md)] border border-[var(--app-border)] bg-white px-3 py-2">
        <p className="app-label">Всего</p>
        <p className="text-lg font-semibold text-slate-900">{kpi.total}</p>
      </div>
      <div className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2">
        <p className="app-label text-rose-600">Есть неоплаченные записи</p>
        <p className="text-lg font-semibold text-rose-700">{kpi.problemCount}</p>
      </div>
      <div className="rounded-xl border border-orange-200 bg-orange-50 px-3 py-2">
        <p className="app-label text-orange-700">К оплате</p>
        <p className="text-lg font-semibold text-orange-700">{kpi.dueCount}</p>
      </div>
      <div className="rounded-xl border border-sky-200 bg-sky-50 px-3 py-2">
        <p className="app-label text-sky-700">Скоро истекают ({kpi.expiringDays} дн.)</p>
        <p className="text-lg font-semibold text-sky-700">{kpi.expiringSoonCount}</p>
      </div>
    </div>
    <div className="rounded-xl border border-slate-200 bg-white p-2">
      <p className="app-label mb-2">Пресеты фильтров</p>
      <div className="flex flex-wrap items-center gap-2">
        <input
          type="text"
          className="field field-input h-8 w-56 text-xs"
          placeholder="Название пресета"
          value={presetName}
          onChange={(event) => setPresetName(event.target.value)}
        />
        <Button type="button" variant="quiet" size="sm" onClick={handleSavePreset}>
          Сохранить текущий
        </Button>
        {presets.map((preset) => (
          <div
            key={preset.id}
            className="inline-flex items-center gap-1 rounded-lg bg-slate-100 p-1"
          >
            <Button
              type="button"
              className="rounded-md px-2 py-1 text-xs font-semibold text-slate-700 hover:bg-white"
              onClick={() => handleApplyPreset(preset)}
            >
              {preset.name}
            </Button>
            <Button
              type="button"
              className="rounded-md px-2 py-1 text-xs text-rose-600 hover:bg-rose-50"
              onClick={() => void handleDeletePreset(preset)}
              disabled={deletingPresetId === preset.id}
            >
              ×
            </Button>
          </div>
        ))}
      </div>
    </div>
    <div className="flex flex-wrap items-end gap-2 rounded-xl border border-slate-200 bg-white p-2">
      <label className="text-xs text-slate-600">
        Окончание с
        <DateInput
          aria-label="Окончание с"
          className="field field-input mt-1 h-8"
          value={endDateFrom}
          onChange={(event) => updateFilters({ ...filters, end_date_from: event.target.value })}
        />
      </label>
      <label className="text-xs text-slate-600">
        Окончание по
        <DateInput
          aria-label="Окончание по"
          className="field field-input mt-1 h-8"
          value={endDateTo}
          onChange={(event) => updateFilters({ ...filters, end_date_to: event.target.value })}
        />
      </label>
      {[30, 60, 90].map((days) => (
        <Button
          key={days}
          type="button"
          variant="quiet"
          size="sm"
          onClick={() => setQuickEndPeriod(days)}
        >
          {days} дней
        </Button>
      ))}
    </div>
    <FilterBar
      key={`policies-filterbar-${filterBarVersion}`}
      onFilterChange={updateFilters}
      searchPlaceholder="Поиск по номеру, клиенту или компании..."
      initialFilters={filters}
      sortOptions={POLICY_SORT_OPTIONS}
      customFilters={customFilters.filter((filter) => !String(filter.key).includes('date_'))}
      density="compact"
      layout="inline-wrap"
    />
    {isDebouncePending && <div className="text-xs text-slate-500">Применяю фильтр...</div>}
    {kpiError && (
      <div className="rounded-xl border border-orange-200 bg-orange-50 px-3 py-2 text-xs font-semibold text-orange-700">
        {kpiError}
      </div>
    )}
    {combinedPoliciesError && (
      <div className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <span>{combinedPoliciesError}</span>
          <Button type="button" variant="quiet" size="sm" onClick={handleRefreshPolicies}>
            Повторить
          </Button>
        </div>
      </div>
    )}
  </div>
);
