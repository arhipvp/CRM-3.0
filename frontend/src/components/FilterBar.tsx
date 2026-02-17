import React, { useId, useState } from 'react';
import { FilterParams } from '../api';
import { BTN_SM_SECONDARY } from './common/buttonStyles';

type CustomFilterDefinition =
  | { key: string; label: string; type: 'text' }
  | { key: string; label: string; type: 'checkbox' }
  | {
      key: string;
      label: string;
      type: 'select';
      options: Array<{ value: string; label: string }>;
    };

export interface FilterBarProps {
  onFilterChange: (filters: FilterParams) => void;
  initialFilters?: FilterParams;
  searchPlaceholder?: string;
  sortOptions?: Array<{ value: string; label: string }>;
  customFilters?: CustomFilterDefinition[];
  density?: 'default' | 'compact';
  layout?: 'flow' | 'inline-wrap';
}

export const FilterBar: React.FC<FilterBarProps> = ({
  onFilterChange,
  initialFilters,
  searchPlaceholder = 'Поиск...',
  sortOptions = [],
  customFilters = [],
  density = 'default',
  layout = 'flow',
}) => {
  const idPrefix = useId();
  const initialSearch = (initialFilters?.search as string | undefined) ?? '';
  const initialOrdering = (initialFilters?.ordering as string | undefined) ?? '';
  const [search, setSearch] = useState(initialSearch);
  const [ordering, setOrdering] = useState(initialOrdering);
  const [customFilterValues, setCustomFilterValues] = useState<Record<string, string>>({});
  const searchInputId = `${idPrefix}-search`;
  const orderingSelectId = `${idPrefix}-ordering`;

  const applyFilters = (filters: Record<string, string>) => {
    const cleanFilters: FilterParams = {};

    if (filters.search) {
      cleanFilters.search = filters.search;
    }

    if (filters.ordering) {
      cleanFilters.ordering = filters.ordering;
    }

    customFilters.forEach((filter) => {
      if (filters[filter.key]) {
        cleanFilters[filter.key] = filters[filter.key];
      }
    });

    onFilterChange(cleanFilters);
  };

  const handleSearchChange = (value: string) => {
    setSearch(value);
    applyFilters({ search: value, ordering, ...customFilterValues });
  };

  const handleOrderingChange = (value: string) => {
    setOrdering(value);
    applyFilters({ search, ordering: value, ...customFilterValues });
  };

  const handleCustomFilterChange = (key: string, value: string) => {
    const newCustomValues = { ...customFilterValues };
    if (value) {
      newCustomValues[key] = value;
    } else {
      delete newCustomValues[key];
    }
    setCustomFilterValues(newCustomValues);
    applyFilters({ search, ordering, ...newCustomValues });
  };

  const handleCheckboxFilterChange = (key: string, checked: boolean) => {
    handleCustomFilterChange(key, checked ? 'true' : '');
  };

  const handleClearFilters = () => {
    setSearch(initialSearch);
    setOrdering(initialOrdering);
    setCustomFilterValues({});
    applyFilters({ search: initialSearch, ordering: initialOrdering });
  };

  const hasActiveFilters =
    search !== initialSearch ||
    ordering !== initialOrdering ||
    Object.values(customFilterValues).some((value) => value && value.length > 0);
  const isCompact = density === 'compact';
  const panelClassName = ['app-panel shadow-none mb-4', isCompact ? 'p-3' : 'p-4']
    .filter(Boolean)
    .join(' ');
  const rootGapClassName = isCompact ? 'flex flex-col gap-3' : 'flex flex-col gap-4';
  const controlsClassName =
    layout === 'inline-wrap'
      ? 'flex flex-wrap items-end gap-2'
      : 'flex flex-col md:flex-row gap-3 items-end flex-wrap';
  const inputWidthClassName = layout === 'inline-wrap' ? 'flex-1 min-w-56' : 'flex-1 min-w-48';
  const compactLabelClassName = isCompact ? 'text-[10px] tracking-[0.2em]' : '';
  const compactCheckboxClassName = isCompact ? 'px-2.5 py-1.5 text-[11px]' : 'px-3 py-2 text-xs';

  return (
    <div className={panelClassName}>
      <div className={rootGapClassName}>
        <div className={controlsClassName}>
          <div className={inputWidthClassName}>
            <label
              htmlFor={searchInputId}
              className={`app-label mb-1 block ${compactLabelClassName}`}
            >
              Поиск
            </label>
            <input
              id={searchInputId}
              type="text"
              value={search}
              onChange={(event) => handleSearchChange(event.target.value)}
              placeholder={searchPlaceholder}
              className={`field field-input ${isCompact ? 'h-9 text-xs' : ''}`}
            />
          </div>

          {sortOptions.length > 0 && (
            <div className={layout === 'inline-wrap' ? 'w-auto min-w-52' : 'w-full md:w-auto'}>
              <label
                htmlFor={orderingSelectId}
                className={`app-label mb-1 block ${compactLabelClassName}`}
              >
                Сортировка
              </label>
              <select
                id={orderingSelectId}
                value={ordering}
                onChange={(event) => handleOrderingChange(event.target.value)}
                className={`field field-select ${layout === 'inline-wrap' ? 'w-full' : 'w-full md:w-auto'} ${
                  isCompact ? 'h-9 text-[11px]' : ''
                }`}
              >
                <option value="">Выбрать направление</option>
                {sortOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
          )}

          {customFilters.map((filter) => (
            <div
              key={filter.key}
              className={layout === 'inline-wrap' ? 'w-auto' : 'w-full md:w-auto'}
            >
              {filter.type === 'checkbox' ? (
                <>
                  {(() => {
                    const checkboxId = `${idPrefix}-${filter.key}`;
                    return (
                      <label
                        htmlFor={checkboxId}
                        className={`app-panel-muted flex items-center gap-2 rounded-xl text-slate-700 ${compactCheckboxClassName}`}
                      >
                        <input
                          id={checkboxId}
                          type="checkbox"
                          checked={customFilterValues[filter.key] === 'true'}
                          onChange={(event) =>
                            handleCheckboxFilterChange(filter.key, event.target.checked)
                          }
                          className="check"
                        />
                        <span>{filter.label}</span>
                      </label>
                    );
                  })()}
                </>
              ) : (
                <>
                  <label
                    htmlFor={`${idPrefix}-${filter.key}`}
                    className={`app-label mb-1 block ${compactLabelClassName}`}
                  >
                    {filter.label}
                  </label>
                  {filter.type === 'text' ? (
                    <input
                      id={`${idPrefix}-${filter.key}`}
                      type="text"
                      value={customFilterValues[filter.key] || ''}
                      onChange={(event) => handleCustomFilterChange(filter.key, event.target.value)}
                      placeholder={filter.label}
                      className={`field field-input ${layout === 'inline-wrap' ? 'w-56' : 'w-full md:w-auto'} ${
                        isCompact ? 'h-9 text-xs' : ''
                      }`}
                    />
                  ) : (
                    <select
                      id={`${idPrefix}-${filter.key}`}
                      value={customFilterValues[filter.key] || ''}
                      onChange={(event) => handleCustomFilterChange(filter.key, event.target.value)}
                      className={`field field-select ${layout === 'inline-wrap' ? 'w-56' : 'w-full md:w-auto'} ${
                        isCompact ? 'h-9 text-[11px]' : ''
                      }`}
                    >
                      <option value="">Не важно</option>
                      {filter.options.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  )}
                </>
              )}
            </div>
          ))}

          {hasActiveFilters && (
            <button
              type="button"
              onClick={handleClearFilters}
              className={`${BTN_SM_SECONDARY} whitespace-nowrap`}
            >
              Сбросить фильтры
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
