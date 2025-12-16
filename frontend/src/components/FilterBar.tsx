import React, { useState } from 'react';
import { FilterParams } from '../api';

type CustomFilterDefinition =
  | { key: string; label: string; type: 'text' }
  | { key: string; label: string; type: 'checkbox' }
  | { key: string; label: string; type: 'select'; options: Array<{ value: string; label: string }> };

export interface FilterBarProps {
  onFilterChange: (filters: FilterParams) => void;
  searchPlaceholder?: string;
  sortOptions?: Array<{ value: string; label: string }>;
  customFilters?: CustomFilterDefinition[];
}

export const FilterBar: React.FC<FilterBarProps> = ({
  onFilterChange,
  searchPlaceholder = 'Поиск...',
  sortOptions = [],
  customFilters = [],
}) => {
  const [search, setSearch] = useState('');
  const [ordering, setOrdering] = useState('');
  const [customFilterValues, setCustomFilterValues] = useState<Record<string, string>>({});

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
    setSearch('');
    setOrdering('');
    setCustomFilterValues({});
    applyFilters({});
  };

  const hasActiveFilters =
    search ||
    ordering ||
    Object.values(customFilterValues).some((value) => value && value.length > 0);

  return (
    <div className="app-panel p-4 shadow-none mb-4">
      <div className="flex flex-col gap-4">
        <div className="flex flex-col md:flex-row gap-3 items-end flex-wrap">
          <div className="flex-1 min-w-48">
            <label className="app-label mb-1 block">Поиск</label>
            <input
              type="text"
              value={search}
              onChange={(event) => handleSearchChange(event.target.value)}
              placeholder={searchPlaceholder}
              className="field field-input"
            />
          </div>

          {sortOptions.length > 0 && (
            <div className="w-full md:w-auto">
              <label className="app-label mb-1 block">Сортировка</label>
              <select
                value={ordering}
                onChange={(event) => handleOrderingChange(event.target.value)}
                className="field field-select w-full md:w-auto"
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
            <div key={filter.key} className="w-full md:w-auto">
              {filter.type === 'checkbox' ? (
                <label className="app-panel-muted flex items-center gap-2 rounded-xl px-3 py-2 text-xs text-slate-700">
                  <input
                    type="checkbox"
                    checked={customFilterValues[filter.key] === 'true'}
                    onChange={(event) => handleCheckboxFilterChange(filter.key, event.target.checked)}
                    className="h-4 w-4 rounded border-slate-300 text-sky-600 focus:ring-sky-500"
                  />
                  <span>{filter.label}</span>
                </label>
              ) : (
                <>
                  <label className="app-label mb-1 block">{filter.label}</label>
                  {filter.type === 'text' ? (
                    <input
                      type="text"
                      value={customFilterValues[filter.key] || ''}
                      onChange={(event) => handleCustomFilterChange(filter.key, event.target.value)}
                      placeholder={filter.label}
                      className="field field-input w-full md:w-auto"
                    />
                  ) : (
                    <select
                      value={customFilterValues[filter.key] || ''}
                      onChange={(event) => handleCustomFilterChange(filter.key, event.target.value)}
                      className="field field-select w-full md:w-auto"
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
              onClick={handleClearFilters}
              className="btn btn-secondary btn-sm rounded-xl whitespace-nowrap"
            >
              Сбросить фильтры
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
