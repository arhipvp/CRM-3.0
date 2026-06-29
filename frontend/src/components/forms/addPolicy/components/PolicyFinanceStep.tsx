import React from 'react';

import { formatCurrency, formatDate } from '../../../views/dealsView/helpers';
import { Button } from '../../../common/Button';
import { EmptyState } from '../../../common/EmptyState';
import { InlineAlert } from '../../../common/InlineAlert';
import { Panel } from '../../../common/layoutPrimitives';
import { FinancialRecordInputs } from './FinancialRecordInputs';
import type { FinancialRecordDraft } from '../types';
import type { PaymentDraftOrderEntry } from '../paymentDraftOrdering';
import type { PaymentIssuesByIndex } from '../paymentIssues';

interface PolicyFinanceStepProps {
  counterparty: string;
  onCounterpartyChange: (value: string) => void;
  onCounterpartyTouched: () => void;
  onAddCounterpartyExpenses: () => void;
  executorName?: string | null;
  onAddExecutorExpenses: () => void;
  paymentEntries: PaymentDraftOrderEntry[];
  paymentIssuesByIndex: PaymentIssuesByIndex;
  expandedPaymentIndex: number | null;
  onTogglePaymentDetails: (index: number) => void;
  onExpandPaymentDetails: (index: number) => void;
  onAddRecord: (paymentIndex: number, type: 'incomes' | 'expenses') => void;
  onUpdateRecord: (
    paymentIndex: number,
    type: 'incomes' | 'expenses',
    recordIndex: number,
    field: keyof FinancialRecordDraft,
    value: string,
  ) => void;
  onRemoveRecord: (paymentIndex: number, type: 'incomes' | 'expenses', recordIndex: number) => void;
}

export const PolicyFinanceStep: React.FC<PolicyFinanceStepProps> = ({
  counterparty,
  onCounterpartyChange,
  onCounterpartyTouched,
  onAddCounterpartyExpenses,
  executorName,
  onAddExecutorExpenses,
  paymentEntries,
  paymentIssuesByIndex,
  expandedPaymentIndex,
  onTogglePaymentDetails,
  onExpandPaymentDetails,
  onAddRecord,
  onUpdateRecord,
  onRemoveRecord,
}) => {
  const paymentListRef = React.useRef<HTMLDivElement | null>(null);
  const cardRefs = React.useRef<Record<number, HTMLElement | null>>({});
  const showMiniIndex = paymentEntries.length >= 4;
  const [activeSourceIndex, setActiveSourceIndex] = React.useState<number | null>(
    paymentEntries[0]?.sourceIndex ?? null,
  );

  const scrollToPayment = React.useCallback(
    (sourceIndex: number, behavior: ScrollBehavior = 'smooth') => {
      const container = paymentListRef.current;
      const card = cardRefs.current[sourceIndex];
      if (!container || !card) {
        return;
      }

      setActiveSourceIndex(sourceIndex);

      const containerRect = container.getBoundingClientRect();
      const cardRect = card.getBoundingClientRect();
      const offset = cardRect.top - containerRect.top + container.scrollTop - 12;
      if (typeof container.scrollTo === 'function') {
        container.scrollTo({ top: Math.max(offset, 0), behavior });
        return;
      }

      container.scrollTop = Math.max(offset, 0);
    },
    [],
  );

  React.useEffect(() => {
    setActiveSourceIndex(paymentEntries[0]?.sourceIndex ?? null);
  }, [paymentEntries]);

  React.useEffect(() => {
    const container = paymentListRef.current;
    if (!container || !showMiniIndex) {
      return;
    }

    const updateActiveSourceIndex = () => {
      const containerTop = container.getBoundingClientRect().top;
      let nextActive = paymentEntries[0]?.sourceIndex ?? null;
      let smallestDistance = Number.POSITIVE_INFINITY;

      paymentEntries.forEach((entry) => {
        const card = cardRefs.current[entry.sourceIndex];
        if (!card) {
          return;
        }

        const distance = Math.abs(card.getBoundingClientRect().top - containerTop - 12);
        if (distance < smallestDistance) {
          smallestDistance = distance;
          nextActive = entry.sourceIndex;
        }
      });

      setActiveSourceIndex(nextActive);
    };

    updateActiveSourceIndex();
    container.addEventListener('scroll', updateActiveSourceIndex, { passive: true });
    window.addEventListener('resize', updateActiveSourceIndex);

    return () => {
      container.removeEventListener('scroll', updateActiveSourceIndex);
      window.removeEventListener('resize', updateActiveSourceIndex);
    };
  }, [paymentEntries, showMiniIndex]);

  React.useEffect(() => {
    if (expandedPaymentIndex == null) {
      return;
    }

    const frameId = window.requestAnimationFrame(() => {
      scrollToPayment(expandedPaymentIndex, 'smooth');
    });

    return () => window.cancelAnimationFrame(frameId);
  }, [expandedPaymentIndex, scrollToPayment]);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <Panel variant="muted" padding="md" className="md:p-5">
          <label className="app-label">Контрагент</label>
          <div className="mt-3 flex flex-wrap gap-2">
            <input
              type="text"
              value={counterparty}
              onChange={(event) => {
                onCounterpartyChange(event.target.value);
                onCounterpartyTouched();
              }}
              className="field field-input flex-1"
              placeholder="Контрагент / организация"
            />
            <Button
              variant="secondary"
              size="sm"
              icon="plus"
              aria-label="+ Расход"
              onClick={onAddCounterpartyExpenses}
              className="whitespace-nowrap"
            >
              Расход
            </Button>
          </div>
        </Panel>
        <Panel variant="muted" padding="md" className="md:p-5">
          <label className="app-label">Исполнитель по сделке</label>
          <div className="mt-3 flex flex-wrap gap-2">
            <input
              type="text"
              value={executorName ?? 'отсутствует'}
              readOnly
              className="field field-input flex-1 bg-slate-50 text-slate-900"
            />
            <Button
              variant="secondary"
              size="sm"
              icon="plus"
              aria-label="+ Расход"
              onClick={onAddExecutorExpenses}
              disabled={!executorName?.trim()}
              className="whitespace-nowrap"
            >
              Расход
            </Button>
          </div>
        </Panel>
      </div>

      <Panel variant="muted" padding="md" className="md:p-5">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="app-label">Платежи</p>
          </div>
        </div>
        {showMiniIndex && (
          <div
            className="app-segmented-control sticky top-0 z-10 mt-4 bg-white/95 shadow-sm backdrop-blur"
            data-testid="policy-finance-payment-mini-index"
          >
            {paymentEntries.map((entry, displayIndex) => {
              const isSelected = activeSourceIndex === entry.sourceIndex;
              return (
                <button
                  key={`finance-jump-${entry.sourceIndex}`}
                  type="button"
                  aria-pressed={isSelected}
                  onClick={() => scrollToPayment(entry.sourceIndex)}
                  data-testid={`policy-finance-payment-index-${displayIndex + 1}`}
                  className={`app-segmented-control-button text-xs ${
                    isSelected
                      ? 'border border-[var(--app-border)] bg-white font-semibold text-sky-700 shadow-sm'
                      : 'text-slate-500 hover:bg-white/70 hover:text-slate-800'
                  }`}
                >
                  Платёж {displayIndex + 1}
                </button>
              );
            })}
          </div>
        )}
        <div
          ref={paymentListRef}
          className="mt-4 max-h-[min(46vh,34rem)] space-y-6 overflow-y-auto pr-1"
          data-testid="policy-finance-payment-list"
        >
          {paymentEntries.map((entry, displayIndex) => {
            const { payment, sourceIndex } = entry;
            const isExpanded = expandedPaymentIndex === sourceIndex;
            const issues = paymentIssuesByIndex[sourceIndex] ?? [];
            const errors = issues.filter((issue) => issue.severity === 'error');
            const warnings = issues.filter((issue) => issue.severity === 'warning');
            return (
              <section
                key={`records-${sourceIndex}`}
                ref={(node) => {
                  cardRefs.current[sourceIndex] = node;
                }}
                className={`app-panel overflow-hidden shadow-none transition ${
                  isExpanded ? 'border-sky-200 ring-1 ring-sky-200' : 'border-slate-200'
                }`}
                data-testid="policy-finance-payment-card"
              >
                <div
                  className={`flex flex-col gap-3 px-4 py-4 sm:flex-row sm:items-start sm:justify-between ${
                    isExpanded
                      ? 'border-b border-sky-200/90 bg-sky-50/70'
                      : 'border-b border-slate-200/90'
                  }`}
                >
                  <div className="min-w-0 space-y-2">
                    <p className="text-sm font-semibold text-slate-900">
                      {payment.description || `Платёж #${displayIndex + 1}`}
                    </p>
                    <div className="flex flex-wrap gap-2 text-[11px] font-medium">
                      <span
                        className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-emerald-800 shadow-sm"
                        data-testid="policy-finance-payment-amount-chip"
                      >
                        Сумма {formatCurrency(payment.amount || '0')}
                      </span>
                      <span
                        className="rounded-full border border-sky-200 bg-sky-100 px-3 py-1.5 text-sky-800 shadow-sm"
                        data-testid="policy-finance-payment-scheduled-chip"
                      >
                        План {formatDate(payment.scheduledDate)}
                      </span>
                      <span
                        data-testid="policy-finance-payment-actual-chip"
                        className={`rounded-full ${
                          payment.actualDate
                            ? 'border border-cyan-200 bg-cyan-50 px-3 py-1.5 text-cyan-800 shadow-sm'
                            : 'border border-rose-200 bg-rose-100 px-3 py-1.5 text-rose-700 shadow-sm'
                        }`}
                      >
                        {payment.actualDate
                          ? `Оплачен ${formatDate(payment.actualDate)}`
                          : 'Не оплачен'}
                      </span>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      variant="secondary"
                      size="sm"
                      icon="plus"
                      aria-label="+ Доход"
                      onClick={() => {
                        onAddRecord(sourceIndex, 'incomes');
                        onExpandPaymentDetails(sourceIndex);
                      }}
                    >
                      Доход
                    </Button>
                    <Button
                      variant="secondary"
                      size="sm"
                      icon="plus"
                      aria-label="+ Расход"
                      onClick={() => {
                        onAddRecord(sourceIndex, 'expenses');
                        onExpandPaymentDetails(sourceIndex);
                      }}
                    >
                      Расход
                    </Button>
                  </div>
                </div>
                {isExpanded && (
                  <div className="space-y-4 px-4 pb-4 pt-4">
                    {(errors.length > 0 || warnings.length > 0) && (
                      <div className="space-y-2" data-testid="policy-finance-payment-issues">
                        {errors.length > 0 && (
                          <InlineAlert>
                            {errors.map((issue) => issue.message).join(' ')}
                          </InlineAlert>
                        )}
                        {warnings.length > 0 && (
                          <InlineAlert
                            tone="info"
                            className="border-amber-200 bg-amber-50 text-amber-800"
                          >
                            {warnings.map((issue) => issue.message).join(' ')}
                          </InlineAlert>
                        )}
                      </div>
                    )}
                    <Panel variant="muted" padding="md" className="border-emerald-100 bg-white">
                      <div className="mb-2 flex items-center justify-between">
                        <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                          Доходы
                        </h4>
                        <Button
                          variant="quiet"
                          size="sm"
                          icon="plus"
                          aria-label="+ Добавить доход"
                          onClick={() => onAddRecord(sourceIndex, 'incomes')}
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
                        paymentIndex={sourceIndex}
                        type="incomes"
                        records={payment.incomes}
                        onUpdateRecord={onUpdateRecord}
                        onRemoveRecord={onRemoveRecord}
                      />
                    </Panel>
                    <Panel variant="muted" padding="md" className="border-rose-100 bg-white">
                      <div className="mb-2 flex items-center justify-between">
                        <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                          Расходы
                        </h4>
                        <Button
                          variant="quiet"
                          size="sm"
                          icon="plus"
                          aria-label="+ Добавить расход"
                          onClick={() => onAddRecord(sourceIndex, 'expenses')}
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
                        paymentIndex={sourceIndex}
                        type="expenses"
                        records={payment.expenses}
                        onUpdateRecord={onUpdateRecord}
                        onRemoveRecord={onRemoveRecord}
                      />
                    </Panel>
                  </div>
                )}
                <div className="border-t border-slate-200/90 px-4 pb-4 pt-3">
                  <Button
                    variant="secondary"
                    size="sm"
                    icon={isExpanded ? 'collapse' : 'expand'}
                    onClick={() => onTogglePaymentDetails(sourceIndex)}
                    className="w-full"
                    aria-expanded={isExpanded}
                    data-testid="policy-finance-payment-expand-toggle"
                  >
                    {isExpanded ? 'Свернуть' : 'Развернуть'}
                  </Button>
                </div>
              </section>
            );
          })}
        </div>
      </Panel>
    </div>
  );
};
