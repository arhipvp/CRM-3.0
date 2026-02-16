import type { ReactNode } from 'react';

import type { Statement } from '../../../types';

interface AllRecordsPanelProps {
  allRecordsSearch: string;
  onSearchChange: (value: string) => void;
  allRecordsError: string | null;
  isAllRecordsLoading: boolean;
  onRetryLoad: () => void;
  showUnpaidPayments: boolean;
  onToggleShowUnpaidPayments: (nextValue: boolean) => void;
  showStatementRecords: boolean;
  onToggleShowStatementRecords: (nextValue: boolean) => void;
  showPaidRecords: boolean;
  onToggleShowPaidRecords: (nextValue: boolean) => void;
  showZeroSaldo: boolean;
  onToggleShowZeroSaldo: (nextValue: boolean) => void;
  recordTypeFilter: 'all' | 'income' | 'expense';
  onRecordTypeFilterChange: (nextValue: 'all' | 'income' | 'expense') => void;
  isRecordTypeLocked: boolean;
  targetStatementId: string;
  onTargetStatementChange: (statementId: string) => void;
  statements: Statement[];
  normalizeText: (value?: string | null) => string;
  shownRecordsCount: number;
  totalRecordsCount: number;
  isAllRecordsLoadingMore: boolean;
  allRecordsHasMore: boolean;
  onLoadMore: () => void;
  recordsTable: ReactNode;
}

export const AllRecordsPanel = ({
  allRecordsSearch,
  onSearchChange,
  allRecordsError,
  isAllRecordsLoading,
  onRetryLoad,
  showUnpaidPayments,
  onToggleShowUnpaidPayments,
  showStatementRecords,
  onToggleShowStatementRecords,
  showPaidRecords,
  onToggleShowPaidRecords,
  showZeroSaldo,
  onToggleShowZeroSaldo,
  recordTypeFilter,
  onRecordTypeFilterChange,
  isRecordTypeLocked,
  targetStatementId,
  onTargetStatementChange,
  statements,
  normalizeText,
  shownRecordsCount,
  totalRecordsCount,
  isAllRecordsLoadingMore,
  allRecordsHasMore,
  onLoadMore,
  recordsTable,
}: AllRecordsPanelProps) => (
  <div className="divide-y divide-slate-200">
    <div className="px-4 py-4 bg-white">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-baseline lg:justify-between">
        <div className="flex flex-wrap items-baseline gap-2">
          <span className="text-lg font-semibold text-slate-900 whitespace-nowrap">
            Все финансовые записи
          </span>
          <span className="text-sm text-slate-500 whitespace-nowrap">Фильтры по записям</span>
        </div>
        <div className="w-full max-w-sm">
          <label htmlFor="allFinancialSearch" className="sr-only">
            Поиск по записям
          </label>
          <input
            id="allFinancialSearch"
            type="search"
            value={allRecordsSearch}
            onChange={(event) => onSearchChange(event.target.value)}
            placeholder="Поиск по клиенту, полису, сделке, примечанию..."
            className="field field-input"
          />
        </div>
      </div>
    </div>
    {allRecordsError && (
      <div className="px-4 py-3 bg-white border-b border-slate-200">
        <div className="app-alert app-alert-danger flex flex-wrap items-center justify-between gap-3">
          <span>{allRecordsError}</span>
          <button
            type="button"
            onClick={onRetryLoad}
            className="btn btn-secondary btn-sm rounded-xl"
            disabled={isAllRecordsLoading}
          >
            Повторить
          </button>
        </div>
      </div>
    )}
    <div className="px-4 py-4 border-b border-slate-200 bg-white">
      <div className="flex flex-wrap items-center gap-4">
        <label className="flex items-center gap-2 text-xs font-semibold text-slate-500">
          <input
            type="checkbox"
            checked={showUnpaidPayments}
            onChange={(event) => onToggleShowUnpaidPayments(event.target.checked)}
            className="check"
          />
          Показывать неоплаченные платежи
        </label>
        <label className="flex items-center gap-2 text-xs font-semibold text-slate-500">
          <input
            type="checkbox"
            checked={showStatementRecords}
            onChange={(event) => onToggleShowStatementRecords(event.target.checked)}
            className="check"
          />
          Показывать записи в ведомостях
        </label>
        <label className="flex items-center gap-2 text-xs font-semibold text-slate-500">
          <input
            type="checkbox"
            checked={showPaidRecords}
            onChange={(event) => onToggleShowPaidRecords(event.target.checked)}
            className="check"
          />
          Показать оплаченные расходы/доходы
        </label>
        <label className="flex items-center gap-2 text-xs font-semibold text-slate-500">
          <input
            type="checkbox"
            checked={showZeroSaldo}
            onChange={(event) => onToggleShowZeroSaldo(event.target.checked)}
            className="check"
          />
          Показывать нулевое сальдо
        </label>
        <div className="flex items-center gap-2 rounded-2xl border border-slate-200 bg-slate-50 p-1">
          <button
            type="button"
            onClick={() => onRecordTypeFilterChange('income')}
            disabled={isRecordTypeLocked}
            className={`rounded-xl px-3 py-2 text-xs font-semibold transition ${
              recordTypeFilter === 'income'
                ? 'bg-emerald-600 text-white hover:bg-emerald-700'
                : 'text-slate-600 hover:bg-white'
            }`}
            title={
              isRecordTypeLocked
                ? 'Тип записей выбран автоматически по ведомости'
                : 'Показать только доходы'
            }
          >
            Доходы
          </button>
          <button
            type="button"
            onClick={() => onRecordTypeFilterChange('expense')}
            disabled={isRecordTypeLocked}
            className={`rounded-xl px-3 py-2 text-xs font-semibold transition ${
              recordTypeFilter === 'expense'
                ? 'bg-rose-600 text-white hover:bg-rose-700'
                : 'text-slate-600 hover:bg-white'
            }`}
            title={
              isRecordTypeLocked
                ? 'Тип записей выбран автоматически по ведомости'
                : 'Показать только расходы'
            }
          >
            Расходы
          </button>
          <button
            type="button"
            onClick={() => onRecordTypeFilterChange('all')}
            disabled={isRecordTypeLocked}
            className={`rounded-xl px-3 py-2 text-xs font-semibold transition ${
              recordTypeFilter === 'all'
                ? 'bg-slate-900 text-white hover:bg-slate-800'
                : 'text-slate-600 hover:bg-white'
            }`}
            title={
              isRecordTypeLocked
                ? 'Тип записей выбран автоматически по ведомости'
                : 'Показать все записи'
            }
          >
            Все
          </button>
        </div>
        <select
          value={targetStatementId}
          onChange={(event) => onTargetStatementChange(event.target.value)}
          className="field field-input h-10 min-w-[220px] text-sm"
        >
          <option value="">Выберите ведомость</option>
          {statements
            .filter((statement) => !statement.paidAt)
            .map((statement) => (
              <option key={statement.id} value={statement.id}>
                {statement.statementType === 'income' ? 'Доходы' : 'Расходы'} ·{' '}
                {normalizeText(statement.name)}
              </option>
            ))}
        </select>
      </div>
    </div>
    <div className="px-4 py-5 bg-white space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-slate-500">
        <span>
          Показано: <span className="font-semibold text-slate-700">{shownRecordsCount}</span>
          {totalRecordsCount ? ` из ${totalRecordsCount}` : ''}
        </span>
        {isAllRecordsLoading && <span>Загрузка...</span>}
      </div>

      {recordsTable}

      {allRecordsHasMore && (
        <div className="border-t border-slate-100 bg-slate-50/70 px-4 py-3 text-center rounded-2xl">
          <button
            type="button"
            onClick={onLoadMore}
            disabled={isAllRecordsLoadingMore || isAllRecordsLoading}
            className="btn btn-quiet btn-sm rounded-xl"
          >
            {isAllRecordsLoadingMore ? 'Загрузка...' : 'Показать ещё'}
          </button>
        </div>
      )}
    </div>
  </div>
);
