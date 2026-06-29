import React from 'react';
import { FinancialRecordInputs } from './FinancialRecordInputs';
import type { FinancialRecordDraft, PaymentDraft } from '../types';
import { DateInput } from '../../../common/forms/DateInput';
import { Button, IconButton } from '../../../common/Button';
import { EmptyState } from '../../../common/EmptyState';
import { InlineAlert } from '../../../common/InlineAlert';
import { Panel, StatusBadge } from '../../../common/layoutPrimitives';
import type { PaymentIssue } from '../paymentIssues';

interface PaymentSectionProps {
  paymentIndex: number;
  paymentNumber?: number;
  payment: PaymentDraft;
  onFieldChange: (
    index: number,
    field: keyof Omit<PaymentDraft, 'incomes' | 'expenses'>,
    value: string,
  ) => void;
  onRemovePayment: (index: number) => void;
  onAddRecord: (index: number, type: 'incomes' | 'expenses') => void;
  onUpdateRecord: (
    paymentIndex: number,
    type: 'incomes' | 'expenses',
    recordIndex: number,
    field: keyof FinancialRecordDraft,
    value: string,
  ) => void;
  onRemoveRecord: (paymentIndex: number, type: 'incomes' | 'expenses', recordIndex: number) => void;
  showRecords?: boolean;
  dense?: boolean;
  issues?: PaymentIssue[];
  isExpanded?: boolean;
  onToggleExpand?: () => void;
  showExpandToggle?: boolean;
}

export const PaymentSection: React.FC<PaymentSectionProps> = ({
  paymentIndex,
  paymentNumber,
  payment,
  onFieldChange,
  onRemovePayment,
  onAddRecord,
  onUpdateRecord,
  onRemoveRecord,
  showRecords = true,
  dense = false,
  issues = [],
  isExpanded = true,
  onToggleExpand,
  showExpandToggle = false,
}) => {
  const issuesByField = issues.reduce<Record<string, PaymentIssue[]>>((acc, issue) => {
    acc[issue.field] = [...(acc[issue.field] ?? []), issue];
    return acc;
  }, {});
  const errors = issues.filter((issue) => issue.severity === 'error');
  const warnings = issues.filter((issue) => issue.severity === 'warning');
  const moneyAccentClassName = 'rounded-2xl border border-emerald-100 bg-white p-3 shadow-sm';
  const dateAccentClassName = 'rounded-2xl border border-sky-100 bg-white p-3 shadow-sm';
  const getFieldClassName = (field: string) => {
    if (issuesByField[field]?.some((issue) => issue.severity === 'error')) {
      return 'border-rose-300 bg-rose-50/60 ring-2 ring-rose-100';
    }

    if (issuesByField[field]?.some((issue) => issue.severity === 'warning')) {
      return 'border-amber-300 bg-amber-50/60 ring-2 ring-amber-100';
    }

    return '';
  };

  return (
    <Panel
      as="section"
      variant="flat"
      data-testid="policy-payment-card"
      className={`border-slate-200 ${dense ? 'space-y-3 p-4' : 'space-y-4 p-5'}`}
    >
      <div
        className={`flex items-start justify-between border-b border-slate-200/90 pb-3 ${
          dense ? 'gap-3' : 'gap-4'
        }`}
      >
        <div className="space-y-2">
          <div>
            <p className="text-sm font-semibold text-slate-900">
              Платёж #{paymentNumber ?? paymentIndex + 1}
            </p>
            <p className="text-xs text-slate-500">Отдельный шаг графика</p>
          </div>
          <div className="flex flex-wrap items-center gap-2 text-[11px] font-medium">
            <StatusBadge tone="primary">План: {payment.scheduledDate || 'не указана'}</StatusBadge>
            <StatusBadge tone="neutral" className="border-cyan-200 bg-cyan-50 text-cyan-800">
              Факт: {payment.actualDate || 'не указан'}
            </StatusBadge>
          </div>
        </div>
        <IconButton
          icon="delete"
          label="Удалить платёж"
          tone="danger"
          size="sm"
          onClick={() => onRemovePayment(paymentIndex)}
          className="flex-shrink-0"
        />
      </div>
      {(errors.length > 0 || warnings.length > 0) && (
        <div className="space-y-2" data-testid="policy-payment-issues">
          {errors.length > 0 && (
            <InlineAlert>{errors.map((issue) => issue.message).join(' ')}</InlineAlert>
          )}
          {warnings.length > 0 && (
            <InlineAlert tone="info" className="border-amber-200 bg-amber-50 text-amber-800">
              {warnings.map((issue) => issue.message).join(' ')}
            </InlineAlert>
          )}
        </div>
      )}
      {isExpanded && (
        <>
          <div className={`grid grid-cols-1 ${dense ? 'gap-3' : 'gap-4'} md:grid-cols-2`}>
            <div
              data-testid="policy-payment-amount-accent"
              className={`${moneyAccentClassName} ${getFieldClassName('amount')}`}
            >
              <div className="mb-2">
                <label className="block text-xs font-semibold uppercase tracking-[0.2em] text-emerald-800">
                  Сумма
                </label>
                <p className="mt-1 text-[11px] text-emerald-700">Ключевая сумма шага графика</p>
              </div>
              <input
                type="number"
                value={payment.amount}
                onChange={(e) => onFieldChange(paymentIndex, 'amount', e.target.value)}
                data-payment-field="amount"
                className={`field field-input bg-white ring-2 ring-emerald-100/80 ${getFieldClassName(
                  'amount',
                )}`}
              />
            </div>
            <div className="space-y-1">
              <label className="block text-xs font-medium text-slate-600">Комментарий</label>
              <input
                type="text"
                value={payment.description || ''}
                onChange={(e) => onFieldChange(paymentIndex, 'description', e.target.value)}
                data-payment-field="description"
                className={`field field-input mt-1 ${getFieldClassName('description')}`}
              />
            </div>
            <div
              data-testid="policy-payment-scheduled-date-accent"
              className={`${dateAccentClassName} ${getFieldClassName('scheduledDate')}`}
            >
              <div className="mb-2 flex items-start justify-between gap-3">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-[0.2em] text-sky-800">
                    Плановая дата
                  </label>
                  <p className="mt-1 text-[11px] text-sky-700">Главная дата для графика полиса</p>
                </div>
                <StatusBadge tone="primary" className="bg-white text-[10px] uppercase">
                  Ключевая
                </StatusBadge>
              </div>
              <DateInput
                value={payment.scheduledDate || ''}
                onChange={(e) => onFieldChange(paymentIndex, 'scheduledDate', e.target.value)}
                data-payment-field="scheduled-date"
                className={`field field-input border-sky-300 bg-white ring-2 ring-sky-100/80 ${getFieldClassName(
                  'scheduledDate',
                )}`}
              />
            </div>
            <div
              data-testid="policy-payment-actual-date-accent"
              className={`${dateAccentClassName} ${getFieldClassName('actualDate')}`}
            >
              <div className="mb-2">
                <label className="block text-xs font-semibold uppercase tracking-[0.2em] text-sky-800">
                  Фактическая дата
                </label>
                <p className="mt-1 text-[11px] text-sky-700">Когда платёж реально поступил</p>
              </div>
              <DateInput
                value={payment.actualDate || ''}
                onChange={(e) => onFieldChange(paymentIndex, 'actualDate', e.target.value)}
                data-payment-field="actual-date"
                className={`field field-input border-sky-300 bg-white ring-2 ring-sky-100/80 ${getFieldClassName(
                  'actualDate',
                )}`}
              />
            </div>
          </div>

          {showRecords && (
            <div className={dense ? 'space-y-2' : 'space-y-3'}>
              <Panel variant="muted" padding="sm">
                <div className="mb-2 flex items-center justify-between">
                  <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Доходы
                  </h4>
                  <Button
                    variant="quiet"
                    size="sm"
                    icon="plus"
                    aria-label="+ Добавить доход"
                    onClick={() => onAddRecord(paymentIndex, 'incomes')}
                  >
                    Добавить доход
                  </Button>
                </div>
                {payment.incomes.length === 0 && (
                  <EmptyState compact>
                    Добавьте доход, чтобы привязать поступление к этому платежу.
                  </EmptyState>
                )}
                <FinancialRecordInputs
                  paymentIndex={paymentIndex}
                  type="incomes"
                  records={payment.incomes}
                  onUpdateRecord={onUpdateRecord}
                  onRemoveRecord={onRemoveRecord}
                />
              </Panel>
              <Panel variant="muted" padding="sm">
                <div className="mb-2 flex items-center justify-between">
                  <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Расходы
                  </h4>
                  <Button
                    variant="quiet"
                    size="sm"
                    icon="plus"
                    aria-label="+ Добавить расход"
                    onClick={() => onAddRecord(paymentIndex, 'expenses')}
                  >
                    Добавить расход
                  </Button>
                </div>
                {payment.expenses.length === 0 && (
                  <EmptyState compact>
                    Добавьте расход, чтобы контролировать связанные списания.
                  </EmptyState>
                )}
                <FinancialRecordInputs
                  paymentIndex={paymentIndex}
                  type="expenses"
                  records={payment.expenses}
                  onUpdateRecord={onUpdateRecord}
                  onRemoveRecord={onRemoveRecord}
                />
              </Panel>
            </div>
          )}
        </>
      )}

      {showExpandToggle && onToggleExpand && (
        <div className="border-t border-slate-200/90 pt-3">
          <Button
            variant="secondary"
            size="sm"
            icon={isExpanded ? 'collapse' : 'expand'}
            onClick={onToggleExpand}
            aria-expanded={isExpanded}
            data-testid="policy-payment-expand-toggle"
            className="w-full"
          >
            {isExpanded ? 'Свернуть' : 'Развернуть'}
          </Button>
        </div>
      )}
    </Panel>
  );
};
