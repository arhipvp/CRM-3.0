import React from 'react';

type FinanceFilterType = 'all' | 'income' | 'expense';

interface FiltersSectionProps {
  searchQuery: string;
  filterType: FinanceFilterType;
  filterDateFrom: string;
  filterDateTo: string;
  onSearchChange: (value: string) => void;
  onFilterTypeChange: (value: FinanceFilterType) => void;
  onFilterDateFromChange: (value: string) => void;
  onFilterDateToChange: (value: string) => void;
  onReset: () => void;
}

export const FiltersSection: React.FC<FiltersSectionProps> = ({
  searchQuery,
  filterType,
  filterDateFrom,
  filterDateTo,
  onSearchChange,
  onFilterTypeChange,
  onFilterDateFromChange,
  onFilterDateToChange,
  onReset,
}) => (
  <div className="filters-section">
    <div className="filter-group">
      <input
        type="text"
        placeholder="Поиск по описанию, источнику, заметке..."
        value={searchQuery}
        onChange={(e) => onSearchChange(e.target.value)}
        className="search-input"
      />
    </div>

    <div className="filters-row">
      <div className="filter-group">
        <label>Тип</label>
        <select value={filterType} onChange={(e) => onFilterTypeChange(e.target.value as FinanceFilterType)}>
          <option value="all">Все</option>
          <option value="income">Доход</option>
          <option value="expense">Расход</option>
        </select>
      </div>

      <div className="filter-group">
        <label>От</label>
        <input type="date" value={filterDateFrom} onChange={(e) => onFilterDateFromChange(e.target.value)} />
      </div>

      <div className="filter-group">
        <label>До</label>
        <input type="date" value={filterDateTo} onChange={(e) => onFilterDateToChange(e.target.value)} />
      </div>

      <button onClick={onReset} className="btn-reset">
        Сбросить фильтры
      </button>
    </div>
  </div>
);
