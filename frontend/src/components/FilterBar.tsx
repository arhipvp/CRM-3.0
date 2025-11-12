import React, { useState } from 'react';
import { FilterParams } from '../api';

export interface FilterBarProps {
  onFilterChange: (filters: FilterParams) => void;
  searchPlaceholder?: string;
  sortOptions?: Array<{ value: string; label: string }>;
  customFilters?: Array<{
    key: string;
    label: string;
    type: 'text' | 'select';
    options?: Array<{ value: string; label: string }>;
  }>;
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

  const handleSearchChange = (value: string) => {
    setSearch(value);
    applyFilters({ search: value, ordering, ...customFilterValues });
  };

  const handleOrderingChange = (value: string) => {
    setOrdering(value);
    applyFilters({ search, ordering: value, ...customFilterValues });
  };

  const handleCustomFilterChange = (key: string, value: string) => {
    const newCustomValues = { ...customFilterValues, [key]: value };
    setCustomFilterValues(newCustomValues);
    applyFilters({ search, ordering, ...newCustomValues });
  };

  const applyFilters = (filters: Record<string, string>) => {
    const cleanFilters: FilterParams = {};

    // Add search if present
    if (filters.search) {
      cleanFilters.search = filters.search;
    }

    // Add ordering if present
    if (filters.ordering) {
      cleanFilters.ordering = filters.ordering;
    }

    // Add custom filters if present
    customFilters.forEach((filter) => {
      if (filters[filter.key]) {
        cleanFilters[filter.key] = filters[filter.key];
      }
    });

    onFilterChange(cleanFilters);
  };

  const handleClearFilters = () => {
    setSearch('');
    setOrdering('');
    setCustomFilterValues({});
    applyFilters({});
  };

  const hasActiveFilters = search || ordering || Object.values(customFilterValues).some((v) => v);

  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-4 mb-4">
      <div className="flex flex-col gap-4">
        <div className="flex flex-col md:flex-row gap-3 items-end flex-wrap">
          {/* Search Input */}
          <div className="flex-1 min-w-48">
            <label className="text-sm text-slate-600 mb-1 block">Поиск</label>
            <input
              type="text"
              value={search}
              onChange={(e) => handleSearchChange(e.target.value)}
              placeholder={searchPlaceholder}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:border-blue-500"
            />
          </div>

          {/* Sorting Select */}
          {sortOptions.length > 0 && (
            <div className="w-full md:w-auto">
              <label className="text-sm text-slate-600 mb-1 block">Сортировка</label>
              <select
                value={ordering}
                onChange={(e) => handleOrderingChange(e.target.value)}
                className="w-full md:w-auto px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:border-blue-500"
              >
                <option value="">По умолчанию</option>
                {sortOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Custom Filters */}
          {customFilters.map((filter) => (
            <div key={filter.key} className="w-full md:w-auto">
              <label className="text-sm text-slate-600 mb-1 block">{filter.label}</label>
              {filter.type === 'text' ? (
                <input
                  type="text"
                  value={customFilterValues[filter.key] || ''}
                  onChange={(e) => handleCustomFilterChange(filter.key, e.target.value)}
                  placeholder={filter.label}
                  className="w-full md:w-auto px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:border-blue-500"
                />
              ) : (
                <select
                  value={customFilterValues[filter.key] || ''}
                  onChange={(e) => handleCustomFilterChange(filter.key, e.target.value)}
                  className="w-full md:w-auto px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:border-blue-500"
                >
                  <option value="">Все</option>
                  {filter.options?.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              )}
            </div>
          ))}

          {/* Clear Filters Button */}
          {hasActiveFilters && (
            <button
              onClick={handleClearFilters}
              className="px-3 py-2 text-sm border border-slate-300 rounded-lg text-slate-600 hover:bg-slate-50 whitespace-nowrap"
            >
              Очистить
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
