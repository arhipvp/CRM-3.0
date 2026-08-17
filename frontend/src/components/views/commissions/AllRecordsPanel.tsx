import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';

import {
  fetchFinanceStatementLookup,
  type FinanceStatementLookupOption,
  type FinancialRecordsSummary,
} from '../../../api';
import type { DriveFile, SalesChannel, Statement } from '../../../types';
import { ActionLink, Button, IconButton } from '../../common/Button';
import { InlineAlert } from '../../common/InlineAlert';
import { Combobox } from '../../common/forms/Combobox';

interface AllRecordsPanelProps {
  allRecordsSearchInput: string;
  onSearchChange: (value: string) => void;
  onSearchSubmit: (value?: string) => void;
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
  salesChannelFilter: string[];
  onSalesChannelFilterChange: (channelIds: string[]) => void;
  salesChannels: SalesChannel[];
  paymentScheduledDateFrom: string;
  onPaymentScheduledDateFromChange: (value: string) => void;
  paymentScheduledDateTo: string;
  onPaymentScheduledDateToChange: (value: string) => void;
  activeAllRecordsFilterCount: number;
  canResetAllRecordsFilters: boolean;
  onResetAllRecordsFilters: () => void;
  onApplyProcessingPreset?: () => void;
  summary?: FinancialRecordsSummary | null;
  isAllRecordsExporting: boolean;
  allRecordsExportError: string | null;
  allRecordsExportFile?: DriveFile | null;
  onExportAllRecords: () => Promise<void> | void;
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

interface RecordsFilterToggleProps {
  checked: boolean;
  label: string;
  onChange: (nextValue: boolean) => void;
}

interface RecordTypeButtonProps {
  isActive: boolean;
  tone: 'all' | 'income' | 'expense';
  title: string;
  onClick: () => void;
  disabled: boolean;
  children: ReactNode;
}

const RECORD_TYPE_BUTTON_TONE_CLASS = {
  all: 'bg-slate-900 text-white hover:bg-slate-800',
  income: 'bg-emerald-600 text-white hover:bg-emerald-700',
  expense: 'bg-rose-600 text-white hover:bg-rose-700',
};

const RECORD_TYPE_BUTTON_IDLE_CLASS = 'text-slate-600 hover:bg-white';

function RecordsFilterToggle({ checked, label, onChange }: RecordsFilterToggleProps) {
  return (
    <label className={'ui-checkbox-label-xs'}>
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        className="check"
      />
      {label}
    </label>
  );
}

function RecordTypeButton({
  isActive,
  tone,
  title,
  onClick,
  disabled,
  children,
}: RecordTypeButtonProps) {
  const toneClassName = isActive
    ? RECORD_TYPE_BUTTON_TONE_CLASS[tone]
    : RECORD_TYPE_BUTTON_IDLE_CLASS;

  return (
    <Button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`${'ui-segmented-button'} ${toneClassName}`}
      title={title}
    >
      {children}
    </Button>
  );
}

function SalesChannelMultiSelect({
  value,
  onChange,
  salesChannels,
  normalizeText,
}: {
  value: string[];
  onChange: (channelIds: string[]) => void;
  salesChannels: SalesChannel[];
  normalizeText: (value?: string | null) => string;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const selectedChannelIds = new Set(value);

  useEffect(() => {
    if (!isOpen) return;
    const handlePointerDown = (event: MouseEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handlePointerDown);
    return () => document.removeEventListener('mousedown', handlePointerDown);
  }, [isOpen]);

  const toggleChannel = (channelId: string, checked: boolean) => {
    onChange(
      checked
        ? [...value, channelId]
        : value.filter((selectedChannelId) => selectedChannelId !== channelId),
    );
  };

  const buttonLabel = value.length ? `Выбрано: ${value.length}` : 'Все каналы продаж';

  return (
    <div ref={containerRef} className="relative min-w-[220px]">
      <Button
        type="button"
        variant="secondary"
        size="sm"
        className="w-full justify-between"
        aria-expanded={isOpen}
        aria-controls="sales-channel-filter-options"
        onClick={() => setIsOpen((previous) => !previous)}
      >
        {buttonLabel}
      </Button>
      {isOpen && (
        <fieldset
          id="sales-channel-filter-options"
          className="absolute z-20 mt-1 max-h-72 w-full overflow-y-auto rounded-lg border border-slate-200 bg-white p-2 shadow-lg"
        >
          <legend className="sr-only">Каналы продаж</legend>
          <div className="mb-1 flex justify-end">
            <button
              type="button"
              onClick={() => onChange([])}
              disabled={!value.length}
              className="text-xs font-medium text-blue-600 hover:text-blue-700 disabled:cursor-not-allowed disabled:text-slate-400"
            >
              Сбросить
            </button>
          </div>
          {salesChannels.map((channel) => (
            <label
              key={channel.id}
              className="flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-sm hover:bg-slate-50"
            >
              <input
                type="checkbox"
                checked={selectedChannelIds.has(channel.id)}
                onChange={(event) => toggleChannel(channel.id, event.target.checked)}
              />
              {normalizeText(channel.name)}
            </label>
          ))}
        </fieldset>
      )}
    </div>
  );
}

function StatementLookup({
  value,
  onChange,
  statements,
  statementType,
}: {
  value: string;
  onChange: (statementId: string) => void;
  statements: Statement[];
  statementType: 'all' | 'income' | 'expense';
}) {
  const selectedStatement = statements.find((statement) => statement.id === value);
  const [query, setQuery] = useState(selectedStatement?.name ?? '');
  const [options, setOptions] = useState<FinanceStatementLookupOption[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (!value) setQuery('');
    else if (selectedStatement) setQuery(selectedStatement.name);
  }, [selectedStatement, value]);

  useEffect(() => {
    if (!isOpen) return;
    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      setIsLoading(true);
      void fetchFinanceStatementLookup(query, statementType === 'all' ? undefined : statementType, {
        signal: controller.signal,
      })
        .then(setOptions)
        .catch((error) => {
          if ((error as Error).name !== 'AbortError') setOptions([]);
        })
        .finally(() => {
          if (!controller.signal.aborted) setIsLoading(false);
        });
    }, 200);
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [isOpen, query, statementType]);

  const lookupOptions = useMemo(() => {
    if (!selectedStatement || options.some((option) => option.id === selectedStatement.id)) {
      return options;
    }
    return [
      {
        id: selectedStatement.id,
        name: selectedStatement.name,
        statementType: selectedStatement.statementType,
        paidAt: selectedStatement.paidAt,
      },
      ...options,
    ];
  }, [options, selectedStatement]);

  return (
    <Combobox
      id="finance-target-statement"
      value={query}
      options={lookupOptions}
      isOpen={isOpen}
      isLoading={isLoading}
      onOpen={() => setIsOpen(true)}
      onClose={() => setIsOpen(false)}
      onChange={(nextQuery) => {
        setQuery(nextQuery);
        if (value) onChange('');
      }}
      onSelect={(option) => {
        onChange(option.id);
        setQuery(option.name);
        setIsOpen(false);
      }}
      getOptionKey={(option) => option.id}
      getOptionLabel={(option) => option.name}
      placeholder="Найти ведомость"
      emptyMessage="Черновики ведомостей не найдены"
    />
  );
}

export function AllRecordsPanel({
  allRecordsSearchInput,
  onSearchChange,
  onSearchSubmit,
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
  salesChannelFilter,
  onSalesChannelFilterChange,
  salesChannels,
  paymentScheduledDateFrom,
  onPaymentScheduledDateFromChange,
  paymentScheduledDateTo,
  onPaymentScheduledDateToChange,
  activeAllRecordsFilterCount,
  canResetAllRecordsFilters,
  onResetAllRecordsFilters,
  onApplyProcessingPreset,
  summary,
  isAllRecordsExporting,
  allRecordsExportError,
  allRecordsExportFile,
  onExportAllRecords,
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
}: AllRecordsPanelProps) {
  const lockedRecordTypeTitle = 'Тип записей выбран автоматически по ведомости';

  return (
    <div className="divide-y divide-slate-200">
      <div className="bg-white px-4 py-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-baseline lg:justify-between">
          <div className="flex flex-wrap items-baseline gap-2">
            <span className="text-lg font-semibold text-slate-900 whitespace-nowrap">
              Все финансовые записи
            </span>
            <span className={'ui-section-help'}>Фильтры по записям</span>
          </div>
          <form
            onSubmit={(event) => {
              event.preventDefault();
              onSearchSubmit();
            }}
            className="flex w-full max-w-md items-center gap-2"
          >
            <label htmlFor="allFinancialSearch" className="sr-only">
              Поиск по записям
            </label>
            <div className="relative flex-1">
              <input
                id="allFinancialSearch"
                type="search"
                value={allRecordsSearchInput}
                onChange={(event) => onSearchChange(event.target.value)}
                placeholder="Поиск по записям"
                className="field field-input pr-10"
              />
              {allRecordsSearchInput && (
                <IconButton
                  type="button"
                  icon="close"
                  label="Очистить поиск финансовых записей"
                  size="sm"
                  onClick={() => {
                    onSearchChange('');
                    onSearchSubmit('');
                  }}
                  className="search-clear-btn"
                  disabled={isAllRecordsLoading}
                />
              )}
            </div>
            <Button
              type="submit"
              variant="quiet"
              size="sm"
              icon="search"
              disabled={isAllRecordsLoading}
            >
              Найти
            </Button>
            <Button
              type="button"
              variant="quiet"
              size="sm"
              icon="refresh"
              onClick={onRetryLoad}
              disabled={isAllRecordsLoading}
            >
              {isAllRecordsLoading ? 'Обновляем...' : 'Обновить'}
            </Button>
          </form>
        </div>
      </div>
      {(allRecordsError || allRecordsExportError) && (
        <div className="border-b border-slate-200 bg-white px-4 py-3">
          <InlineAlert className="flex flex-wrap items-center justify-between gap-3">
            <span>{allRecordsError || allRecordsExportError}</span>
            <Button
              type="button"
              onClick={onRetryLoad}
              variant="secondary"
              size="sm"
              disabled={isAllRecordsLoading}
            >
              Повторить
            </Button>
          </InlineAlert>
        </div>
      )}
      <div className="border-b border-slate-200 bg-white px-4 py-4">
        <div className="flex flex-wrap items-center gap-4">
          <RecordsFilterToggle
            checked={showUnpaidPayments}
            onChange={onToggleShowUnpaidPayments}
            label="Показывать неоплаченные платежи"
          />
          <RecordsFilterToggle
            checked={showStatementRecords}
            onChange={onToggleShowStatementRecords}
            label="Показывать записи в ведомостях"
          />
          <RecordsFilterToggle
            checked={showPaidRecords}
            onChange={onToggleShowPaidRecords}
            label="Показать оплаченные расходы/доходы"
          />
          <RecordsFilterToggle
            checked={showZeroSaldo}
            onChange={onToggleShowZeroSaldo}
            label="Показывать нулевое сальдо"
          />
          <div className={'ui-segmented'}>
            <RecordTypeButton
              tone="income"
              isActive={recordTypeFilter === 'income'}
              onClick={() => onRecordTypeFilterChange('income')}
              disabled={isRecordTypeLocked}
              title={isRecordTypeLocked ? lockedRecordTypeTitle : 'Показать только доходы'}
            >
              Доходы
            </RecordTypeButton>
            <RecordTypeButton
              tone="expense"
              isActive={recordTypeFilter === 'expense'}
              onClick={() => onRecordTypeFilterChange('expense')}
              disabled={isRecordTypeLocked}
              title={isRecordTypeLocked ? lockedRecordTypeTitle : 'Показать только расходы'}
            >
              Расходы
            </RecordTypeButton>
            <RecordTypeButton
              tone="all"
              isActive={recordTypeFilter === 'all'}
              onClick={() => onRecordTypeFilterChange('all')}
              disabled={isRecordTypeLocked}
              title={isRecordTypeLocked ? lockedRecordTypeTitle : 'Показать все записи'}
            >
              Все
            </RecordTypeButton>
          </div>
          <SalesChannelMultiSelect
            value={salesChannelFilter}
            onChange={onSalesChannelFilterChange}
            salesChannels={salesChannels}
            normalizeText={normalizeText}
          />
          <label className="flex min-w-[170px] flex-col gap-1 text-[11px] font-semibold text-slate-500">
            Дата платежа от
            <input
              type="date"
              value={paymentScheduledDateFrom}
              onChange={(event) => onPaymentScheduledDateFromChange(event.target.value)}
              className="field field-input h-10 text-sm font-normal text-slate-700"
            />
          </label>
          <label className="flex min-w-[170px] flex-col gap-1 text-[11px] font-semibold text-slate-500">
            Дата платежа до
            <input
              type="date"
              value={paymentScheduledDateTo}
              onChange={(event) => onPaymentScheduledDateToChange(event.target.value)}
              className="field field-input h-10 text-sm font-normal text-slate-700"
            />
          </label>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={onApplyProcessingPreset}
            disabled={!onApplyProcessingPreset}
          >
            К обработке
          </Button>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={onResetAllRecordsFilters}
            disabled={!canResetAllRecordsFilters}
          >
            Сбросить фильтры
          </Button>
          <Button
            type="button"
            variant="quiet"
            size="sm"
            onClick={() => void onExportAllRecords()}
            disabled={isAllRecordsExporting || isAllRecordsLoading}
          >
            {isAllRecordsExporting ? 'Выгружаем...' : 'Экспорт XLSX'}
          </Button>
          {allRecordsExportFile?.webViewLink && (
            <ActionLink
              href={allRecordsExportFile.webViewLink}
              target="_blank"
              rel="noreferrer"
              variant="secondary"
              size="sm"
            >
              Открыть в Google Drive
            </ActionLink>
          )}
          {activeAllRecordsFilterCount > 0 && (
            <span className={'ui-section-meta'}>
              Активных фильтров: {activeAllRecordsFilterCount}
            </span>
          )}
          <div className="min-w-[260px]">
            <StatementLookup
              value={targetStatementId}
              onChange={onTargetStatementChange}
              statements={statements}
              statementType={recordTypeFilter}
            />
          </div>
        </div>
      </div>
      <div className="bg-white px-4 py-5 space-y-3">
        {summary && (
          <div className="grid gap-2 sm:grid-cols-3 xl:grid-cols-6" role="status">
            {[
              ['Записей', summary.recordsCount],
              ['Доходы', `${summary.incomeTotal.toLocaleString('ru-RU')} ₽`],
              ['Расходы', `${summary.expenseTotal.toLocaleString('ru-RU')} ₽`],
              ['Итого', `${summary.netTotal.toLocaleString('ru-RU')} ₽`],
              ['Без даты', summary.unpaidRecordsCount],
              ['Без ведомости', summary.withoutStatementCount],
            ].map(([label, value]) => (
              <div key={label} className="rounded-lg border border-slate-200 px-3 py-2">
                <div className="text-[11px] text-slate-500">{label}</div>
                <div className="font-semibold text-slate-900">{value}</div>
              </div>
            ))}
          </div>
        )}
        <div className={`flex flex-wrap items-center justify-between gap-3 ${'ui-section-meta'}`}>
          <span>
            Показано: <span className="font-semibold text-slate-700">{shownRecordsCount}</span>
            {totalRecordsCount ? ` из ${totalRecordsCount}` : ''}
          </span>
          {isAllRecordsLoading && <span>Загрузка...</span>}
        </div>

        {recordsTable}

        {allRecordsHasMore && (
          <div className={'ui-load-more'}>
            <Button
              type="button"
              onClick={onLoadMore}
              disabled={isAllRecordsLoadingMore || isAllRecordsLoading}
              variant="quiet"
              size="sm"
            >
              {isAllRecordsLoadingMore ? 'Загрузка...' : 'Показать ещё'}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
