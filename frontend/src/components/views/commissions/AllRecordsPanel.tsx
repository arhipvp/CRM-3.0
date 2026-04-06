import type { ReactNode } from 'react';

import type { Statement } from '../../../types';
import { BTN_SM_QUIET, BTN_SM_SECONDARY } from '../../common/buttonStyles';
import { InlineAlert } from '../../common/InlineAlert';
import {
  CHECKBOX_LABEL_XS,
  LOAD_MORE_CONTAINER,
  SEGMENTED_CONTROL,
  SEGMENTED_CONTROL_BUTTON,
  SECTION_HELP_TEXT,
  SECTION_META_TEXT,
} from '../../common/uiClassNames';

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
    <label className={CHECKBOX_LABEL_XS}>
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
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`${SEGMENTED_CONTROL_BUTTON} ${toneClassName}`}
      title={title}
    >
      {children}
    </button>
  );
}

export function AllRecordsPanel({
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
            <span className={SECTION_HELP_TEXT}>Фильтры по записям</span>
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
        <div className="border-b border-slate-200 bg-white px-4 py-3">
          <InlineAlert className="flex flex-wrap items-center justify-between gap-3">
            <span>{allRecordsError}</span>
            <button
              type="button"
              onClick={onRetryLoad}
              className={BTN_SM_SECONDARY}
              disabled={isAllRecordsLoading}
            >
              Повторить
            </button>
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
          <div className={SEGMENTED_CONTROL}>
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
      <div className="bg-white px-4 py-5 space-y-3">
        <div className={`flex flex-wrap items-center justify-between gap-3 ${SECTION_META_TEXT}`}>
          <span>
            Показано: <span className="font-semibold text-slate-700">{shownRecordsCount}</span>
            {totalRecordsCount ? ` из ${totalRecordsCount}` : ''}
          </span>
          {isAllRecordsLoading && <span>Загрузка...</span>}
        </div>

        {recordsTable}

        {allRecordsHasMore && (
          <div className={LOAD_MORE_CONTAINER}>
            <button
              type="button"
              onClick={onLoadMore}
              disabled={isAllRecordsLoadingMore || isAllRecordsLoading}
              className={BTN_SM_QUIET}
            >
              {isAllRecordsLoadingMore ? 'Загрузка...' : 'Показать ещё'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
