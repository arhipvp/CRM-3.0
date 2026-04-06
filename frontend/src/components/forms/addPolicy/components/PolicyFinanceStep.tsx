import React from 'react';

import { formatCurrency, formatDate } from '../../../views/dealsView/helpers';
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
        <div className="rounded-[28px] border border-slate-200 bg-slate-50/70 p-4 shadow-inner shadow-slate-200/40 md:p-5">
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
            <button
              type="button"
              onClick={onAddCounterpartyExpenses}
              className="btn btn-sm btn-secondary whitespace-nowrap"
            >
              + Расход
            </button>
          </div>
        </div>
        <div className="rounded-[28px] border border-slate-200 bg-slate-50/70 p-4 shadow-inner shadow-slate-200/40 md:p-5">
          <label className="app-label">Исполнитель по сделке</label>
          <div className="mt-3 flex flex-wrap gap-2">
            <input
              type="text"
              value={executorName ?? 'отсутствует'}
              readOnly
              className="field field-input flex-1 bg-slate-50 text-slate-900"
            />
            <button
              type="button"
              onClick={onAddExecutorExpenses}
              disabled={!executorName?.trim()}
              className="btn btn-sm btn-secondary whitespace-nowrap"
            >
              + Расход
            </button>
          </div>
        </div>
      </div>

      <div className="rounded-[28px] border border-slate-200 bg-slate-50/70 p-4 shadow-inner shadow-slate-200/40 md:p-5">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="app-label">Платежи</p>
          </div>
        </div>
        {showMiniIndex && (
          <div
            className="sticky top-0 z-10 mt-4 rounded-2xl border border-slate-200 bg-white/95 px-3 py-3 shadow-sm backdrop-blur"
            data-testid="policy-finance-payment-mini-index"
          >
            <div className="flex flex-wrap gap-2">
              {paymentEntries.map((entry, displayIndex) => (
                <button
                  key={`finance-jump-${entry.sourceIndex}`}
                  type="button"
                  onClick={() => scrollToPayment(entry.sourceIndex)}
                  data-testid={`policy-finance-payment-index-${displayIndex + 1}`}
                  className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition ${
                    activeSourceIndex === entry.sourceIndex
                      ? 'border-sky-300 bg-sky-100 text-sky-800 shadow-sm'
                      : 'border-slate-200 bg-slate-50 text-slate-700 hover:border-sky-200 hover:bg-sky-50 hover:text-sky-700'
                  }`}
                >
                  Платёж {displayIndex + 1}
                </button>
              ))}
            </div>
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
                className={`relative overflow-hidden rounded-[28px] border border-slate-300/90 bg-gradient-to-br from-white via-white to-slate-50/90 shadow-[0_18px_42px_rgba(15,23,42,0.12)] transition ${
                  isExpanded ? 'ring-1 ring-sky-200 shadow-[0_24px_54px_rgba(14,165,233,0.18)]' : ''
                }`}
                data-testid="policy-finance-payment-card"
              >
                <div className="absolute inset-y-0 left-0 w-2 rounded-l-[28px] bg-gradient-to-b from-sky-500 via-cyan-500 to-emerald-400" />
                <div
                  className={`ml-2 flex flex-col gap-3 px-4 py-4 sm:flex-row sm:items-start sm:justify-between ${
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
                    <button
                      type="button"
                      onClick={() => {
                        onAddRecord(sourceIndex, 'incomes');
                        onExpandPaymentDetails(sourceIndex);
                      }}
                      className="btn btn-sm btn-secondary"
                    >
                      + Доход
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        onAddRecord(sourceIndex, 'expenses');
                        onExpandPaymentDetails(sourceIndex);
                      }}
                      className="btn btn-sm btn-secondary"
                    >
                      + Расход
                    </button>
                  </div>
                </div>
                {isExpanded && (
                  <div className="ml-2 space-y-4 px-4 pb-4 pt-4">
                    {(errors.length > 0 || warnings.length > 0) && (
                      <div className="space-y-2" data-testid="policy-finance-payment-issues">
                        {errors.length > 0 && (
                          <div className="rounded-2xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800">
                            {errors.map((issue) => issue.message).join(' ')}
                          </div>
                        )}
                        {warnings.length > 0 && (
                          <div className="rounded-2xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
                            {warnings.map((issue) => issue.message).join(' ')}
                          </div>
                        )}
                      </div>
                    )}
                    <div className="rounded-2xl border border-emerald-200 bg-emerald-50/70 p-4 shadow-inner">
                      <div className="mb-2 flex items-center justify-between">
                        <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                          Доходы
                        </h4>
                        <button
                          type="button"
                          className="btn btn-sm btn-quiet"
                          onClick={() => onAddRecord(sourceIndex, 'incomes')}
                        >
                          + Добавить доход
                        </button>
                      </div>
                      {payment.incomes.length === 0 && (
                        <p className="text-sm text-slate-600">
                          Добавьте доход, чтобы привязать поступление к этому платежу.
                        </p>
                      )}
                      <FinancialRecordInputs
                        paymentIndex={sourceIndex}
                        type="incomes"
                        records={payment.incomes}
                        onUpdateRecord={onUpdateRecord}
                        onRemoveRecord={onRemoveRecord}
                      />
                    </div>
                    <div className="rounded-2xl border border-rose-200 bg-rose-50/70 p-4 shadow-inner">
                      <div className="mb-2 flex items-center justify-between">
                        <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                          Расходы
                        </h4>
                        <button
                          type="button"
                          className="btn btn-sm btn-quiet"
                          onClick={() => onAddRecord(sourceIndex, 'expenses')}
                        >
                          + Добавить расход
                        </button>
                      </div>
                      {payment.expenses.length === 0 && (
                        <p className="text-sm text-slate-600">
                          Добавьте расход, чтобы контролировать связанные списания.
                        </p>
                      )}
                      <FinancialRecordInputs
                        paymentIndex={sourceIndex}
                        type="expenses"
                        records={payment.expenses}
                        onUpdateRecord={onUpdateRecord}
                        onRemoveRecord={onRemoveRecord}
                      />
                    </div>
                  </div>
                )}
                <div className="ml-2 border-t border-slate-200/90 px-4 pb-4 pt-3">
                  <button
                    type="button"
                    onClick={() => onTogglePaymentDetails(sourceIndex)}
                    className="btn btn-sm btn-secondary w-full justify-center"
                    aria-expanded={isExpanded}
                    data-testid="policy-finance-payment-expand-toggle"
                  >
                    {isExpanded ? 'Свернуть' : 'Развернуть'}
                  </button>
                </div>
              </section>
            );
          })}
        </div>
      </div>
    </div>
  );
};
